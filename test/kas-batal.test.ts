import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import { cashDeposits, expenses, ownerPayments, users } from "@/lib/db/schema";
import {
  SetoranTidakAda,
  SudahDibatalkan,
  SudahDiterima,
  batalkanSetoran,
  buatSetoran,
  daftarSetoran,
  setoranHari,
  terimaSetoran,
} from "@/lib/kas/kelola";
import { awalHariWib } from "@/lib/waktu";

/**
 * Membatalkan penutupan kas yang salah ketik.
 *
 * Sebelum ini, kasir yang salah mengetik jumlah setoran terkunci: indeks unik
 * menolak penutupan kedua untuk hari yang sama, dan tidak ada jalan keluar dari
 * aplikasi selain SQL langsung ke database produksi. Kuncinya sendiri benar dan
 * harus tetap ada; yang belum ada adalah jalan keluar yang sah.
 *
 * Dua batas yang dijaga: yang sudah ditandai diterima tidak boleh diubah lagi —
 * dua pihak sudah menyepakatinya — dan pembatalan harus meninggalkan jejak.
 * Penutupan kas adalah tempat selisih uang dipersoalkan; baris yang bisa lenyap
 * tanpa jejak membuat seluruh catatan itu tidak ada gunanya.
 */

let uji: DbUji;

const HARI = new Date("2026-08-14T05:00:00.000Z"); // 12:00 WIB

let idRina = 0;
let idAdmin = 0;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(cashDeposits);
  await uji.db.delete(ownerPayments);
  await uji.db.delete(expenses);
  await uji.db.delete(users);

  [{ id: idRina }] = await uji.db
    .insert(users)
    .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });

  [{ id: idAdmin }] = await uji.db
    .insert(users)
    .values({ username: "admin", nama: "Admin", peran: "admin", passwordHash: "x" })
    .returning({ id: users.id });
});

const tutup = (jumlah: number) =>
  buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: jumlah });

describe("membatalkan penutupan", () => {
  it("mencatat siapa membatalkan, kapan, dan alasannya", async () => {
    const { id } = await tutup(90000);

    await batalkanSetoran(id, idAdmin, "Salah ketik, seharusnya 900.000");

    const [baris] = await uji.db
      .select()
      .from(cashDeposits)
      .where(eq(cashDeposits.id, id));

    expect(baris.status).toBe("dibatalkan");
    expect(baris.dibatalkanOleh).toBe(idAdmin);
    expect(baris.dibatalkanPada).not.toBeNull();
    expect(baris.alasanBatal).toBe("Salah ketik, seharusnya 900.000");
  });

  it("tidak menghapus barisnya", async () => {
    // Jejaknya justru yang paling berharga di sini.
    const { id } = await tutup(90000);
    await batalkanSetoran(id, idAdmin, "salah ketik");

    expect(await uji.db.select().from(cashDeposits)).toHaveLength(1);
  });

  it("membuat kasir bisa menutup ulang hari itu", async () => {
    const { id } = await tutup(90000);
    await batalkanSetoran(id, idAdmin, "salah ketik");

    const ulang = await tutup(900000);

    const semua = await uji.db.select().from(cashDeposits);
    expect(semua).toHaveLength(2);

    const [baris] = semua.filter((b) => b.id === ulang.id);
    expect(baris.jumlahDiserahkan).toBe(900000);
    expect(baris.status).toBe("menunggu");
  });

  it("penutupan yang dibatalkan tidak lagi dianggap sebagai penutupan hari itu", async () => {
    const { id } = await tutup(90000);
    expect(await setoranHari(idRina, HARI)).not.toBeNull();

    await batalkanSetoran(id, idAdmin, "salah ketik");

    // Halaman kas memakai ini untuk memutuskan menampilkan formulir lagi.
    expect(await setoranHari(idRina, HARI)).toBeNull();
  });

  it("tetap muncul di daftar supaya jejaknya terbaca", async () => {
    const { id } = await tutup(90000);
    await batalkanSetoran(id, idAdmin, "salah ketik");

    const daftar = await daftarSetoran({
      mulai: awalHariWib(HARI),
      selesai: new Date(awalHariWib(HARI).getTime() + 86_400_000),
    });

    const dibatalkan = daftar.find((s) => s.id === id);
    expect(dibatalkan?.status).toBe("dibatalkan");
    expect(dibatalkan?.namaPembatal).toBe("Admin");
    expect(dibatalkan?.alasanBatal).toBe("salah ketik");
  });
});

describe("yang tidak boleh dibatalkan", () => {
  it("menolak penutupan yang sudah ditandai diterima", async () => {
    // Dua pihak sudah menyepakatinya. Mengubahnya berarti membatalkan
    // kesepakatan itu secara sepihak.
    const { id } = await tutup(90000);
    await terimaSetoran(id, idAdmin);

    await expect(batalkanSetoran(id, idAdmin, "salah ketik")).rejects.toThrow(
      SudahDiterima,
    );

    const [baris] = await uji.db
      .select()
      .from(cashDeposits)
      .where(eq(cashDeposits.id, id));
    expect(baris.status).toBe("diterima");
  });

  it("menolak yang sudah dibatalkan sebelumnya", async () => {
    const { id } = await tutup(90000);
    await batalkanSetoran(id, idAdmin, "salah ketik");

    await expect(batalkanSetoran(id, idAdmin, "lagi")).rejects.toThrow(SudahDibatalkan);
  });

  it("menolak id yang tidak ada", async () => {
    await expect(batalkanSetoran(9999, idAdmin, "salah ketik")).rejects.toThrow(
      SetoranTidakAda,
    );
  });
});

describe("menerima setelah dibatalkan", () => {
  it("penutupan yang dibatalkan tidak bisa ditandai diterima", async () => {
    const { id } = await tutup(90000);
    await batalkanSetoran(id, idAdmin, "salah ketik");

    await expect(terimaSetoran(id, idAdmin)).rejects.toThrow();

    const [baris] = await uji.db
      .select()
      .from(cashDeposits)
      .where(eq(cashDeposits.id, id));
    expect(baris.status).toBe("dibatalkan");
  });
});

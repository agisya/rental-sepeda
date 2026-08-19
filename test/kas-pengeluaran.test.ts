import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import { cashDeposits, expenses, ownerPayments, users } from "@/lib/db/schema";
import { catatPengeluaranLaci, rekapKasHarian } from "@/lib/kas/kelola";

/**
 * Pengeluaran yang diambil kasir dari laci.
 *
 * Rekap kas sudah lama mengurangi pengeluaran tunai, tapi menu Pengeluaran
 * hanya untuk admin — sehingga ban yang dibeli kasir tidak pernah bisa dicatat
 * olehnya dan selalu muncul sebagai selisih. Angka "seharusnya" jadi meleset
 * hampir tiap hari, dan fitur yang angkanya tidak dipercaya lebih buruk
 * daripada tidak ada fitur sama sekali.
 *
 * Yang dijaga di sini adalah batasnya. Kasir boleh mencatat uang yang keluar
 * dari lacinya sendiri, dan boleh membatalkannya selama kas belum ditutup —
 * tapi tidak boleh menyentuh catatan orang lain, dan tidak boleh mengubah dasar
 * penutupan yang sudah ditandatangani.
 */

let uji: DbUji;

const HARI = new Date("2026-08-14T05:00:00.000Z"); // 12:00 WIB

let idRina = 0;
let idBudi = 0;

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

  [{ id: idBudi }] = await uji.db
    .insert(users)
    .values({ username: "budi", nama: "Budi", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });
});

function pengeluaran(kasirId: number, jumlah = 25000) {
  return catatPengeluaranLaci({
    kasirId,
    hari: HARI,
    kategori: "sparepart",
    keterangan: "Ban dalam",
    jumlah,
  });
}

describe("mencatat pengeluaran dari laci", () => {
  it("selalu tersimpan sebagai tunai, atas nama pencatatnya", async () => {
    // Metode tidak boleh dipilih di sini. Uang yang diambil dari laci menurut
    // definisinya tunai; membiarkannya dipilih hanya membuka jalan mencatat
    // pengeluaran yang tidak pernah mengurangi laci.
    const { id } = await pengeluaran(idRina);

    const [baris] = await uji.db.select().from(expenses).where(eq(expenses.id, id));

    expect(baris.metode).toBe("tunai");
    expect(baris.dicatatOleh).toBe(idRina);
    expect(baris.jumlah).toBe(25000);
  });

  it("langsung mengurangi angka yang harus disetorkan", async () => {
    const sebelum = await rekapKasHarian(idRina, HARI);
    await pengeluaran(idRina, 30000);
    const sesudah = await rekapKasHarian(idRina, HARI);

    expect(sesudah.pengeluaranTunai - sebelum.pengeluaranTunai).toBe(30000);
    expect(sebelum.jumlahSeharusnya - sesudah.jumlahSeharusnya).toBe(30000);
  });

  it("tidak mengurangi laci kasir lain", async () => {
    await pengeluaran(idRina, 30000);

    expect((await rekapKasHarian(idBudi, HARI)).pengeluaranTunai).toBe(0);
  });
});

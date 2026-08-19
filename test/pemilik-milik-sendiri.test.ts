import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import { bikes, owners, renters, rentals, users } from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { hitungBiaya } from "@/lib/rental/pricing";
import { saldoSemuaPemilik } from "@/lib/queries/keuangan";

/**
 * Sepeda milik rental sendiri.
 *
 * Sebelum ada penanda ini, sepeda milik sendiri dititipkan ke baris pemilik palsu
 * berpersentase 100. Artinya justru terbalik: 100 berarti pemilik dapat seluruh
 * omzet dan rental dapat nol — sehingga sepeda milik sendiri menyumbang Rp 0 ke
 * laba, dan Laporan Pemilik menumpuk utang kepada diri sendiri yang tidak pernah
 * bisa dilunasi secara masuk akal.
 *
 * Uji ini menjaga tiga hal: persentasenya nol, uangnya masuk ke bagian rental,
 * dan penandanya tidak bisa dipasang di dua baris sekaligus.
 */

let uji: DbUji;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(rentals);
  await uji.db.delete(bikes);
  await uji.db.delete(renters);
  await uji.db.delete(owners);
  await uji.db.delete(users);
});

function tambahPemilik(nama: string, persentase: number, milikSendiri = false) {
  return uji.db
    .insert(owners)
    .values({ nama, noHp: "0811", persentaseBagiHasil: persentase, milikSendiri })
    .returning({ id: owners.id });
}

describe("penanda milik sendiri", () => {
  it("hanya boleh dipasang pada satu pemilik", async () => {
    await tambahPemilik("Rental Sepeda Garut", 0, true);

    // Dijaga indeks unik parsial di database, bukan hanya oleh formulir — dua
    // baris "milik sendiri" akan memecah omzet sepeda sendiri tanpa alasan.
    await expect(tambahPemilik("Rental Cabang", 0, true)).rejects.toSatisfy(
      pelanggaranUnik,
    );
  });

  it("tidak menghalangi banyak pemilik titipan", async () => {
    await tambahPemilik("Rental Sepeda Garut", 0, true);
    await tambahPemilik("Budi", 60);
    await tambahPemilik("Andi", 55);

    expect(await uji.db.select().from(owners)).toHaveLength(3);
  });

  it("bisa dipindah ke pemilik lain setelah yang lama dilepas", async () => {
    const [lama] = await tambahPemilik("Rental Lama", 0, true);

    await uji.db
      .update(owners)
      .set({ milikSendiri: false })
      .where(eq(owners.id, lama.id));

    await tambahPemilik("Rental Baru", 0, true);

    const sendiri = await uji.db
      .select({ nama: owners.nama })
      .from(owners)
      .where(eq(owners.milikSendiri, true));

    expect(sendiri.map((s) => s.nama)).toEqual(["Rental Baru"]);
  });
});

describe("uang dari sepeda milik sendiri", () => {
  it("seluruhnya masuk ke bagian rental saat persentasenya nol", async () => {
    const hasil = hitungBiaya({
      waktuMulai: new Date("2026-08-14T05:00:00.000Z"),
      waktuSelesai: new Date("2026-08-14T08:00:00.000Z"),
      tarifPerJam: 15000,
      persentasePemilik: 0,
    });

    expect(hasil.totalBiaya).toBe(45000);
    expect(hasil.bagianPemilik).toBe(0);
    expect(hasil.bagianRental).toBe(45000);
  });

  it("justru terbalik kalau persentasenya 100, seperti cara lama", async () => {
    // Dipertahankan sebagai uji supaya kekeliruan lama tidak diulang: 100 berarti
    // pemilik dapat semuanya dan rental dapat nol, bukan sebaliknya.
    const hasil = hitungBiaya({
      waktuMulai: new Date("2026-08-14T05:00:00.000Z"),
      waktuSelesai: new Date("2026-08-14T08:00:00.000Z"),
      tarifPerJam: 15000,
      persentasePemilik: 100,
    });

    expect(hasil.bagianPemilik).toBe(45000);
    expect(hasil.bagianRental).toBe(0);
  });
});

describe("laporan pemilik", () => {
  it("membawa penanda milik sendiri supaya bisa dikeluarkan dari total utang", async () => {
    await tambahPemilik("Rental Sepeda Garut", 0, true);
    await tambahPemilik("Budi", 60);

    const saldo = await saldoSemuaPemilik();
    const sendiri = saldo.find((s) => s.nama === "Rental Sepeda Garut");
    const titipan = saldo.find((s) => s.nama === "Budi");

    expect(sendiri?.milikSendiri).toBe(true);
    expect(titipan?.milikSendiri).toBe(false);
  });

  it("hak pemilik untuk sepeda milik sendiri tetap nol walau ada rental selesai", async () => {
    const [sendiri] = await tambahPemilik("Rental Sepeda Garut", 0, true);

    const [{ id: idPetugas }] = await uji.db
      .insert(users)
      .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
      .returning({ id: users.id });

    const [{ id: idSepeda }] = await uji.db
      .insert(bikes)
      .values({
        kode: "MTB-001",
        nama: "Polygon",
        jenis: "MTB",
        tarifPerJam: 15000,
        ownerId: sendiri.id,
      })
      .returning({ id: bikes.id });

    const [{ id: idPenyewa }] = await uji.db
      .insert(renters)
      .values({ nama: "Andi", noHp: "0822" })
      .returning({ id: renters.id });

    await uji.db.insert(rentals).values({
      bikeId: idSepeda,
      renterId: idPenyewa,
      kasirId: idPetugas,
      ownerIdSnapshot: sendiri.id,
      tarifPerJamSnapshot: 15000,
      persentasePemilikSnapshot: 0,
      waktuMulai: new Date("2026-08-14T05:00:00.000Z"),
      waktuSelesai: new Date("2026-08-14T08:00:00.000Z"),
      totalBiaya: 45000,
      bagianPemilik: 0,
      bagianRental: 45000,
      metodeBayar: "tunai",
      status: "selesai",
    });

    const saldo = await saldoSemuaPemilik();
    const baris = saldo.find((s) => s.ownerId === sendiri.id);

    // Nol hak berarti nol sisa: tidak ada utang palsu kepada diri sendiri.
    expect(baris?.totalHak).toBe(0);
    expect(baris?.sisa).toBe(0);
  });
});

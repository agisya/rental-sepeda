import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import {
  bikes,
  cashDeposits,
  expenses,
  owners,
  ownerPayments,
  renters,
  rentals,
  users,
} from "@/lib/db/schema";
import { rincianKasHarian } from "@/lib/kas/kelola";

/**
 * Rincian di balik angka penutupan kas.
 *
 * Rekapnya sudah lama menjawab "berapa", tapi bukan "dari mana". Ketika uang di
 * laci tidak cocok dengan catatan, kasir tidak punya apa pun untuk diperiksa —
 * dan selisih yang tidak bisa ditelusuri akhirnya cuma ditandatangani saja.
 *
 * Yang dijaga di sini: rincian harus memuat persis transaksi yang membentuk
 * angka rekap, tidak lebih dan tidak kurang. Rincian yang isinya berbeda dari
 * angkanya lebih berbahaya daripada tidak ada rincian sama sekali, karena ia
 * membuat orang percaya pada pemeriksaan yang sebenarnya salah.
 */

let uji: DbUji;

const HARI = new Date("2026-08-14T05:00:00.000Z"); // 12:00 WIB
const HARI_LAIN = new Date("2026-08-15T05:00:00.000Z");

let idRina = 0;
let idBudi = 0;
let idSepeda = 0;
let idPenyewa = 0;
let idPemilik = 0;

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
  await uji.db.delete(rentals);
  await uji.db.delete(bikes);
  await uji.db.delete(renters);
  await uji.db.delete(owners);
  await uji.db.delete(users);

  [{ id: idRina }] = await uji.db
    .insert(users)
    .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });

  [{ id: idBudi }] = await uji.db
    .insert(users)
    .values({ username: "budi", nama: "Budi", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });

  [{ id: idPemilik }] = await uji.db
    .insert(owners)
    .values({ nama: "Pak Dedi", noHp: "0811", persentaseBagiHasil: 60 })
    .returning({ id: owners.id });

  [{ id: idSepeda }] = await uji.db
    .insert(bikes)
    .values({
      kode: "MTB-001",
      nama: "Polygon",
      jenis: "MTB",
      tarifPerJam: 15000,
      ownerId: idPemilik,
    })
    .returning({ id: bikes.id });

  [{ id: idPenyewa }] = await uji.db
    .insert(renters)
    .values({ nama: "Andi", noHp: "0822" })
    .returning({ id: renters.id });
});

async function rentalSelesai(opsi: {
  total: number;
  metode: "tunai" | "qris" | "transfer";
  oleh?: number;
  selesai?: Date;
  status?: "selesai" | "batal";
}) {
  await uji.db.insert(rentals).values({
    bikeId: idSepeda,
    renterId: idPenyewa,
    kasirId: opsi.oleh ?? idRina,
    diselesaikanOleh: opsi.oleh ?? idRina,
    ownerIdSnapshot: idPemilik,
    tarifPerJamSnapshot: 15000,
    persentasePemilikSnapshot: 60,
    waktuMulai: new Date(HARI.getTime() - 3600_000),
    waktuSelesai: opsi.selesai ?? HARI,
    totalBiaya: opsi.total,
    bagianPemilik: Math.round(opsi.total * 0.6),
    bagianRental: opsi.total - Math.round(opsi.total * 0.6),
    metodeBayar: opsi.metode,
    status: opsi.status ?? "selesai",
  });
}

describe("rincian rental", () => {
  it("memisahkan yang tunai dari yang bukan", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai" });
    await rentalSelesai({ total: 90000, metode: "qris" });
    await rentalSelesai({ total: 30000, metode: "transfer" });

    const rincian = await rincianKasHarian(idRina, HARI);

    expect(rincian.rentalTunai.map((r) => r.jumlah)).toEqual([45000]);
    expect(rincian.rentalNonTunai.map((r) => r.jumlah).sort((a, b) => a - b)).toEqual([
      30000, 90000,
    ]);
  });

  it("membawa kode sepeda dan nama penyewa supaya bisa dicocokkan", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai" });

    const [baris] = (await rincianKasHarian(idRina, HARI)).rentalTunai;

    expect(baris.kodeSepeda).toBe("MTB-001");
    expect(baris.namaPenyewa).toBe("Andi");
    expect(baris.waktu).toBeInstanceOf(Date);
  });

  it("tidak membawa transaksi kasir lain", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai", oleh: idRina });
    await rentalSelesai({ total: 80000, metode: "tunai", oleh: idBudi });

    expect((await rincianKasHarian(idRina, HARI)).rentalTunai).toHaveLength(1);
    expect((await rincianKasHarian(idBudi, HARI)).rentalTunai).toHaveLength(1);
  });

  it("tidak membawa hari lain maupun rental yang dibatalkan", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai", selesai: HARI_LAIN });
    await rentalSelesai({ total: 20000, metode: "tunai", status: "batal" });

    expect((await rincianKasHarian(idRina, HARI)).rentalTunai).toHaveLength(0);
  });
});

describe("rincian uang keluar", () => {
  it("membawa pengeluaran tunai beserta keterangannya", async () => {
    await uji.db.insert(expenses).values({
      tanggal: HARI,
      kategori: "sparepart",
      keterangan: "Ban dalam",
      jumlah: 25000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    const [baris] = (await rincianKasHarian(idRina, HARI)).pengeluaranTunai;

    expect(baris.keterangan).toBe("Ban dalam");
    expect(baris.jumlah).toBe(25000);
  });

  it("tidak membawa pengeluaran yang dibayar bukan dari laci", async () => {
    await uji.db.insert(expenses).values({
      tanggal: HARI,
      kategori: "listrik",
      keterangan: "Token",
      jumlah: 50000,
      metode: "transfer",
      dicatatOleh: idRina,
    });

    expect((await rincianKasHarian(idRina, HARI)).pengeluaranTunai).toHaveLength(0);
  });

  it("membawa setoran tunai ke pemilik beserta namanya", async () => {
    await uji.db.insert(ownerPayments).values({
      ownerId: idPemilik,
      tanggal: HARI,
      jumlah: 40000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    const [baris] = (await rincianKasHarian(idRina, HARI)).setoranPemilikTunai;

    expect(baris.namaPemilik).toBe("Pak Dedi");
    expect(baris.jumlah).toBe(40000);
  });
});

describe("rincian harus menjumlah persis seperti rekapnya", () => {
  it("penjumlahan tiap bagian sama dengan angka rekap", async () => {
    // Inilah jaminan yang sesungguhnya. Rincian yang tidak menjumlah ke angka
    // yang ditandatangani membuat pemeriksaan jadi teater.
    await rentalSelesai({ total: 45000, metode: "tunai" });
    await rentalSelesai({ total: 30000, metode: "tunai" });
    await rentalSelesai({ total: 90000, metode: "qris" });

    await uji.db.insert(expenses).values({
      tanggal: HARI,
      kategori: "operasional",
      keterangan: "Bensin",
      jumlah: 20000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    await uji.db.insert(ownerPayments).values({
      ownerId: idPemilik,
      tanggal: HARI,
      jumlah: 15000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    const { rekapKasHarian } = await import("@/lib/kas/kelola");
    const rekap = await rekapKasHarian(idRina, HARI);
    const rincian = await rincianKasHarian(idRina, HARI);

    const jumlah = (baris: { jumlah: number }[]) =>
      baris.reduce((total, b) => total + b.jumlah, 0);

    expect(jumlah(rincian.rentalTunai)).toBe(rekap.penerimaanTunai);
    expect(jumlah(rincian.pengeluaranTunai)).toBe(rekap.pengeluaranTunai);
    expect(jumlah(rincian.setoranPemilikTunai)).toBe(rekap.setoranPemilikTunai);

    expect(
      jumlah(rincian.rentalTunai) -
        jumlah(rincian.pengeluaranTunai) -
        jumlah(rincian.setoranPemilikTunai),
    ).toBe(rekap.jumlahSeharusnya);
  });
});

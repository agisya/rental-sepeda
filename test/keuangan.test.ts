import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import {
  bikes,
  expenses,
  maintenances,
  ownerPayments,
  owners,
  renters,
  rentals,
  users,
} from "@/lib/db/schema";
import { labaRugi, saldoSemuaPemilik, totalPengeluaran } from "@/lib/queries/keuangan";
import { laporanPeriode, penggunaanSepeda, sepedaTidakDipakai } from "@/lib/queries/laporan";
import { hitungBiaya } from "@/lib/rental/pricing";
import { rentangBulanWib, rentangHariWib, rentangMingguWib } from "@/lib/waktu";

let uji: DbUji;
let idPemilikA: number;
let idPemilikB: number;
let idSepedaA: number;
let idSepedaB: number;
let idPenyewa: number;
let idPetugas: number;

const TARIF = 15_000;

beforeAll(async () => {
  uji = await buatDbUji();

  const [a] = await uji.db
    .insert(owners)
    .values({ nama: "Budi", noHp: "081200000000", persentaseBagiHasil: 60 })
    .returning({ id: owners.id });
  idPemilikA = a.id;

  const [b] = await uji.db
    .insert(owners)
    .values({ nama: "Andi", noHp: "081200000009", persentaseBagiHasil: 50 })
    .returning({ id: owners.id });
  idPemilikB = b.id;

  const [sa] = await uji.db
    .insert(bikes)
    .values({ kode: "MTB-001", nama: "Xtrada", jenis: "MTB", tarifPerJam: TARIF, ownerId: idPemilikA })
    .returning({ id: bikes.id });
  idSepedaA = sa.id;

  const [sb] = await uji.db
    .insert(bikes)
    .values({ kode: "CTY-001", nama: "Troy", jenis: "City", tarifPerJam: 10_000, ownerId: idPemilikB })
    .returning({ id: bikes.id });
  idSepedaB = sb.id;

  const [p] = await uji.db
    .insert(renters)
    .values({ nama: "Asep", noHp: "081200000001" })
    .returning({ id: renters.id });
  idPenyewa = p.id;

  const [u] = await uji.db
    .insert(users)
    .values({ username: "admin", passwordHash: "x", nama: "Admin", peran: "admin" })
    .returning({ id: users.id });
  idPetugas = u.id;
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(expenses);
  await uji.db.delete(maintenances);
  await uji.db.delete(ownerPayments);
  await uji.db.delete(rentals);
});

/** Rental selesai dengan perhitungan yang sama seperti yang dipakai aplikasi. */
async function rentalSelesai(opsi: {
  bikeId: number;
  ownerId: number;
  persen: number;
  tarif: number;
  mulaiISO: string;
  jam: number;
}) {
  const waktuMulai = new Date(opsi.mulaiISO);
  const waktuSelesai = new Date(waktuMulai.getTime() + opsi.jam * 60 * 60 * 1000);
  const biaya = hitungBiaya({
    waktuMulai,
    waktuSelesai,
    tarifPerJam: opsi.tarif,
    persentasePemilik: opsi.persen,
    toleransiMenit: 5,
  });

  await uji.db.insert(rentals).values({
    bikeId: opsi.bikeId,
    renterId: idPenyewa,
    kasirId: idPetugas,
    ownerIdSnapshot: opsi.ownerId,
    tarifPerJamSnapshot: opsi.tarif,
    persentasePemilikSnapshot: opsi.persen,
    waktuMulai,
    waktuSelesai,
    status: "selesai",
    durasiMenit: biaya.durasiMenit,
    durasiJamDitagih: biaya.durasiJamDitagih,
    totalBiaya: biaya.totalBiaya,
    bagianPemilik: biaya.bagianPemilik,
    bagianRental: biaya.bagianRental,
    metodeBayar: "tunai",
  });

  return biaya;
}

// 20 Agustus 2026, 09:00 WIB
const HARI = "2026-08-20T02:00:00.000Z";
const ACUAN = new Date(HARI);

describe("laba rugi", () => {
  // Ini kesalahan paling mahal yang bisa terjadi di aplikasi bagi hasil:
  // mengurangkan pengeluaran dari omzet kotor, padahal sebagian besar omzet itu
  // milik pemilik sepeda dan wajib disetorkan.
  it("menghitung laba dari bagian rental, bukan dari omzet kotor", async () => {
    await rentalSelesai({
      bikeId: idSepedaA,
      ownerId: idPemilikA,
      persen: 60,
      tarif: TARIF,
      mulaiISO: HARI,
      jam: 2,
    });

    await uji.db.insert(expenses).values({
      tanggal: ACUAN,
      kategori: "listrik",
      keterangan: "Listrik",
      jumlah: 10_000,
      dicatatOleh: idPetugas,
    });

    const hasil = await labaRugi(rentangHariWib(ACUAN));

    expect(hasil.omzetKotor).toBe(30_000);
    expect(hasil.bagianPemilik).toBe(18_000);
    expect(hasil.pendapatanRental).toBe(12_000);
    expect(hasil.pengeluaran).toBe(10_000);

    // Yang benar: 12.000 − 10.000 = 2.000
    expect(hasil.labaBersih).toBe(2_000);
    // Yang salah dan harus dihindari: 30.000 − 10.000 = 20.000
    expect(hasil.labaBersih).not.toBe(20_000);
  });

  it("melaporkan rugi sebagai angka negatif, bukan nol", async () => {
    await rentalSelesai({
      bikeId: idSepedaA,
      ownerId: idPemilikA,
      persen: 60,
      tarif: TARIF,
      mulaiISO: HARI,
      jam: 1,
    });

    await uji.db.insert(expenses).values({
      tanggal: ACUAN,
      kategori: "gaji",
      keterangan: "Gaji",
      jumlah: 100_000,
      dicatatOleh: idPetugas,
    });

    const hasil = await labaRugi(rentangHariWib(ACUAN));
    expect(hasil.pendapatanRental).toBe(6_000);
    expect(hasil.labaBersih).toBe(-94_000);
  });

  it("tetap menjaga omzet sama dengan jumlah kedua bagian", async () => {
    await rentalSelesai({ bikeId: idSepedaA, ownerId: idPemilikA, persen: 60, tarif: 17_777, mulaiISO: HARI, jam: 3 });
    await rentalSelesai({ bikeId: idSepedaB, ownerId: idPemilikB, persen: 50, tarif: 10_000, mulaiISO: HARI, jam: 2 });

    const hasil = await labaRugi(rentangHariWib(ACUAN));
    expect(hasil.bagianPemilik + hasil.pendapatanRental).toBe(hasil.omzetKotor);
  });

  it("tidak menghitung pengeluaran dari hari lain", async () => {
    await uji.db.insert(expenses).values({
      tanggal: new Date("2026-08-19T02:00:00.000Z"),
      kategori: "listrik",
      keterangan: "Kemarin",
      jumlah: 50_000,
      dicatatOleh: idPetugas,
    });

    expect(await totalPengeluaran(rentangHariWib(ACUAN))).toBe(0);
    expect(await totalPengeluaran(rentangMingguWib(ACUAN))).toBe(50_000);
  });
});

describe("biaya maintenance tidak terhitung dua kali", () => {
  it("hanya dihitung dari tabel pengeluaran, bukan dari tabel maintenance", async () => {
    const [m] = await uji.db
      .insert(maintenances)
      .values({
        bikeId: idSepedaA,
        tanggal: ACUAN,
        jenis: "sparepart",
        deskripsi: "Ganti kampas rem",
        biaya: 75_000,
        dicatatOleh: idPetugas,
      })
      .returning({ id: maintenances.id });

    await uji.db.insert(expenses).values({
      tanggal: ACUAN,
      kategori: "sparepart",
      keterangan: "Ganti kampas rem",
      jumlah: 75_000,
      maintenanceId: m.id,
      dicatatOleh: idPetugas,
    });

    // Biaya tercatat di dua tabel, tapi hanya boleh terhitung sekali.
    expect(await totalPengeluaran(rentangHariWib(ACUAN))).toBe(75_000);
  });

  it("menghapus maintenance ikut menghapus pengeluarannya", async () => {
    const [m] = await uji.db
      .insert(maintenances)
      .values({
        bikeId: idSepedaA,
        tanggal: ACUAN,
        jenis: "servis",
        deskripsi: "Servis rutin",
        biaya: 50_000,
        dicatatOleh: idPetugas,
      })
      .returning({ id: maintenances.id });

    await uji.db.insert(expenses).values({
      tanggal: ACUAN,
      kategori: "maintenance",
      keterangan: "Servis rutin",
      jumlah: 50_000,
      maintenanceId: m.id,
      dicatatOleh: idPetugas,
    });

    expect(await totalPengeluaran(rentangHariWib(ACUAN))).toBe(50_000);

    await uji.db.delete(maintenances);
    expect(await totalPengeluaran(rentangHariWib(ACUAN))).toBe(0);
  });
});

describe("saldo bagi hasil pemilik", () => {
  it("menghitung sisa dari hak dikurangi setoran", async () => {
    await rentalSelesai({ bikeId: idSepedaA, ownerId: idPemilikA, persen: 60, tarif: TARIF, mulaiISO: HARI, jam: 2 });

    let saldo = (await saldoSemuaPemilik()).find((s) => s.ownerId === idPemilikA)!;
    expect(saldo.totalHak).toBe(18_000);
    expect(saldo.sudahDibayar).toBe(0);
    expect(saldo.sisa).toBe(18_000);

    await uji.db.insert(ownerPayments).values({
      ownerId: idPemilikA,
      tanggal: ACUAN,
      jumlah: 10_000,
      metode: "tunai",
      dicatatOleh: idPetugas,
    });

    saldo = (await saldoSemuaPemilik()).find((s) => s.ownerId === idPemilikA)!;
    expect(saldo.sudahDibayar).toBe(10_000);
    expect(saldo.sisa).toBe(8_000);
  });

  // Dua tabel bercabang dari owners. Kalau digabung dalam satu query dengan join,
  // barisnya berlipat dan kedua penjumlahan jadi salah.
  it("tidak menggandakan angka saat pemilik punya banyak rental dan banyak setoran", async () => {
    for (let i = 0; i < 3; i += 1) {
      await rentalSelesai({
        bikeId: idSepedaA,
        ownerId: idPemilikA,
        persen: 60,
        tarif: TARIF,
        mulaiISO: `2026-08-2${i}T02:00:00.000Z`,
        jam: 1,
      });
    }
    for (let i = 0; i < 4; i += 1) {
      await uji.db.insert(ownerPayments).values({
        ownerId: idPemilikA,
        tanggal: ACUAN,
        jumlah: 1_000,
        metode: "tunai",
        dicatatOleh: idPetugas,
      });
    }

    const saldo = (await saldoSemuaPemilik()).find((s) => s.ownerId === idPemilikA)!;

    // 3 rental × 1 jam × 15.000 × 60% = 27.000. Bukan 27.000 × 4.
    expect(saldo.totalHak).toBe(27_000);
    // 4 setoran × 1.000 = 4.000. Bukan 4.000 × 3.
    expect(saldo.sudahDibayar).toBe(4_000);
    expect(saldo.sisa).toBe(23_000);
  });

  it("memisahkan saldo antar pemilik", async () => {
    await rentalSelesai({ bikeId: idSepedaA, ownerId: idPemilikA, persen: 60, tarif: TARIF, mulaiISO: HARI, jam: 2 });
    await rentalSelesai({ bikeId: idSepedaB, ownerId: idPemilikB, persen: 50, tarif: 10_000, mulaiISO: HARI, jam: 2 });

    const semua = await saldoSemuaPemilik();
    expect(semua.find((s) => s.ownerId === idPemilikA)!.totalHak).toBe(18_000);
    expect(semua.find((s) => s.ownerId === idPemilikB)!.totalHak).toBe(10_000);
  });
});

describe("laporan periode", () => {
  it("mingguan dan harian memberi angka yang saling konsisten", async () => {
    await rentalSelesai({ bikeId: idSepedaA, ownerId: idPemilikA, persen: 60, tarif: TARIF, mulaiISO: HARI, jam: 2 });
    await rentalSelesai({
      bikeId: idSepedaB,
      ownerId: idPemilikB,
      persen: 50,
      tarif: 10_000,
      mulaiISO: "2026-08-21T02:00:00.000Z",
      jam: 3,
    });

    const harian = await laporanPeriode(rentangHariWib(ACUAN));
    const mingguan = await laporanPeriode(rentangMingguWib(ACUAN));

    expect(harian.ringkasan.totalOmzet).toBe(30_000);
    expect(mingguan.ringkasan.totalOmzet).toBe(60_000);
    expect(mingguan.perHari).toHaveLength(2);
    expect(mingguan.jumlahHari).toBe(7);
  });

  it("mengelompokkan per hari menurut WIB, bukan UTC", async () => {
    // Selesai 23:30 WIB tanggal 20 = 16:30 UTC. Kalau dikelompokkan pakai UTC,
    // ia tetap tanggal 20; yang berbahaya adalah 00:30 WIB tanggal 21.
    await rentalSelesai({
      bikeId: idSepedaA,
      ownerId: idPemilikA,
      persen: 60,
      tarif: TARIF,
      mulaiISO: "2026-08-20T15:30:00.000Z", // 22:30 WIB
      jam: 1, // selesai 23:30 WIB tanggal 20
    });
    await rentalSelesai({
      bikeId: idSepedaB,
      ownerId: idPemilikB,
      persen: 50,
      tarif: 10_000,
      mulaiISO: "2026-08-20T16:30:00.000Z", // 23:30 WIB
      jam: 1, // selesai 00:30 WIB tanggal 21
    });

    const mingguan = await laporanPeriode(rentangMingguWib(ACUAN));
    const tanggal = mingguan.perHari.map((h) => h.tanggal);

    expect(tanggal).toEqual(["2026-08-20", "2026-08-21"]);
  });

  it("menemukan hari teramai dan tersepi hanya dari hari yang ada transaksinya", async () => {
    await rentalSelesai({ bikeId: idSepedaA, ownerId: idPemilikA, persen: 60, tarif: TARIF, mulaiISO: HARI, jam: 4 });
    await rentalSelesai({
      bikeId: idSepedaB,
      ownerId: idPemilikB,
      persen: 50,
      tarif: 10_000,
      mulaiISO: "2026-08-21T02:00:00.000Z",
      jam: 1,
    });

    const mingguan = await laporanPeriode(rentangMingguWib(ACUAN));

    expect(mingguan.hariTeramai?.tanggal).toBe("2026-08-20");
    expect(mingguan.hariTeramai?.totalOmzet).toBe(60_000);
    // Hari tanpa transaksi sama sekali tidak boleh dianggap "hari tersepi".
    expect(mingguan.hariTersepi?.tanggal).toBe("2026-08-21");
    expect(mingguan.hariTersepi?.totalOmzet).toBe(10_000);
  });

  it("mendaftar sepeda yang sama sekali tidak dipakai", async () => {
    await rentalSelesai({ bikeId: idSepedaA, ownerId: idPemilikA, persen: 60, tarif: TARIF, mulaiISO: HARI, jam: 2 });

    const rentang = rentangBulanWib(ACUAN);
    const dipakai = await penggunaanSepeda(rentang);
    const menganggur = await sepedaTidakDipakai(rentang);

    expect(dipakai.map((d) => d.kode)).toEqual(["MTB-001"]);
    // Sepeda yang nol kali dipakai tidak punya baris rental sama sekali, jadi ia
    // tidak akan pernah muncul di hasil pengelompokan dan harus dicari terpisah.
    expect(menganggur.map((m) => m.kode)).toEqual(["CTY-001"]);
  });
});

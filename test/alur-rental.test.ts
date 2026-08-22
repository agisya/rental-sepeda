import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import { bikes, owners, renters, rentals, users } from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { hitungBiaya } from "@/lib/rental/pricing";
import { rentangHariWib } from "@/lib/waktu";
import {
  bagiHasilSemuaPemilik,
  daftarTransaksi,
  rentalBerjalanUntukSepeda,
  ringkasanPeriode,
} from "@/lib/queries/rentals";
import { sepedaByKode, statistikBulananSepeda } from "@/lib/queries/bikes";
import { bagiHasilPemilik, daftarPemilik } from "@/lib/queries/owners";
import { daftarPenyewa } from "@/lib/queries/renters";
import { ringkasanDashboard, rentalTerlaluLama } from "@/lib/queries/dashboard";

let uji: DbUji;
let idPemilik: number;
let idSepeda: number;
let idKasir: number;
let idPenyewa: number;

const TARIF = 15_000;
const PERSEN = 60;

beforeAll(async () => {
  uji = await buatDbUji();

  const [pemilik] = await uji.db
    .insert(owners)
    .values({ nama: "Budi Santoso", noHp: "081234567890", persentaseBagiHasil: PERSEN })
    .returning({ id: owners.id });
  idPemilik = pemilik.id;

  const [sepeda] = await uji.db
    .insert(bikes)
    .values({
      kode: "MTB-023",
      nama: "Polygon Xtrada 7",
      jenis: "MTB",
      tarifPerJam: TARIF,
      ownerId: idPemilik,
    })
    .returning({ id: bikes.id });
  idSepeda = sepeda.id;

  const [kasir] = await uji.db
    .insert(users)
    .values({ username: "kasir", passwordHash: "x", nama: "Rina", peran: "kasir" })
    .returning({ id: users.id });
  idKasir = kasir.id;

  const [penyewa] = await uji.db
    .insert(renters)
    .values({ nama: "Asep", noHp: "081200000001" })
    .returning({ id: renters.id });
  idPenyewa = penyewa.id;
});

afterAll(async () => {
  await uji.tutup();
});

function nilaiRentalBaru(waktuMulai: Date) {
  return {
    bikeId: idSepeda,
    renterId: idPenyewa,
    kasirId: idKasir,
    ownerIdSnapshot: idPemilik,
    tarifPerJamSnapshot: TARIF,
    persentasePemilikSnapshot: PERSEN,
    waktuMulai,
    status: "berjalan" as const,
  };
}

describe("skema database", () => {
  it("menjalankan seluruh migrasi dan membentuk 5 tabel", async () => {
    const hasil = await uji.klien.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    const tabel = hasil.rows.map((r) => r.table_name);

    // Sengaja memeriksa keberadaan, bukan daftar persis: menambah tabel untuk
    // fitur baru tidak boleh membuat uji alur rental ikut gagal.
    for (const wajib of ["bikes", "owners", "rentals", "renters", "users"]) {
      expect(tabel).toContain(wajib);
    }
  });

  // Ini penjaga terpenting di database: dua petugas yang menekan START pada
  // sepeda yang sama tidak boleh menghasilkan dua rental berjalan.
  //
  // Uji ini sekaligus memastikan pelanggaranUnik() mengenali galatnya. Drizzle
  // membungkus galat driver, sehingga kode SQLSTATE hanya ada di rantai cause.
  it("menolak rental berjalan kedua untuk sepeda yang sama", async () => {
    const mulai = new Date("2026-08-14T02:00:00.000Z");
    await uji.db.insert(rentals).values(nilaiRentalBaru(mulai));

    let tertangkap: unknown;
    try {
      await uji.db.insert(rentals).values(nilaiRentalBaru(mulai));
    } catch (galat) {
      tertangkap = galat;
    } finally {
      await uji.db.delete(rentals);
    }

    expect(tertangkap).toBeDefined();
    expect(pelanggaranUnik(tertangkap)).toBe(true);
  });

  it("mengizinkan rental baru setelah yang sebelumnya selesai", async () => {
    const mulai = new Date("2026-08-14T02:00:00.000Z");
    const [lama] = await uji.db
      .insert(rentals)
      .values(nilaiRentalBaru(mulai))
      .returning({ id: rentals.id });

    await uji.db
      .update(rentals)
      .set({ status: "selesai", waktuSelesai: new Date("2026-08-14T03:00:00.000Z") })
      .where(eq(rentals.id, lama.id));

    await expect(
      uji.db.insert(rentals).values(nilaiRentalBaru(new Date("2026-08-14T05:00:00.000Z"))),
    ).resolves.toBeDefined();

    await uji.db.delete(rentals);
  });
});

describe("query yang dipakai halaman", () => {
  it("menemukan sepeda dari kode QR beserta data pemiliknya", async () => {
    const sepeda = await sepedaByKode("mtb-023");

    expect(sepeda).not.toBeNull();
    expect(sepeda!.nama).toBe("Polygon Xtrada 7");
    expect(sepeda!.namaPemilik).toBe("Budi Santoso");
    expect(sepeda!.persentasePemilik).toBe(PERSEN);
    expect(sepeda!.tarifPerJam).toBe(TARIF);
  });

  it("mengembalikan null untuk kode yang tidak terdaftar", async () => {
    await expect(sepedaByKode("TIDAK-ADA")).resolves.toBeNull();
  });
});

describe("satu rental selesai, dari mulai sampai masuk laporan", () => {
  const mulai = new Date("2026-08-14T02:00:00.000Z"); // 09:00 WIB
  const selesai = new Date("2026-08-14T03:10:00.000Z"); // 10:10 WIB — 1 jam 10 menit
  let idRental: number;

  beforeAll(async () => {
    await uji.db.delete(rentals);

    const [baru] = await uji.db
      .insert(rentals)
      .values(nilaiRentalBaru(mulai))
      .returning({ id: rentals.id });
    idRental = baru.id;

    await uji.db.update(bikes).set({ status: "disewa" }).where(eq(bikes.id, idSepeda));
  });

  it("menemukan rental berjalan lewat sepedanya", async () => {
    const berjalan = await rentalBerjalanUntukSepeda(idSepeda);

    expect(berjalan?.id).toBe(idRental);
    expect(berjalan?.namaPenyewa).toBe("Asep");
    expect(berjalan?.namaPemilik).toBe("Budi Santoso");
    expect(berjalan?.namaKasir).toBe("Rina");
  });

  it("menghitung dan menyimpan biaya sesuai aturan pokok + tambahan", async () => {
    const biaya = hitungBiaya({
      waktuMulai: mulai,
      waktuSelesai: selesai,
      tarifPerJam: TARIF,
      persentasePemilik: PERSEN,
      toleransiMenit: 5,
    });

    // 1 jam 10 menit: pokoknya 1 jam, dan 10 menit sisanya melewati toleransi
    // sehingga disarankan satu blok setengah jam. Dulu durasi ini ditagih 2 jam
    // penuh — perilaku itulah yang sengaja dibuang.
    expect(biaya.durasiJamDitagih).toBe(1);
    expect(biaya.sisaMenit).toBe(10);
    expect(biaya.tambahanSaran).toBe(7_500);
    expect(biaya.totalBiaya).toBe(22_500);
    expect(biaya.bagianPemilik).toBe(13_500);
    expect(biaya.bagianRental).toBe(9_000);

    await uji.db
      .update(rentals)
      .set({
        status: "selesai",
        waktuSelesai: selesai,
        durasiMenit: biaya.durasiMenit,
        durasiJamDitagih: biaya.durasiJamDitagih,
        // Ikut disimpan supaya baris ini tetap masuk akal dibaca: totalBiaya
        // sudah memuat denda, jadi tanpa kedua kolom ini rincian rentalnya
        // tidak akan pernah berjumlah sama dengan totalnya.
        tambahanSaran: biaya.tambahanSaran,
        tambahanDitagih: biaya.tambahanDitagih,
        totalBiaya: biaya.totalBiaya,
        bagianPemilik: biaya.bagianPemilik,
        bagianRental: biaya.bagianRental,
        metodeBayar: "tunai",
      })
      .where(eq(rentals.id, idRental));

    await uji.db.update(bikes).set({ status: "tersedia" }).where(eq(bikes.id, idSepeda));
  });

  it("masuk ke laporan harian pada tanggal WIB yang benar", async () => {
    const ringkasan = await ringkasanPeriode(rentangHariWib(selesai));

    expect(ringkasan.jumlahTransaksi).toBe(1);
    expect(ringkasan.jumlahSepedaDipakai).toBe(1);
    // Jam pokok, bukan pembulatan ke atas. Sewa 1 jam 10 menit menyumbang 1 jam
    // ke laporan, dan 10 menit sisanya masuk sebagai uang denda — bukan sebagai
    // satu jam pemakaian yang tidak pernah terjadi.
    expect(ringkasan.totalJam).toBe(1);
    expect(ringkasan.totalOmzet).toBe(22_500);
    expect(ringkasan.totalBagianPemilik).toBe(13_500);
    expect(ringkasan.totalBagianRental).toBe(9_000);
  });

  it("menjaga omzet sama dengan jumlah kedua bagian", async () => {
    const r = await ringkasanPeriode(rentangHariWib(selesai));
    expect(r.totalBagianPemilik + r.totalBagianRental).toBe(r.totalOmzet);
  });

  it("tidak muncul di laporan hari sebelumnya maupun sesudahnya", async () => {
    const kemarin = await ringkasanPeriode(
      rentangHariWib(new Date("2026-08-13T05:00:00.000Z")),
    );
    const besok = await ringkasanPeriode(
      rentangHariWib(new Date("2026-08-15T05:00:00.000Z")),
    );

    expect(kemarin.jumlahTransaksi).toBe(0);
    expect(besok.jumlahTransaksi).toBe(0);
  });

  it("masuk rekap bagi hasil pemilik dengan angka yang sama", async () => {
    const rekap = await bagiHasilSemuaPemilik(rentangHariWib(selesai));

    expect(rekap).toHaveLength(1);
    expect(rekap[0].namaPemilik).toBe("Budi Santoso");
    expect(rekap[0].omzetKotor).toBe(22_500);
    expect(rekap[0].bagianPemilik).toBe(13_500);

    const perPemilik = await bagiHasilPemilik(idPemilik, rentangHariWib(selesai));
    expect(perPemilik.bagianPemilik).toBe(rekap[0].bagianPemilik);
  });

  it("terhitung pada statistik bulanan sepeda", async () => {
    const statistik = await statistikBulananSepeda(idSepeda, selesai);

    expect(statistik.jumlahRental).toBe(1);
    expect(statistik.totalJam).toBe(1);
    expect(statistik.totalOmzet).toBe(22_500);
  });

  it("muncul di daftar transaksi lengkap dengan relasinya", async () => {
    const daftar = await daftarTransaksi({ rentang: rentangHariWib(mulai) });

    expect(daftar).toHaveLength(1);
    expect(daftar[0].kodeSepeda).toBe("MTB-023");
    expect(daftar[0].namaPenyewa).toBe("Asep");
    expect(daftar[0].totalBiaya).toBe(22_500);
  });

  it("terhitung pada ringkasan penyewa", async () => {
    const penyewa = await daftarPenyewa();

    expect(penyewa).toHaveLength(1);
    expect(penyewa[0].nama).toBe("Asep");
    expect(penyewa[0].jumlahRental).toBe(1);
    expect(penyewa[0].totalBelanja).toBe(22_500);
    expect(penyewa[0].sedangMenyewa).toBe(0);
  });

  it("menampilkan jumlah sepeda pada daftar pemilik", async () => {
    const pemilik = await daftarPemilik();

    expect(pemilik).toHaveLength(1);
    expect(pemilik[0].jumlahSepeda).toBe(1);
    expect(pemilik[0].persentaseBagiHasil).toBe(PERSEN);
  });

  it("menghitung status armada dan omzet hari ini pada dashboard", async () => {
    const dashboard = await ringkasanDashboard(selesai);

    expect(dashboard.status.total).toBe(1);
    expect(dashboard.status.tersedia).toBe(1);
    expect(dashboard.status.disewa).toBe(0);
    expect(dashboard.rentalBerjalan).toBe(0);
    expect(dashboard.hariIni.totalOmzet).toBe(22_500);
  });
});

describe("transaksi lintas tengah malam WIB", () => {
  it("rental yang dimulai pukul 23:30 WIB tetap tercatat pada tanggal itu", async () => {
    await uji.db.delete(rentals);

    const mulai = new Date("2026-08-14T16:30:00.000Z"); // 23:30 WIB tanggal 14
    const selesai = new Date("2026-08-14T17:30:00.000Z"); // 00:30 WIB tanggal 15

    await uji.db.insert(rentals).values({
      ...nilaiRentalBaru(mulai),
      status: "selesai",
      waktuSelesai: selesai,
      durasiMenit: 60,
      durasiJamDitagih: 1,
      totalBiaya: TARIF,
      bagianPemilik: 9_000,
      bagianRental: 6_000,
      metodeBayar: "tunai",
    });

    // Daftar transaksi dikelompokkan menurut waktu mulai — masuk tanggal 14.
    const tanggal14 = await daftarTransaksi({
      rentang: rentangHariWib(new Date("2026-08-14T05:00:00.000Z")),
    });
    expect(tanggal14).toHaveLength(1);

    // Omzet dihitung menurut waktu selesai — masuk tanggal 15.
    const omzet14 = await ringkasanPeriode(
      rentangHariWib(new Date("2026-08-14T05:00:00.000Z")),
    );
    const omzet15 = await ringkasanPeriode(
      rentangHariWib(new Date("2026-08-15T05:00:00.000Z")),
    );

    expect(omzet14.totalOmzet).toBe(0);
    expect(omzet15.totalOmzet).toBe(TARIF);
  });
});

describe("peringatan sepeda belum kembali", () => {
  it("menandai rental yang berjalan lebih dari batas jam", async () => {
    await uji.db.delete(rentals);

    const sekarang = new Date("2026-08-14T10:00:00.000Z");
    const lama = new Date("2026-08-13T20:00:00.000Z"); // 14 jam sebelumnya

    await uji.db.insert(rentals).values(nilaiRentalBaru(lama));

    const bermasalah = await rentalTerlaluLama(12, sekarang);
    expect(bermasalah).toHaveLength(1);
    expect(bermasalah[0].kodeSepeda).toBe("MTB-023");

    const belum = await rentalTerlaluLama(24, sekarang);
    expect(belum).toHaveLength(0);
  });
});

describe("perubahan tarif tidak mengubah transaksi lama", () => {
  it("laporan lama tetap memakai nilai snapshot setelah tarif dinaikkan", async () => {
    await uji.db.delete(rentals);

    const selesai = new Date("2026-08-14T03:00:00.000Z");
    await uji.db.insert(rentals).values({
      ...nilaiRentalBaru(new Date("2026-08-14T02:00:00.000Z")),
      status: "selesai",
      waktuSelesai: selesai,
      durasiMenit: 60,
      durasiJamDitagih: 1,
      totalBiaya: TARIF,
      bagianPemilik: 9_000,
      bagianRental: 6_000,
      metodeBayar: "tunai",
    });

    // Tarif dinaikkan dan persentase pemilik diubah setelah transaksi tercatat.
    await uji.db.update(bikes).set({ tarifPerJam: 25_000 }).where(eq(bikes.id, idSepeda));
    await uji.db
      .update(owners)
      .set({ persentaseBagiHasil: 80 })
      .where(eq(owners.id, idPemilik));

    const ringkasan = await ringkasanPeriode(rentangHariWib(selesai));

    expect(ringkasan.totalOmzet).toBe(TARIF);
    expect(ringkasan.totalBagianPemilik).toBe(9_000);
    expect(ringkasan.totalBagianRental).toBe(6_000);

    const [baris] = await uji.db
      .select({
        tarif: rentals.tarifPerJamSnapshot,
        persen: rentals.persentasePemilikSnapshot,
      })
      .from(rentals)
      .limit(1);

    expect(baris.tarif).toBe(TARIF);
    expect(baris.persen).toBe(PERSEN);

    // Kembalikan supaya rangkaian uji lain tidak terpengaruh.
    await uji.db.update(bikes).set({ tarifPerJam: TARIF }).where(eq(bikes.id, idSepeda));
    await uji.db
      .update(owners)
      .set({ persentaseBagiHasil: PERSEN })
      .where(eq(owners.id, idPemilik));
  });
});

describe("uang tidak pernah hilang karena pembulatan", () => {
  it("total omzet selalu sama dengan jumlah kedua bagian pada banyak transaksi", async () => {
    await uji.db.delete(rentals);

    const kasus = [
      { menit: 45, persen: 33 },
      { menit: 61, persen: 55 },
      { menit: 130, persen: 67 },
      { menit: 187, persen: 45 },
      { menit: 359, persen: 70 },
    ];

    const mulaiDasar = new Date("2026-08-14T02:00:00.000Z");

    for (const [i, k] of kasus.entries()) {
      const mulai = new Date(mulaiDasar.getTime() + i * 6 * 60 * 60 * 1000);
      const selesai = new Date(mulai.getTime() + k.menit * 60_000);
      const biaya = hitungBiaya({
        waktuMulai: mulai,
        waktuSelesai: selesai,
        tarifPerJam: 17_777,
        persentasePemilik: k.persen,
        toleransiMenit: 5,
      });

      await uji.db.insert(rentals).values({
        bikeId: idSepeda,
        renterId: idPenyewa,
        kasirId: idKasir,
        ownerIdSnapshot: idPemilik,
        tarifPerJamSnapshot: 17_777,
        persentasePemilikSnapshot: k.persen,
        waktuMulai: mulai,
        waktuSelesai: selesai,
        status: "selesai",
        durasiMenit: biaya.durasiMenit,
        durasiJamDitagih: biaya.durasiJamDitagih,
        totalBiaya: biaya.totalBiaya,
        bagianPemilik: biaya.bagianPemilik,
        bagianRental: biaya.bagianRental,
        metodeBayar: "tunai",
      });
    }

    const [jumlah] = await uji.db
      .select({
        omzet: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)::int`,
        pemilik: sql<number>`coalesce(sum(${rentals.bagianPemilik}), 0)::int`,
        rental: sql<number>`coalesce(sum(${rentals.bagianRental}), 0)::int`,
      })
      .from(rentals);

    expect(jumlah.pemilik + jumlah.rental).toBe(jumlah.omzet);
  });
});

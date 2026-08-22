import "server-only";

import { and, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, owners, rentals, users } from "@/lib/db/schema";
import { jumlahHari, kunciTanggalWib } from "@/lib/waktu";
import { ringkasanPeriode, type RingkasanPeriode } from "./rentals";

export type Rentang = { mulai: Date; selesai: Date };

/**
 * Semua laporan periodik memakai fungsi yang sama, hanya rentangnya berbeda.
 * Dengan begitu laporan harian, mingguan, dan bulanan tidak mungkin memberi
 * angka yang saling bertentangan untuk periode yang sama.
 *
 * Sebuah rental dihitung pada periode saat ia DISELESAIKAN, karena di saat
 * itulah uangnya diterima dan bagi hasilnya ditetapkan.
 */

const syaratSelesai = (rentang: Rentang) =>
  and(
    eq(rentals.status, "selesai"),
    gte(rentals.waktuSelesai, rentang.mulai),
    lt(rentals.waktuSelesai, rentang.selesai),
  );

export type PenggunaanSepeda = {
  bikeId: number;
  kode: string;
  nama: string;
  namaPemilik: string;
  jumlahRental: number;
  totalJam: number;
  totalOmzet: number;
};

/** Penggunaan tiap sepeda pada satu periode, terurut dari yang paling produktif. */
export async function penggunaanSepeda(
  rentang: Rentang,
  batas?: number,
): Promise<PenggunaanSepeda[]> {
  const kueri = db
    .select({
      bikeId: bikes.id,
      kode: bikes.kode,
      nama: bikes.nama,
      namaPemilik: owners.nama,
      jumlahRental: sql<number>`count(*)::int`,
      totalJam: sql<number>`coalesce(sum(${rentals.durasiJamDitagih}), 0)::int`,
      totalOmzet: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)::int`,
    })
    .from(rentals)
    .innerJoin(bikes, eq(rentals.bikeId, bikes.id))
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .where(syaratSelesai(rentang))
    .groupBy(bikes.id, bikes.kode, bikes.nama, owners.nama)
    .orderBy(desc(sql`sum(${rentals.totalBiaya})`));

  return batas ? kueri.limit(batas) : kueri;
}

/**
 * Sepeda yang sama sekali tidak dipakai pada periode ini.
 *
 * Sengaja dihitung terpisah, bukan diambil dari ekor daftar penggunaan: sepeda
 * yang nol kali dipakai tidak punya baris rental sama sekali, jadi ia tidak akan
 * pernah muncul di hasil pengelompokan.
 */
export async function sepedaTidakDipakai(rentang: Rentang) {
  return db
    .select({
      bikeId: bikes.id,
      kode: bikes.kode,
      nama: bikes.nama,
      namaPemilik: owners.nama,
      status: bikes.status,
    })
    .from(bikes)
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .where(
      sql`not exists (
        select 1 from ${rentals}
        where ${rentals.bikeId} = ${bikes.id}
          and ${rentals.status} = 'selesai'
          and ${rentals.waktuSelesai} >= ${rentang.mulai}
          and ${rentals.waktuSelesai} < ${rentang.selesai}
      )`,
    )
    .orderBy(bikes.kode);
}

export type OmzetHarian = {
  tanggal: string;
  jumlahTransaksi: number;
  totalJam: number;
  totalOmzet: number;
};

/**
 * Omzet per hari dalam satu periode, dikelompokkan menurut tanggal WIB.
 *
 * Pengelompokan sengaja dilakukan di aplikasi memakai kunciTanggalWib(), bukan
 * dengan menggeser waktu di dalam SQL. Batas hari WIB sudah punya satu sumber
 * kebenaran yang teruji di lib/waktu.ts; menuliskan ulang aturan yang sama dalam
 * bentuk SQL berarti ada dua tempat yang harus selalu sepakat, dan salah satunya
 * pasti akan tertinggal saat aturannya berubah.
 *
 * Jumlah barisnya kecil — satu periode laporan paling banyak berisi transaksi
 * satu bulan — sehingga tidak ada gunanya menghemat dengan pengelompokan di SQL.
 */
export async function omzetPerHari(rentang: Rentang): Promise<OmzetHarian[]> {
  const baris = await db
    .select({
      waktuSelesai: rentals.waktuSelesai,
      durasiJamDitagih: rentals.durasiJamDitagih,
      totalBiaya: rentals.totalBiaya,
    })
    .from(rentals)
    .where(syaratSelesai(rentang));

  const perHari = new Map<string, OmzetHarian>();

  for (const r of baris) {
    if (!r.waktuSelesai) continue;
    const tanggal = kunciTanggalWib(r.waktuSelesai);

    const ada = perHari.get(tanggal) ?? {
      tanggal,
      jumlahTransaksi: 0,
      totalJam: 0,
      totalOmzet: 0,
    };

    ada.jumlahTransaksi += 1;
    ada.totalJam += r.durasiJamDitagih ?? 0;
    ada.totalOmzet += r.totalBiaya ?? 0;
    perHari.set(tanggal, ada);
  }

  return [...perHari.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

export type PotonganKasir = {
  kasirId: number;
  namaKasir: string;
  /** Banyaknya rental telat yang ditangani, bukan hanya yang diberi keringanan. */
  jumlahTelat: number;
  jumlahDiberiPotongan: number;
  totalSaran: number;
  totalDitagih: number;
  totalPotongan: number;
};

/**
 * Keringanan denda keterlambatan per petugas.
 *
 * Tanpa laporan ini, seluruh jejak `tambahanSaran` dan `tambahanDitagih` cuma
 * jadi kolom yang tidak pernah dibaca siapa pun — dan kolom yang tidak pernah
 * dibaca tidak mencegah apa-apa.
 *
 * Yang dihitung adalah petugas yang MENYELESAIKAN rental, bukan yang memulainya:
 * dialah yang memutuskan angkanya dan menerima uangnya.
 *
 * Sengaja menyertakan `jumlahTelat`, bukan hanya yang diberi potongan. Angka
 * "5 keringanan" tidak berarti apa-apa tanpa tahu itu dari 5 atau dari 50.
 */
export async function potonganPerKasir(rentang: Rentang): Promise<PotonganKasir[]> {
  const potongan = sql<number>`(${rentals.tambahanSaran} - ${rentals.tambahanDitagih})`;

  return db
    .select({
      kasirId: users.id,
      namaKasir: users.nama,
      jumlahTelat: sql<number>`count(*)::int`,
      jumlahDiberiPotongan: sql<number>`count(*) filter (where ${potongan} > 0)::int`,
      totalSaran: sql<number>`coalesce(sum(${rentals.tambahanSaran}), 0)::int`,
      totalDitagih: sql<number>`coalesce(sum(${rentals.tambahanDitagih}), 0)::int`,
      totalPotongan: sql<number>`coalesce(sum(${potongan}), 0)::int`,
    })
    .from(rentals)
    .innerJoin(users, eq(rentals.diselesaikanOleh, users.id))
    .where(and(syaratSelesai(rentang), gt(rentals.tambahanSaran, 0)))
    .groupBy(users.id, users.nama)
    .orderBy(desc(sql`sum(${potongan})`));
}

export type RincianPotongan = {
  rentalId: number;
  /** Boleh null: kolomnya memang nullable, dan tipenya tidak boleh berbohong. */
  waktuSelesai: Date | null;
  namaKasir: string;
  kodeSepeda: string;
  sisaMenit: number;
  saran: number;
  ditagih: number;
  alasan: string | null;
};

/**
 * Tiap keringanan satu per satu, lengkap dengan alasannya. Ringkasan per kasir
 * menunjukkan ada pola yang aneh; daftar inilah yang bisa ditanyakan orangnya.
 */
export async function rincianPotongan(
  rentang: Rentang,
  batas = 50,
): Promise<RincianPotongan[]> {
  return db
    .select({
      rentalId: rentals.id,
      // Kolomnya diambil langsung, TIDAK dibungkus sql<Date>. Pembungkusan itu
      // melewati mapFromDriverValue milik Drizzle — satu-satunya tempat nilai
      // mentah dari penggerak database diubah menjadi Date — sehingga yang
      // sampai ke komponen bisa berupa teks, dan formatTanggalJamWib menerima
      // sesuatu yang bukan tanggal.
      waktuSelesai: rentals.waktuSelesai,
      namaKasir: users.nama,
      kodeSepeda: bikes.kode,
      // Menit di luar jam pokok, dihitung ulang dari durasi yang tersimpan.
      // coalesce dipasang meski baris di kueri ini selalu punya kedua kolom:
      // aritmetika SQL dengan NULL menghasilkan NULL, dan tipe di TypeScript
      // tidak akan memperingatkan apa pun kalau itu terjadi.
      sisaMenit: sql<number>`coalesce(${rentals.durasiMenit} - ${rentals.durasiJamDitagih} * 60, 0)::int`,
      saran: sql<number>`coalesce(${rentals.tambahanSaran}, 0)::int`,
      ditagih: sql<number>`coalesce(${rentals.tambahanDitagih}, 0)::int`,
      alasan: rentals.alasanPotongan,
    })
    .from(rentals)
    .innerJoin(users, eq(rentals.diselesaikanOleh, users.id))
    .innerJoin(bikes, eq(rentals.bikeId, bikes.id))
    .where(
      and(
        syaratSelesai(rentang),
        gt(sql`${rentals.tambahanSaran} - ${rentals.tambahanDitagih}`, 0),
      ),
    )
    .orderBy(desc(rentals.waktuSelesai))
    .limit(batas);
}

export type LaporanPeriode = {
  rentang: Rentang;
  ringkasan: RingkasanPeriode;
  rataRataOmzetPerHari: number;
  jumlahHari: number;
  perHari: OmzetHarian[];
  hariTeramai: OmzetHarian | null;
  hariTersepi: OmzetHarian | null;
};

/**
 * Ringkasan satu periode beserta rinciannya per hari.
 *
 * "Hari tersepi" hanya dipilih dari hari yang benar-benar ada transaksinya.
 * Hari tanpa transaksi sama sekali bukan hari sepi melainkan hari libur atau
 * hari yang belum terjadi, dan memasukkannya akan selalu menghasilkan Rp0.
 */
export async function laporanPeriode(rentang: Rentang): Promise<LaporanPeriode> {
  const [ringkasan, perHari] = await Promise.all([
    ringkasanPeriode(rentang),
    omzetPerHari(rentang),
  ]);

  const hari = jumlahHari(rentang);
  const berisi = perHari.filter((h) => h.jumlahTransaksi > 0);

  const teramai = berisi.reduce<OmzetHarian | null>(
    (a, b) => (a === null || b.totalOmzet > a.totalOmzet ? b : a),
    null,
  );
  const tersepi = berisi.reduce<OmzetHarian | null>(
    (a, b) => (a === null || b.totalOmzet < a.totalOmzet ? b : a),
    null,
  );

  return {
    rentang,
    ringkasan,
    jumlahHari: hari,
    rataRataOmzetPerHari: Math.round(ringkasan.totalOmzet / hari),
    perHari,
    hariTeramai: teramai,
    hariTersepi: tersepi,
  };
}

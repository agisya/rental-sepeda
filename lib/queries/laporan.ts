import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, owners, rentals } from "@/lib/db/schema";
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

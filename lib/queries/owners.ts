import "server-only";

import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, owners, rentals } from "@/lib/db/schema";
import { rentangBulanWib } from "@/lib/waktu";

export type PemilikRingkas = {
  id: number;
  nama: string;
  noHp: string;
  alamat: string | null;
  persentaseBagiHasil: number;
  catatan: string | null;
  aktif: boolean;
  jumlahSepeda: number;
};

export async function daftarPemilik(): Promise<PemilikRingkas[]> {
  return db
    .select({
      id: owners.id,
      nama: owners.nama,
      noHp: owners.noHp,
      alamat: owners.alamat,
      persentaseBagiHasil: owners.persentaseBagiHasil,
      catatan: owners.catatan,
      aktif: owners.aktif,
      jumlahSepeda: sql<number>`count(${bikes.id})::int`,
    })
    .from(owners)
    .leftJoin(bikes, eq(bikes.ownerId, owners.id))
    .groupBy(owners.id)
    .orderBy(asc(owners.nama));
}

/** Pilihan pemilik pada form sepeda. Hanya yang masih aktif. */
export async function pilihanPemilik() {
  return db
    .select({
      id: owners.id,
      nama: owners.nama,
      persentaseBagiHasil: owners.persentaseBagiHasil,
    })
    .from(owners)
    .where(eq(owners.aktif, true))
    .orderBy(asc(owners.nama));
}

export async function pemilikById(id: number) {
  const [hasil] = await db.select().from(owners).where(eq(owners.id, id)).limit(1);
  return hasil ?? null;
}

export type BagiHasilPemilik = {
  jumlahRental: number;
  totalJam: number;
  omzetKotor: number;
  bagianPemilik: number;
  bagianRental: number;
};

/**
 * Rekap bagi hasil satu pemilik pada rentang waktu tertentu.
 *
 * Memakai kolom snapshot (owner_id_snapshot, bagian_pemilik) dan bukan menghitung
 * ulang dari persentase pemilik saat ini. Kalau persentase diubah, rekap bulan
 * lalu tetap menunjukkan angka yang dulu disepakati.
 */
export async function bagiHasilPemilik(
  ownerId: number,
  rentang: { mulai: Date; selesai: Date },
): Promise<BagiHasilPemilik> {
  const [hasil] = await db
    .select({
      jumlahRental: sql<number>`count(*)::int`,
      totalJam: sql<number>`coalesce(sum(${rentals.durasiJamDitagih}), 0)::int`,
      omzetKotor: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)::int`,
      bagianPemilik: sql<number>`coalesce(sum(${rentals.bagianPemilik}), 0)::int`,
      bagianRental: sql<number>`coalesce(sum(${rentals.bagianRental}), 0)::int`,
    })
    .from(rentals)
    .where(
      and(
        eq(rentals.ownerIdSnapshot, ownerId),
        eq(rentals.status, "selesai"),
        gte(rentals.waktuSelesai, rentang.mulai),
        lt(rentals.waktuSelesai, rentang.selesai),
      ),
    );

  return (
    hasil ?? {
      jumlahRental: 0,
      totalJam: 0,
      omzetKotor: 0,
      bagianPemilik: 0,
      bagianRental: 0,
    }
  );
}

export async function bagiHasilPemilikBulanIni(
  ownerId: number,
  sekarang: Date = new Date(),
): Promise<BagiHasilPemilik> {
  return bagiHasilPemilik(ownerId, rentangBulanWib(sekarang));
}

export async function sepedaMilikPemilik(ownerId: number) {
  return db
    .select({
      id: bikes.id,
      kode: bikes.kode,
      nama: bikes.nama,
      jenis: bikes.jenis,
      tarifPerJam: bikes.tarifPerJam,
      status: bikes.status,
    })
    .from(bikes)
    .where(eq(bikes.ownerId, ownerId))
    .orderBy(asc(bikes.kode));
}

export async function pemilikPunyaSepeda(ownerId: number): Promise<boolean> {
  const [hasil] = await db
    .select({ id: bikes.id })
    .from(bikes)
    .where(eq(bikes.ownerId, ownerId))
    .limit(1);

  return Boolean(hasil);
}

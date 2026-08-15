import "server-only";

import { and, asc, eq, gte, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, owners, rentals, type StatusSepeda } from "@/lib/db/schema";
import { rentangBulanWib } from "@/lib/waktu";
import { normalkanKode } from "@/lib/format";

const kolomSepeda = {
  id: bikes.id,
  kode: bikes.kode,
  nama: bikes.nama,
  jenis: bikes.jenis,
  merk: bikes.merk,
  fotoUrl: bikes.fotoUrl,
  fotoVersi: bikes.fotoVersi,
  // Isi fotonya sendiri tidak pernah ikut ditarik: satu daftar berisi puluhan
  // sepeda akan memindahkan berpuluh megabita tanpa guna. Yang dibawa hanya
  // penanda ada-tidaknya foto; gambarnya diambil terpisah lewat rute gambar.
  punyaFoto: sql<boolean>`${bikes.fotoData} is not null`,
  tarifPerJam: bikes.tarifPerJam,
  status: bikes.status,
  catatan: bikes.catatan,
  ownerId: bikes.ownerId,
  namaPemilik: owners.nama,
  noHpPemilik: owners.noHp,
  persentasePemilik: owners.persentaseBagiHasil,
};

export type SepedaDenganPemilik = {
  id: number;
  kode: string;
  nama: string;
  jenis: string;
  merk: string | null;
  fotoUrl: string | null;
  fotoVersi: number;
  punyaFoto: boolean;
  tarifPerJam: number;
  status: StatusSepeda;
  catatan: string | null;
  ownerId: number;
  namaPemilik: string;
  noHpPemilik: string;
  persentasePemilik: number;
};

export async function daftarSepeda(filter?: {
  status?: StatusSepeda;
  cari?: string;
}): Promise<SepedaDenganPemilik[]> {
  const syarat = [];

  if (filter?.status) {
    syarat.push(eq(bikes.status, filter.status));
  }

  if (filter?.cari?.trim()) {
    const pola = `%${filter.cari.trim().toLowerCase()}%`;
    syarat.push(
      or(
        sql`lower(${bikes.kode}) like ${pola}`,
        sql`lower(${bikes.nama}) like ${pola}`,
        sql`lower(${owners.nama}) like ${pola}`,
      ),
    );
  }

  return db
    .select(kolomSepeda)
    .from(bikes)
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(asc(bikes.kode));
}

export async function sepedaById(id: number): Promise<SepedaDenganPemilik | null> {
  const [hasil] = await db
    .select(kolomSepeda)
    .from(bikes)
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .where(eq(bikes.id, id))
    .limit(1);

  return hasil ?? null;
}

/** Pencarian dari hasil scan. Kode dinormalkan supaya huruf kecil tetap cocok. */
export async function sepedaByKode(kode: string): Promise<SepedaDenganPemilik | null> {
  const [hasil] = await db
    .select(kolomSepeda)
    .from(bikes)
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .where(eq(bikes.kode, normalkanKode(kode)))
    .limit(1);

  return hasil ?? null;
}

export type StatistikBulanan = {
  jumlahRental: number;
  totalJam: number;
  totalOmzet: number;
};

/** Angka "bulan ini" pada kartu sepeda. Hanya menghitung rental yang sudah selesai. */
export async function statistikBulananSepeda(
  bikeId: number,
  sekarang: Date = new Date(),
): Promise<StatistikBulanan> {
  const { mulai, selesai } = rentangBulanWib(sekarang);

  const [hasil] = await db
    .select({
      jumlahRental: sql<number>`count(*)::int`,
      totalJam: sql<number>`coalesce(sum(${rentals.durasiJamDitagih}), 0)::int`,
      totalOmzet: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)::int`,
    })
    .from(rentals)
    .where(
      and(
        eq(rentals.bikeId, bikeId),
        eq(rentals.status, "selesai"),
        gte(rentals.waktuSelesai, mulai),
        lt(rentals.waktuSelesai, selesai),
      ),
    );

  return hasil ?? { jumlahRental: 0, totalJam: 0, totalOmzet: 0 };
}

/** Dipakai saat menghapus atau menonaktifkan sepeda. */
export async function sepedaPunyaRiwayat(bikeId: number): Promise<boolean> {
  const [hasil] = await db
    .select({ jumlah: sql<number>`count(*)::int` })
    .from(rentals)
    .where(eq(rentals.bikeId, bikeId));

  return (hasil?.jumlah ?? 0) > 0;
}

export async function kodeSudahDipakai(kode: string, kecualiId?: number): Promise<boolean> {
  const syarat = [eq(bikes.kode, normalkanKode(kode))];
  if (kecualiId !== undefined) syarat.push(ne(bikes.id, kecualiId));

  const [hasil] = await db
    .select({ id: bikes.id })
    .from(bikes)
    .where(and(...syarat))
    .limit(1);

  return Boolean(hasil);
}

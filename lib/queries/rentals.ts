import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, owners, renters, rentals, users } from "@/lib/db/schema";
import type { MetodeBayar, StatusRental } from "@/lib/db/schema";

const kolomRental = {
  id: rentals.id,
  status: rentals.status,
  waktuMulai: rentals.waktuMulai,
  waktuSelesai: rentals.waktuSelesai,
  estimasiJam: rentals.estimasiJam,
  durasiMenit: rentals.durasiMenit,
  durasiJamDitagih: rentals.durasiJamDitagih,
  totalBiaya: rentals.totalBiaya,
  bagianPemilik: rentals.bagianPemilik,
  bagianRental: rentals.bagianRental,
  tarifPerJamSnapshot: rentals.tarifPerJamSnapshot,
  persentasePemilikSnapshot: rentals.persentasePemilikSnapshot,
  metodeBayar: rentals.metodeBayar,
  jaminan: rentals.jaminan,
  catatan: rentals.catatan,

  // Jejak pembatalan. Sub-kueri, bukan join, supaya baris yang tidak dibatalkan
  // tetap ikut terbawa — join biasa akan membuangnya, dan itu justru mayoritas.
  dibatalkanPada: rentals.dibatalkanPada,
  alasanBatal: rentals.alasanBatal,
  namaPembatal: sql<string | null>`(
    select ${users.nama} from ${users} where ${users.id} = ${rentals.dibatalkanOleh}
  )`,

  bikeId: bikes.id,
  kodeSepeda: bikes.kode,
  namaSepeda: bikes.nama,

  renterId: renters.id,
  namaPenyewa: renters.nama,
  noHpPenyewa: renters.noHp,

  ownerId: owners.id,
  namaPemilik: owners.nama,

  namaKasir: users.nama,
};

export type RentalLengkap = {
  id: number;
  status: StatusRental;
  waktuMulai: Date;
  waktuSelesai: Date | null;
  estimasiJam: number | null;
  durasiMenit: number | null;
  durasiJamDitagih: number | null;
  totalBiaya: number | null;
  bagianPemilik: number | null;
  bagianRental: number | null;
  tarifPerJamSnapshot: number;
  persentasePemilikSnapshot: number;
  metodeBayar: MetodeBayar | null;
  jaminan: string | null;
  catatan: string | null;
  dibatalkanPada: Date | null;
  alasanBatal: string | null;
  namaPembatal: string | null;
  bikeId: number;
  kodeSepeda: string;
  namaSepeda: string;
  renterId: number;
  namaPenyewa: string;
  noHpPenyewa: string;
  ownerId: number;
  namaPemilik: string;
  namaKasir: string;
};

function kueriDasar() {
  return db
    .select(kolomRental)
    .from(rentals)
    .innerJoin(bikes, eq(rentals.bikeId, bikes.id))
    .innerJoin(renters, eq(rentals.renterId, renters.id))
    .innerJoin(owners, eq(rentals.ownerIdSnapshot, owners.id))
    .innerJoin(users, eq(rentals.kasirId, users.id));
}

/** Rental yang sedang berjalan untuk satu sepeda. Null kalau sepeda sedang bebas. */
export async function rentalBerjalanUntukSepeda(
  bikeId: number,
): Promise<RentalLengkap | null> {
  const [hasil] = await kueriDasar()
    .where(and(eq(rentals.bikeId, bikeId), eq(rentals.status, "berjalan")))
    .limit(1);

  return hasil ?? null;
}

export async function rentalById(id: number): Promise<RentalLengkap | null> {
  const [hasil] = await kueriDasar().where(eq(rentals.id, id)).limit(1);
  return hasil ?? null;
}

export async function daftarRentalBerjalan(): Promise<RentalLengkap[]> {
  return kueriDasar()
    .where(eq(rentals.status, "berjalan"))
    .orderBy(desc(rentals.waktuMulai));
}

export async function daftarTransaksi(filter: {
  rentang?: { mulai: Date; selesai: Date };
  status?: StatusRental;
  bikeId?: number;
  ownerId?: number;
  renterId?: number;
  batas?: number;
}): Promise<RentalLengkap[]> {
  const syarat = [];

  if (filter.status) syarat.push(eq(rentals.status, filter.status));
  if (filter.bikeId) syarat.push(eq(rentals.bikeId, filter.bikeId));
  if (filter.ownerId) syarat.push(eq(rentals.ownerIdSnapshot, filter.ownerId));
  if (filter.renterId) syarat.push(eq(rentals.renterId, filter.renterId));

  if (filter.rentang) {
    // Transaksi dikelompokkan menurut waktu mulai supaya satu rental muncul di
    // laporan hari saat sepeda dibawa keluar, sama seperti catatan manual.
    syarat.push(gte(rentals.waktuMulai, filter.rentang.mulai));
    syarat.push(lt(rentals.waktuMulai, filter.rentang.selesai));
  }

  return kueriDasar()
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(desc(rentals.waktuMulai))
    .limit(filter.batas ?? 100);
}

export type RingkasanPeriode = {
  jumlahTransaksi: number;
  jumlahSepedaDipakai: number;
  totalJam: number;
  totalOmzet: number;
  totalBagianPemilik: number;
  totalBagianRental: number;
};

/** Ringkasan untuk dashboard dan laporan harian. Hanya rental yang sudah selesai. */
export async function ringkasanPeriode(rentang: {
  mulai: Date;
  selesai: Date;
}): Promise<RingkasanPeriode> {
  const [hasil] = await db
    .select({
      jumlahTransaksi: sql<number>`count(*)::int`,
      jumlahSepedaDipakai: sql<number>`count(distinct ${rentals.bikeId})::int`,
      totalJam: sql<number>`coalesce(sum(${rentals.durasiJamDitagih}), 0)::int`,
      totalOmzet: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)::int`,
      totalBagianPemilik: sql<number>`coalesce(sum(${rentals.bagianPemilik}), 0)::int`,
      totalBagianRental: sql<number>`coalesce(sum(${rentals.bagianRental}), 0)::int`,
    })
    .from(rentals)
    .where(
      and(
        eq(rentals.status, "selesai"),
        gte(rentals.waktuSelesai, rentang.mulai),
        lt(rentals.waktuSelesai, rentang.selesai),
      ),
    );

  return (
    hasil ?? {
      jumlahTransaksi: 0,
      jumlahSepedaDipakai: 0,
      totalJam: 0,
      totalOmzet: 0,
      totalBagianPemilik: 0,
      totalBagianRental: 0,
    }
  );
}

/** Rekap bagi hasil semua pemilik pada satu periode, untuk laporan harian. */
export async function bagiHasilSemuaPemilik(rentang: { mulai: Date; selesai: Date }) {
  return db
    .select({
      ownerId: owners.id,
      namaPemilik: owners.nama,
      jumlahRental: sql<number>`count(*)::int`,
      totalJam: sql<number>`coalesce(sum(${rentals.durasiJamDitagih}), 0)::int`,
      omzetKotor: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)::int`,
      bagianPemilik: sql<number>`coalesce(sum(${rentals.bagianPemilik}), 0)::int`,
      bagianRental: sql<number>`coalesce(sum(${rentals.bagianRental}), 0)::int`,
    })
    .from(rentals)
    .innerJoin(owners, eq(rentals.ownerIdSnapshot, owners.id))
    .where(
      and(
        eq(rentals.status, "selesai"),
        gte(rentals.waktuSelesai, rentang.mulai),
        lt(rentals.waktuSelesai, rentang.selesai),
      ),
    )
    .groupBy(owners.id, owners.nama)
    .orderBy(desc(sql`sum(${rentals.totalBiaya})`));
}

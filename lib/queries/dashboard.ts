import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, renters, rentals } from "@/lib/db/schema";
import type { StatusSepeda } from "@/lib/db/schema";
import { rentangHariWib } from "@/lib/waktu";
import { ringkasanPeriode, type RingkasanPeriode } from "./rentals";
import { jumlahBookingAktif } from "./bookings";

export type HitunganStatus = Record<StatusSepeda, number> & { total: number };

export async function hitunganStatusSepeda(): Promise<HitunganStatus> {
  const baris = await db
    .select({ status: bikes.status, jumlah: sql<number>`count(*)::int` })
    .from(bikes)
    .groupBy(bikes.status);

  const hasil: HitunganStatus = {
    tersedia: 0,
    disewa: 0,
    booking: 0,
    servis: 0,
    nonaktif: 0,
    total: 0,
  };

  for (const b of baris) {
    hasil[b.status] = b.jumlah;
    hasil.total += b.jumlah;
  }

  return hasil;
}

export type Dashboard = {
  status: HitunganStatus;
  hariIni: RingkasanPeriode;
  rentalBerjalan: number;
  /**
   * Jumlah booking yang masih menunggu dijemput.
   *
   * Diambil dari tabel bookings, bukan dari kolom status sepeda. Satu sepeda
   * bisa punya beberapa booking pada jam yang berbeda, jadi menghitungnya dari
   * status sepeda akan selalu keliru.
   */
  bookingAktif: number;
};

export async function ringkasanDashboard(sekarang: Date = new Date()): Promise<Dashboard> {
  const [status, hariIni, berjalan, booking] = await Promise.all([
    hitunganStatusSepeda(),
    ringkasanPeriode(rentangHariWib(sekarang)),
    db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(rentals)
      .where(eq(rentals.status, "berjalan")),
    jumlahBookingAktif(sekarang),
  ]);

  return {
    status,
    hariIni,
    rentalBerjalan: berjalan[0]?.jumlah ?? 0,
    bookingAktif: booking,
  };
}

/**
 * Rental yang sudah berjalan lebih dari batas jam tertentu. Ini yang memunculkan
 * sepeda "hilang" — dicatat keluar tapi tidak pernah dicatat kembali.
 */
export async function rentalTerlaluLama(batasJam = 12, sekarang: Date = new Date()) {
  const ambang = new Date(sekarang.getTime() - batasJam * 60 * 60 * 1000);

  return db
    .select({
      id: rentals.id,
      waktuMulai: rentals.waktuMulai,
      kodeSepeda: bikes.kode,
      namaSepeda: bikes.nama,
      namaPenyewa: renters.nama,
      noHpPenyewa: renters.noHp,
    })
    .from(rentals)
    .innerJoin(bikes, eq(rentals.bikeId, bikes.id))
    .innerJoin(renters, eq(rentals.renterId, renters.id))
    .where(and(eq(rentals.status, "berjalan"), sql`${rentals.waktuMulai} < ${ambang}`))
    .orderBy(asc(rentals.waktuMulai));
}

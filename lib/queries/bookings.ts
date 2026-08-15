import "server-only";

import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, bookingSlots, bookings, owners, renters, users } from "@/lib/db/schema";
import type { StatusBooking } from "@/lib/db/schema";
import { akhirBooking, daftarJamBooking } from "@/lib/waktu";

const kolomBooking = {
  id: bookings.id,
  status: bookings.status,
  waktuMulai: bookings.waktuMulai,
  durasiJam: bookings.durasiJam,
  tarifPerJamSnapshot: bookings.tarifPerJamSnapshot,
  metodeBayar: bookings.metodeBayar,
  rentalId: bookings.rentalId,
  catatan: bookings.catatan,
  dibuatPada: bookings.dibuatPada,

  bikeId: bikes.id,
  kodeSepeda: bikes.kode,
  namaSepeda: bikes.nama,
  statusSepeda: bikes.status,

  renterId: renters.id,
  namaPenyewa: renters.nama,
  noHpPenyewa: renters.noHp,

  namaPemilik: owners.nama,
  namaPetugas: users.nama,
};

export type BookingLengkap = {
  id: number;
  status: StatusBooking;
  waktuMulai: Date;
  durasiJam: number;
  tarifPerJamSnapshot: number;
  metodeBayar: "tunai" | "qris" | "transfer" | null;
  rentalId: number | null;
  catatan: string | null;
  dibuatPada: Date;
  bikeId: number;
  kodeSepeda: string;
  namaSepeda: string;
  statusSepeda: string;
  renterId: number;
  namaPenyewa: string;
  noHpPenyewa: string;
  namaPemilik: string;
  namaPetugas: string;
};

/**
 * Booking yang jam mulainya sudah lewat lebih dari toleransi tapi belum
 * dijemput. Tidak ada penjadwal latar belakang di aplikasi ini, jadi status
 * "hangus" dihitung saat data dibaca, bukan diubah otomatis di database.
 */
export function bookingKedaluwarsa(
  booking: Pick<BookingLengkap, "status" | "waktuMulai">,
  sekarang: Date,
  toleransiMenit: number,
): boolean {
  if (booking.status !== "booking") return false;
  return sekarang.getTime() > booking.waktuMulai.getTime() + toleransiMenit * 60_000;
}

function kueriDasar() {
  return db
    .select(kolomBooking)
    .from(bookings)
    .innerJoin(bikes, eq(bookings.bikeId, bikes.id))
    .innerJoin(renters, eq(bookings.renterId, renters.id))
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .innerJoin(users, eq(bookings.dicatatOleh, users.id));
}

export async function daftarBooking(filter: {
  status?: StatusBooking;
  rentang?: { mulai: Date; selesai: Date };
  bikeId?: number;
  batas?: number;
}): Promise<BookingLengkap[]> {
  const syarat = [];
  if (filter.status) syarat.push(eq(bookings.status, filter.status));
  if (filter.bikeId) syarat.push(eq(bookings.bikeId, filter.bikeId));
  if (filter.rentang) {
    syarat.push(gte(bookings.waktuMulai, filter.rentang.mulai));
    syarat.push(lt(bookings.waktuMulai, filter.rentang.selesai));
  }

  return kueriDasar()
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(asc(bookings.waktuMulai))
    .limit(filter.batas ?? 200) as Promise<BookingLengkap[]>;
}

export async function bookingById(id: number): Promise<BookingLengkap | null> {
  const [hasil] = await kueriDasar().where(eq(bookings.id, id)).limit(1);
  return (hasil as BookingLengkap) ?? null;
}

/** Booking mendatang yang belum dijemput, dipakai dashboard dan daftar utama. */
export async function bookingAktif(sekarang: Date = new Date()): Promise<BookingLengkap[]> {
  // Booking yang jam selesainya sudah lewat jauh tidak lagi ditampilkan sebagai
  // aktif, tapi tetap dihitung sebagai kedaluwarsa di halaman daftar.
  const batasBawah = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);

  return kueriDasar()
    .where(and(eq(bookings.status, "booking"), gte(bookings.waktuMulai, batasBawah)))
    .orderBy(asc(bookings.waktuMulai))
    .limit(100) as Promise<BookingLengkap[]>;
}

export async function jumlahBookingAktif(sekarang: Date = new Date()): Promise<number> {
  const batasBawah = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);

  const [hasil] = await db
    .select({ jumlah: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.status, "booking"), gte(bookings.waktuMulai, batasBawah)));

  return hasil?.jumlah ?? 0;
}

/**
 * Booking yang siap dijemput untuk sepeda tertentu: statusnya masih booking dan
 * saat ini berada dalam jendela penjemputan.
 *
 * Penyewa boleh datang lebih awal (sampai `awalMenit` sebelum jam mulai) dan
 * boleh terlambat (sampai `toleransiMenit` setelah jam mulai).
 */
export async function bookingSiapJemput(
  bikeId: number,
  sekarang: Date,
  toleransiMenit: number,
  awalMenit = 60,
): Promise<BookingLengkap | null> {
  const batasAwal = new Date(sekarang.getTime() + awalMenit * 60_000);
  const batasAkhir = new Date(sekarang.getTime() - toleransiMenit * 60_000);

  const [hasil] = await kueriDasar()
    .where(
      and(
        eq(bookings.bikeId, bikeId),
        eq(bookings.status, "booking"),
        lt(bookings.waktuMulai, batasAwal),
        gte(bookings.waktuMulai, batasAkhir),
      ),
    )
    .orderBy(asc(bookings.waktuMulai))
    .limit(1);

  return (hasil as BookingLengkap) ?? null;
}

/** Semua booking mendatang untuk satu sepeda, dipakai di halaman detail sepeda. */
export async function bookingMendatangSepeda(
  bikeId: number,
  sekarang: Date = new Date(),
): Promise<BookingLengkap[]> {
  return kueriDasar()
    .where(
      and(
        eq(bookings.bikeId, bikeId),
        eq(bookings.status, "booking"),
        gte(bookings.waktuMulai, sekarang),
      ),
    )
    .orderBy(asc(bookings.waktuMulai))
    .limit(20) as Promise<BookingLengkap[]>;
}

/**
 * Sepeda yang jamnya masih bebas untuk rentang yang diminta.
 *
 * Satu query untuk semua sepeda sekaligus — tidak ada perulangan yang memanggil
 * database per sepeda, sehingga tetap ringan walau armadanya banyak.
 */
export async function sepedaBebasPada(
  waktuMulai: Date,
  durasiJam: number,
  kecualiBookingId?: number,
): Promise<number[]> {
  const jam = daftarJamBooking(waktuMulai, durasiJam);

  const syaratSlot = [eq(bookingSlots.aktif, true), inArray(bookingSlots.jam, jam)];
  if (kecualiBookingId) {
    syaratSlot.push(ne(bookingSlots.bookingId, kecualiBookingId));
  }

  const terpakai = await db
    .selectDistinct({ bikeId: bookingSlots.bikeId })
    .from(bookingSlots)
    .where(and(...syaratSlot));

  const idTerpakai = new Set(terpakai.map((t) => t.bikeId));

  // Sepeda yang tidak aktif atau sedang diservis juga tidak boleh dipesan.
  const kandidat = await db
    .select({ id: bikes.id })
    .from(bikes)
    .where(inArray(bikes.status, ["tersedia", "disewa", "booking"]))
    .orderBy(asc(bikes.kode));

  return kandidat.map((k) => k.id).filter((id) => !idTerpakai.has(id));
}

/** Jam-jam yang sudah dipesan untuk satu sepeda pada rentang tertentu. */
export async function jamTerpakaiSepeda(
  bikeId: number,
  rentang: { mulai: Date; selesai: Date },
): Promise<Date[]> {
  const baris = await db
    .select({ jam: bookingSlots.jam })
    .from(bookingSlots)
    .where(
      and(
        eq(bookingSlots.bikeId, bikeId),
        eq(bookingSlots.aktif, true),
        gte(bookingSlots.jam, rentang.mulai),
        lt(bookingSlots.jam, rentang.selesai),
      ),
    )
    .orderBy(asc(bookingSlots.jam));

  return baris.map((b) => b.jam);
}

/** Waktu selesai sebuah booking, dihitung dari waktu mulai dan durasinya. */
export function selesaiBooking(booking: Pick<BookingLengkap, "waktuMulai" | "durasiJam">) {
  return akhirBooking(booking.waktuMulai, booking.durasiJam);
}

/** Riwayat booking milik seorang penyewa. */
export async function bookingPenyewa(renterId: number): Promise<BookingLengkap[]> {
  return kueriDasar()
    .where(eq(bookings.renterId, renterId))
    .orderBy(desc(bookings.waktuMulai))
    .limit(50) as Promise<BookingLengkap[]>;
}

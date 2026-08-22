import "server-only";

import { and, asc, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, bookings, renters, rentals } from "@/lib/db/schema";
import { rentangHariWib } from "@/lib/waktu";
import { bookingKedaluwarsa } from "./bookings";

/**
 * Satu daftar untuk dua tabel.
 *
 * Sebelumnya booking dan rental langsung dipisah ke halaman masing-masing, dan
 * petugas harus tahu lebih dulu sebuah sepeda "jenisnya apa" sebelum tahu harus
 * mencarinya di mana. Padahal yang ia pedulikan cuma satu: sepeda ini sekarang
 * ada di tahap apa. Jadi jenisnya diturunkan menjadi penanda kecil, dan tahapnya
 * yang dinaikkan menjadi lencana.
 *
 * Yang paling menentukan di berkas ini: booking yang sudah dijemput TIDAK ikut
 * diambil dari tabel booking. Saat sepeda diserahkan, lib/actions/booking.ts
 * membuat rental baru sekaligus menandai bookingnya "selesai" — jadi kalau
 * kedua tabel digabung mentah-mentah, satu sepeda yang baru saja berangkat akan
 * muncul dua kali sekaligus: berlencana "Selesai" sebagai booking dan "Sedang
 * disewa" sebagai rental. Satu kejadian nyata harus tetap satu baris.
 */

export type StatusAktivitas = "dibooking" | "hangus" | "disewa" | "selesai" | "batal";

export type Aktivitas = {
  /** Unik lintas dua tabel: "b-12" untuk booking, "r-34" untuk rental. */
  kunci: string;
  status: StatusAktivitas;
  /** Rental ini lahir dari booking, bukan dari penyewa yang datang langsung. */
  dariBooking: boolean;

  bikeId: number;
  kodeSepeda: string;
  namaSepeda: string;
  namaPenyewa: string;
  noHpPenyewa: string;

  waktuMulai: Date;
  waktuSelesai: Date | null;
  /** Hanya untuk yang masih berupa booking; rental ditagih dari waktu nyata. */
  durasiJam: number | null;
  /**
   * Harga yang sudah pasti, hanya ada pada rental yang selesai.
   *
   * Sengaja dipisah dari perkiraan di bawah supaya keduanya tidak pernah
   * tertukar di layar: yang satu uang yang sudah diterima, yang satu baru
   * janji harga yang masih bisa berubah kalau sepedanya telat kembali.
   */
  totalBiaya: number | null;
  perkiraanBiaya: number | null;

  bookingId: number | null;
  rentalId: number | null;
};

/** Urutan tahap, dipakai untuk mengelompokkan dan mengurutkan daftar. */
export const URUTAN_STATUS: StatusAktivitas[] = [
  "disewa",
  "dibooking",
  "hangus",
  "selesai",
  "batal",
];

export const LABEL_AKTIVITAS: Record<StatusAktivitas, string> = {
  disewa: "Sedang disewa",
  dibooking: "Sedang dibooking",
  hangus: "Hangus",
  selesai: "Selesai",
  batal: "Batal",
};

/**
 * Seluruh aktivitas yang perlu dilihat petugas.
 *
 * Yang masih berjalan diambil tanpa batas waktu — sepeda yang belum kembali
 * tidak boleh hilang dari layar hanya karena berangkatnya kemarin. Yang sudah
 * tuntas dibatasi hari ini saja; riwayat lama tetap di halaman Transaksi.
 */
export async function daftarAktivitas(
  sekarang: Date = new Date(),
  toleransiBookingMenit = 60,
): Promise<Aktivitas[]> {
  const hariIni = rentangHariWib(sekarang);

  const [dariTabelBooking, dariTabelRental] = await Promise.all([
    kueriBooking(hariIni),
    kueriRental(hariIni),
  ]);

  const hasil: Aktivitas[] = [
    ...dariTabelBooking.map((b) => ({
      kunci: `b-${b.bookingId}`,
      status: statusBooking(b, sekarang, toleransiBookingMenit),
      dariBooking: true,
      bikeId: b.bikeId,
      kodeSepeda: b.kodeSepeda,
      namaSepeda: b.namaSepeda,
      namaPenyewa: b.namaPenyewa,
      noHpPenyewa: b.noHpPenyewa,
      waktuMulai: b.waktuMulai,
      waktuSelesai: null,
      durasiJam: b.durasiJam,
      totalBiaya: null,
      perkiraanBiaya: b.tarifPerJamSnapshot * b.durasiJam,
      bookingId: b.bookingId,
      rentalId: null,
    })),
    ...dariTabelRental.map((r) => ({
      kunci: `r-${r.rentalId}`,
      status: (r.status === "berjalan"
        ? "disewa"
        : r.status === "selesai"
          ? "selesai"
          : "batal") as StatusAktivitas,
      dariBooking: r.dariBooking,
      bikeId: r.bikeId,
      kodeSepeda: r.kodeSepeda,
      namaSepeda: r.namaSepeda,
      namaPenyewa: r.namaPenyewa,
      noHpPenyewa: r.noHpPenyewa,
      waktuMulai: r.waktuMulai,
      waktuSelesai: r.waktuSelesai,
      durasiJam: null,
      totalBiaya: r.totalBiaya,
      perkiraanBiaya: null,
      bookingId: null,
      rentalId: r.rentalId,
    })),
  ];

  return hasil.sort(bandingkan);
}

/**
 * Yang sedang berjalan diurutkan dari yang paling lama, karena itu yang paling
 * mungkin selesai berikutnya. Yang sudah tuntas justru sebaliknya: yang paling
 * baru di atas, karena itu yang paling mungkin ditanyakan ulang.
 */
function bandingkan(a: Aktivitas, b: Aktivitas): number {
  const beda = URUTAN_STATUS.indexOf(a.status) - URUTAN_STATUS.indexOf(b.status);
  if (beda !== 0) return beda;

  const tuntas = a.status === "selesai" || a.status === "batal";
  const selisih = a.waktuMulai.getTime() - b.waktuMulai.getTime();
  return tuntas ? -selisih : selisih;
}

function statusBooking(
  b: { status: string; waktuMulai: Date },
  sekarang: Date,
  toleransiMenit: number,
): StatusAktivitas {
  if (b.status === "batal") return "batal";
  return bookingKedaluwarsa(
    { status: "booking", waktuMulai: b.waktuMulai },
    sekarang,
    toleransiMenit,
  )
    ? "hangus"
    : "dibooking";
}

function kueriBooking(hariIni: { mulai: Date; selesai: Date }) {
  return db
    .select({
      bookingId: bookings.id,
      status: bookings.status,
      waktuMulai: bookings.waktuMulai,
      durasiJam: bookings.durasiJam,
      tarifPerJamSnapshot: bookings.tarifPerJamSnapshot,
      bikeId: bikes.id,
      kodeSepeda: bikes.kode,
      namaSepeda: bikes.nama,
      namaPenyewa: renters.nama,
      noHpPenyewa: renters.noHp,
    })
    .from(bookings)
    .innerJoin(bikes, eq(bookings.bikeId, bikes.id))
    .innerJoin(renters, eq(bookings.renterId, renters.id))
    .where(
      or(
        // Belum dijemput: ditampilkan tanpa batas waktu.
        eq(bookings.status, "booking"),
        // Dibatalkan. Tabel booking tidak menyimpan kapan pembatalannya terjadi,
        // jadi yang dipakai adalah jam mainnya — "booking untuk hari ini yang
        // batal", yang memang itulah yang ingin dilihat petugas hari ini.
        and(
          eq(bookings.status, "batal"),
          gte(bookings.waktuMulai, hariIni.mulai),
          lt(bookings.waktuMulai, hariIni.selesai),
        ),
      ),
    )
    // Diurutkan SEBELUM dipotong. Tanpa orderBy, database bebas mengembalikan
    // baris dalam urutan apa pun, sehingga yang terbuang saat batas tercapai
    // ditentukan kebetulan — dan bisa saja justru booking yang paling dekat
    // jamnya. Pengurutan di JavaScript baru terjadi setelah pemotongan, jadi ia
    // tidak bisa menolong.
    .orderBy(asc(bookings.waktuMulai))
    .limit(300);
}

function kueriRental(hariIni: { mulai: Date; selesai: Date }) {
  return db
    .select({
      rentalId: rentals.id,
      status: rentals.status,
      waktuMulai: rentals.waktuMulai,
      waktuSelesai: rentals.waktuSelesai,
      totalBiaya: rentals.totalBiaya,
      bikeId: bikes.id,
      kodeSepeda: bikes.kode,
      namaSepeda: bikes.nama,
      namaPenyewa: renters.nama,
      noHpPenyewa: renters.noHp,
      // Asal-usulnya tidak hilang meski jenisnya bukan lagi kategori pemisah.
      dariBooking: sql<boolean>`exists (
        select 1 from ${bookings} where ${bookings.rentalId} = ${rentals.id}
      )`,
    })
    .from(rentals)
    .innerJoin(bikes, eq(rentals.bikeId, bikes.id))
    .innerJoin(renters, eq(rentals.renterId, renters.id))
    .where(
      or(
        // Belum kembali: tanpa batas waktu, supaya sepeda yang berangkat kemarin
        // tidak lenyap dari layar begitu tanggal berganti.
        eq(rentals.status, "berjalan"),
        and(
          eq(rentals.status, "selesai"),
          gte(rentals.waktuSelesai, hariIni.mulai),
          lt(rentals.waktuSelesai, hariIni.selesai),
        ),
        and(
          eq(rentals.status, "batal"),
          gte(rentals.dibatalkanPada, hariIni.mulai),
          lt(rentals.dibatalkanPada, hariIni.selesai),
        ),
      ),
    )
    // Sama seperti pada booking: diurutkan sebelum dipotong, supaya yang
    // terbuang saat batas tercapai bukan ditentukan kebetulan.
    .orderBy(asc(rentals.waktuMulai))
    .limit(300);
}

import { kodeBooking } from "@/lib/booking/kode";
import { pesanWa as susunPesan } from "@/lib/kontak";
import { formatJamWib } from "@/lib/waktu";

/**
 * Menyusun daftar notifikasi dari keadaan rental dan booking.
 *
 * Sengaja murni: tanpa database, tanpa membaca jam sistem. Semua yang perlu
 * diketahui diserahkan sebagai argumen, sehingga aturan kapan sebuah popup
 * muncul bisa diuji tanpa menyalakan apa pun. Kedua modul yang diimpor di atas
 * juga murni, jadi sifat itu tetap terjaga.
 *
 * Satu aturan yang menentukan seluruh rancangan ini: **tiap sepeda hanya
 * menghasilkan satu notifikasi pada satu saat**, yaitu tahap tertingginya. Kalau
 * semua tahap dipancarkan sekaligus, petugas yang meninggalkan konter satu jam
 * akan kembali ke tiga popup untuk satu sepeda yang sama — dan itu justru yang
 * membuat orang berhenti membaca notifikasi.
 *
 * Kuncinya memuat tahap, bukan cuma nomor sepedanya. Menutup "r-12-habis"
 * membungkam tahap itu saja; saat sepedanya lewat 30 menit, kunci
 * "r-12-lewat30" belum pernah ditutup sehingga popupnya muncul lagi. Jadi tidak
 * pernah ada popup berulang untuk hal yang sama, tapi selalu ada popup baru
 * ketika keadaannya benar-benar memburuk.
 */

export type JenisNotifikasi =
  | "sewa-habis"
  | "lewat-30"
  | "lewat-60"
  | "belum-kembali"
  | "booking-jemput"
  | "booking-hangus";

export type NadaNotifikasi = "info" | "warn" | "danger";

export type Notifikasi = {
  /** Stabil per tahap, dipakai untuk mengingat mana yang sudah ditutup. */
  kunci: string;
  jenis: JenisNotifikasi;
  nada: NadaNotifikasi;
  judul: string;
  keterangan: string;
  kodeSepeda: string;
  namaPenyewa: string;
  noHpPenyewa: string;
  /** Tujuan tombol "Buka". */
  href: string;
  /**
   * Kalimat yang sudah terketik saat WhatsApp dibuka dari popup ini.
   *
   * Disusun di sini, bukan di komponen, karena hanya di sinilah keadaannya
   * diketahui: kalimat untuk sepeda telat berbeda dari kalimat untuk booking
   * yang belum dijemput, dan komponennya tidak perlu tahu bedanya.
   */
  pesanWa: string;
};

export type RentalUntukNotifikasi = {
  id: number;
  waktuMulai: Date;
  estimasiJam: number | null;
  kodeSepeda: string;
  namaSepeda: string;
  namaPenyewa: string;
  noHpPenyewa: string;
};

export type BookingUntukNotifikasi = {
  id: number;
  waktuMulai: Date;
  durasiJam: number;
  kodeSepeda: string;
  namaSepeda: string;
  namaPenyewa: string;
  noHpPenyewa: string;
};

export type PengaturanNotifikasi = {
  toleransiBookingMenit: number;
  batasJamRental: number;
};

const MENIT = 60_000;

/** Urutan kegentingan, dipakai untuk mengurutkan tumpukan popup. */
const URUTAN: JenisNotifikasi[] = [
  "belum-kembali",
  "lewat-60",
  "booking-hangus",
  "lewat-30",
  "sewa-habis",
  "booking-jemput",
];

export function susunNotifikasi(
  rental: RentalUntukNotifikasi[],
  booking: BookingUntukNotifikasi[],
  sekarang: Date,
  pengaturan: PengaturanNotifikasi,
): Notifikasi[] {
  const hasil = [
    ...rental.map((r) => dariRental(r, sekarang, pengaturan)),
    ...booking.map((b) => dariBooking(b, sekarang, pengaturan)),
  ].filter((n): n is Notifikasi => n !== null);

  return hasil.sort((a, b) => URUTAN.indexOf(a.jenis) - URUTAN.indexOf(b.jenis));
}

function dariRental(
  r: RentalUntukNotifikasi,
  sekarang: Date,
  pengaturan: PengaturanNotifikasi,
): Notifikasi | null {
  const menitBerjalan = Math.floor((sekarang.getTime() - r.waktuMulai.getTime()) / MENIT);
  if (menitBerjalan < 0) return null;

  const sepeda = `${r.kodeSepeda} — ${r.namaSepeda}`;
  const dasar = {
    kodeSepeda: r.kodeSepeda,
    namaPenyewa: r.namaPenyewa,
    noHpPenyewa: r.noHpPenyewa,
    href: `/scan?kode=${encodeURIComponent(r.kodeSepeda)}`,
    pesanWa: susunPesan.sepedaTelat(r.namaPenyewa, r.kodeSepeda),
  };

  const lewat = r.estimasiJam === null ? null : menitBerjalan - r.estimasiJam * 60;

  /**
   * "Belum kembali" menuntut DUA syarat, bukan satu.
   *
   * Sepeda harus sudah lama di luar DAN memang sudah lewat dari perkiraannya.
   * Kalau hanya syarat pertama yang dipakai, rental yang sengaja dicatat 24 jam
   * — dan estimasiJam memang boleh sampai 72 — akan kena alarm merah pada jam
   * ke-12 padahal masih punya sisa waktu 12 jam lagi. Alarm palsu semacam itu
   * persis yang membuat petugas berhenti membaca notifikasi.
   *
   * Rental tanpa perkiraan durasi tetap tertangkap di sini, dan hanya di sini:
   * itulah satu-satunya jaring bagi rental langsung yang kolom perkiraannya
   * dilewati kasir.
   */
  if (menitBerjalan >= pengaturan.batasJamRental * 60 && (lewat === null || lewat >= 0)) {
    return {
      ...dasar,
      kunci: `r-${r.id}-belumkembali`,
      jenis: "belum-kembali",
      nada: "danger",
      judul: "Sepeda belum kembali",
      keterangan: `${sepeda} · ${r.namaPenyewa} · sudah ${jamMenit(menitBerjalan)} sejak berangkat`,
    };
  }

  if (lewat === null || lewat < 0) return null;

  // Hanya tahap tertinggi yang dipancarkan. Tahap yang lebih rendah berhenti
  // muncul begitu terlampaui, karena sudah tidak lagi menggambarkan keadaan.
  if (lewat >= 60) {
    return {
      ...dasar,
      kunci: `r-${r.id}-lewat60`,
      jenis: "lewat-60",
      nada: "danger",
      judul: "Lewat 1 jam",
      keterangan: `${sepeda} · ${r.namaPenyewa} · melewati perkiraan ${r.estimasiJam} jam`,
    };
  }

  if (lewat >= 30) {
    return {
      ...dasar,
      kunci: `r-${r.id}-lewat30`,
      jenis: "lewat-30",
      nada: "warn",
      judul: "Lewat 30 menit",
      keterangan: `${sepeda} · ${r.namaPenyewa} · melewati perkiraan ${r.estimasiJam} jam`,
    };
  }

  return {
    ...dasar,
    kunci: `r-${r.id}-habis`,
    jenis: "sewa-habis",
    nada: "info",
    judul: "Waktu sewa habis",
    keterangan: `${sepeda} · ${r.namaPenyewa} · perkiraan ${r.estimasiJam} jam sudah tercapai`,
  };
}

function dariBooking(
  b: BookingUntukNotifikasi,
  sekarang: Date,
  pengaturan: PengaturanNotifikasi,
): Notifikasi | null {
  const lewat = Math.floor((sekarang.getTime() - b.waktuMulai.getTime()) / MENIT);
  if (lewat < 0) return null;

  const sepeda = `${b.kodeSepeda} — ${b.namaSepeda}`;
  const kode = kodeBooking(b.id);
  const jam = formatJamWib(b.waktuMulai);
  const dasar = {
    kodeSepeda: b.kodeSepeda,
    namaPenyewa: b.namaPenyewa,
    noHpPenyewa: b.noHpPenyewa,
    href: `/booking/${b.id}`,
  };

  if (lewat > pengaturan.toleransiBookingMenit) {
    return {
      ...dasar,
      kunci: `b-${b.id}-hangus`,
      jenis: "booking-hangus",
      nada: "danger",
      judul: "Booking hangus",
      keterangan: `${sepeda} · ${b.namaPenyewa} · lewat ${jamMenit(lewat)} dari jam jemput`,
      pesanWa: susunPesan.bookingHangus(b.namaPenyewa, kode, jam),
    };
  }

  return {
    ...dasar,
    kunci: `b-${b.id}-jemput`,
    jenis: "booking-jemput",
    nada: "warn",
    judul: "Booking belum dijemput",
    keterangan: `${sepeda} · ${b.namaPenyewa} · dipesan ${b.durasiJam} jam, penyewa belum datang`,
    pesanWa: susunPesan.bookingJemput(b.namaPenyewa, kode, b.kodeSepeda, jam),
  };
}

function jamMenit(menit: number): string {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} menit`;
  if (sisa === 0) return `${jam} jam`;
  return `${jam} jam ${sisa} menit`;
}

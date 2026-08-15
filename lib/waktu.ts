/**
 * Semua tanggal di aplikasi ini berarti tanggal WIB, bukan UTC.
 *
 * WIB (Asia/Jakarta) adalah UTC+7 tetap sepanjang tahun — Indonesia tidak
 * memakai daylight saving time. Karena offsetnya tetap, pergeseran manual
 * tujuh jam di bawah ini akurat dan jauh lebih mudah diuji daripada memanggil
 * Intl.DateTimeFormat di setiap perhitungan.
 */

const OFFSET_WIB_JAM = 7;
const OFFSET_WIB_MS = OFFSET_WIB_JAM * 60 * 60 * 1000;

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Ubah instan UTC menjadi "jam dinding" WIB supaya bisa dibaca lewat getUTC*. */
function keJamDindingWib(waktu: Date): Date {
  return new Date(waktu.getTime() + OFFSET_WIB_MS);
}

function duaDigit(angka: number): string {
  return String(angka).padStart(2, "0");
}

/** Tengah malam WIB pada hari yang memuat `waktu`, dikembalikan sebagai instan UTC. */
export function awalHariWib(waktu: Date): Date {
  const wib = keJamDindingWib(waktu);
  const tengahMalamWib = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate(),
  );
  return new Date(tengahMalamWib - OFFSET_WIB_MS);
}

/** Batas atas hari (eksklusif): tengah malam WIB hari berikutnya. */
export function akhirHariWib(waktu: Date): Date {
  return new Date(awalHariWib(waktu).getTime() + 24 * 60 * 60 * 1000);
}

/** Rentang setengah terbuka [mulai, selesai) untuk query "hari ini". */
export function rentangHariWib(waktu: Date): { mulai: Date; selesai: Date } {
  return { mulai: awalHariWib(waktu), selesai: akhirHariWib(waktu) };
}

/**
 * Rentang minggu berjalan menurut WIB, dimulai hari Senin.
 *
 * Senin dipilih karena "laporan mingguan" sebuah usaha lazimnya dihitung
 * Senin–Minggu, sementara getUTCDay() menganggap Minggu sebagai hari pertama.
 */
export function rentangMingguWib(waktu: Date): { mulai: Date; selesai: Date } {
  const awalHari = awalHariWib(waktu);
  const wib = keJamDindingWib(awalHari);
  // getUTCDay: 0=Minggu, 1=Senin … Senin harus mundur 0 hari, Minggu mundur 6 hari.
  const mundurHari = (wib.getUTCDay() + 6) % 7;

  const mulai = new Date(awalHari.getTime() - mundurHari * 24 * 60 * 60 * 1000);
  return { mulai, selesai: new Date(mulai.getTime() + 7 * 24 * 60 * 60 * 1000) };
}

/** Awal jam terdekat ke bawah menurut WIB. Dipakai menyusun slot booking. */
export function awalJamWib(waktu: Date): Date {
  const wib = keJamDindingWib(waktu);
  const jamBulat = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate(),
    wib.getUTCHours(),
  );
  return new Date(jamBulat - OFFSET_WIB_MS);
}

/**
 * Daftar jam yang ditempati sebuah booking, satu entri per jam.
 * Booking 09:00 selama 3 jam menempati 09:00, 10:00, dan 11:00.
 */
export function daftarJamBooking(waktuMulai: Date, durasiJam: number): Date[] {
  if (!Number.isInteger(durasiJam) || durasiJam < 1) {
    throw new Error("Durasi booking harus bilangan bulat minimal 1 jam.");
  }

  const awal = awalJamWib(waktuMulai);
  return Array.from(
    { length: durasiJam },
    (_, i) => new Date(awal.getTime() + i * 60 * 60 * 1000),
  );
}

/** Waktu selesai sebuah booking, dari waktu mulai dan durasinya. */
export function akhirBooking(waktuMulai: Date, durasiJam: number): Date {
  return new Date(awalJamWib(waktuMulai).getTime() + durasiJam * 60 * 60 * 1000);
}

/** Rentang bulan berjalan menurut WIB, dipakai statistik "bulan ini". */
export function rentangBulanWib(waktu: Date): { mulai: Date; selesai: Date } {
  const wib = keJamDindingWib(waktu);
  const tahun = wib.getUTCFullYear();
  const bulan = wib.getUTCMonth();
  return {
    mulai: new Date(Date.UTC(tahun, bulan, 1) - OFFSET_WIB_MS),
    selesai: new Date(Date.UTC(tahun, bulan + 1, 1) - OFFSET_WIB_MS),
  };
}

/** Kunci tanggal "YYYY-MM-DD" menurut WIB, untuk pengelompokan dan URL. */
export function kunciTanggalWib(waktu: Date): string {
  const wib = keJamDindingWib(waktu);
  return `${wib.getUTCFullYear()}-${duaDigit(wib.getUTCMonth() + 1)}-${duaDigit(
    wib.getUTCDate(),
  )}`;
}

/** Ubah kunci "YYYY-MM-DD" menjadi instan tengah malam WIB. Null kalau tidak valid. */
export function dariKunciTanggalWib(kunci: string): Date | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kunci);
  if (!cocok) return null;

  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const tanggal = Number(cocok[3]);
  if (bulan < 1 || bulan > 12 || tanggal < 1 || tanggal > 31) return null;

  const hasil = new Date(Date.UTC(tahun, bulan - 1, tanggal) - OFFSET_WIB_MS);
  // Tolak tanggal yang bergeser, mis. 2026-02-31.
  return kunciTanggalWib(hasil) === kunci ? hasil : null;
}

export function formatJamWib(waktu: Date): string {
  const wib = keJamDindingWib(waktu);
  return `${duaDigit(wib.getUTCHours())}:${duaDigit(wib.getUTCMinutes())}`;
}

export function formatTanggalWib(waktu: Date): string {
  const wib = keJamDindingWib(waktu);
  return `${wib.getUTCDate()} ${NAMA_BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
}

export function formatHariTanggalWib(waktu: Date): string {
  const wib = keJamDindingWib(waktu);
  return `${NAMA_HARI[wib.getUTCDay()]}, ${formatTanggalWib(waktu)}`;
}

export function formatTanggalJamWib(waktu: Date): string {
  return `${formatTanggalWib(waktu)} ${formatJamWib(waktu)}`;
}

/** Nama bulan dan tahun menurut WIB: "Agustus 2026". */
export function formatBulanWib(waktu: Date): string {
  const wib = keJamDindingWib(waktu);
  return `${NAMA_BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
}

/** Kunci bulan "YYYY-MM" menurut WIB, dipakai di URL laporan bulanan. */
export function kunciBulanWib(waktu: Date): string {
  const wib = keJamDindingWib(waktu);
  return `${wib.getUTCFullYear()}-${duaDigit(wib.getUTCMonth() + 1)}`;
}

/** Ubah kunci "YYYY-MM" menjadi awal bulan WIB. Null kalau tidak valid. */
export function dariKunciBulanWib(kunci: string): Date | null {
  const cocok = /^(\d{4})-(\d{2})$/.exec(kunci);
  if (!cocok) return null;

  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  if (bulan < 1 || bulan > 12) return null;

  return new Date(Date.UTC(tahun, bulan - 1, 1) - OFFSET_WIB_MS);
}

/** Rentang bulan yang memuat `waktu`, dari awal sampai awal bulan berikutnya. */
export function rentangBulanDari(waktu: Date): { mulai: Date; selesai: Date } {
  return rentangBulanWib(waktu);
}

/** Rentang tanggal ditulis ringkas: "11 – 17 Agustus 2026". */
export function formatRentangTanggalWib(mulai: Date, selesaiEksklusif: Date): string {
  const akhir = new Date(selesaiEksklusif.getTime() - 1);
  const a = keJamDindingWib(mulai);
  const b = keJamDindingWib(akhir);

  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${NAMA_BULAN[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} ${NAMA_BULAN[a.getUTCMonth()]} – ${b.getUTCDate()} ${NAMA_BULAN[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  return `${formatTanggalWib(mulai)} – ${formatTanggalWib(akhir)}`;
}

/** Nama hari menurut WIB: "Senin". */
export function namaHariWib(waktu: Date): string {
  return NAMA_HARI[keJamDindingWib(waktu).getUTCDay()];
}

/** Jumlah hari dalam sebuah rentang, dipakai menghitung rata-rata per hari. */
export function jumlahHari(rentang: { mulai: Date; selesai: Date }): number {
  const ms = rentang.selesai.getTime() - rentang.mulai.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

/** Durasi menit menjadi teks pendek: 95 -> "1 jam 35 menit". */
export function formatDurasi(totalMenit: number): string {
  const menit = Math.max(0, Math.round(totalMenit));
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} menit`;
  if (sisa === 0) return `${jam} jam`;
  return `${jam} jam ${sisa} menit`;
}

/**
 * Inti perhitungan uang aplikasi. Sengaja dibuat murni: tanpa database, tanpa
 * membaca jam sistem, tanpa impor apa pun. Semua nilai uang adalah rupiah bulat.
 */

export type InputBiaya = {
  waktuMulai: Date;
  waktuSelesai: Date;
  tarifPerJam: number;
  /** Bagian pemilik dalam persen bulat 0..100. */
  persentasePemilik: number;
};

export type HasilBiaya = {
  durasiMenit: number;
  durasiJamDitagih: number;
  totalBiaya: number;
  bagianPemilik: number;
  bagianRental: number;
};

const MILIDETIK_PER_MENIT = 60_000;

/**
 * Selisih dua waktu dalam menit, dibulatkan ke atas. Lewat satu detik pun sudah
 * dihitung satu menit penuh.
 */
export function hitungDurasiMenit(waktuMulai: Date, waktuSelesai: Date): number {
  const selisih = waktuSelesai.getTime() - waktuMulai.getTime();
  if (Number.isNaN(selisih)) {
    throw new Error("Waktu mulai atau waktu selesai tidak valid.");
  }
  if (selisih < 0) {
    throw new Error("Waktu selesai tidak boleh sebelum waktu mulai.");
  }
  return Math.ceil(selisih / MILIDETIK_PER_MENIT);
}

/**
 * Aturan tarif Rental Sepeda Garut: dibulatkan ke atas per jam, minimum 1 jam.
 * Sewa 1 jam 10 menit ditagih 2 jam.
 */
export function hitungJamDitagih(durasiMenit: number): number {
  if (!Number.isFinite(durasiMenit) || durasiMenit < 0) {
    throw new Error("Durasi menit tidak valid.");
  }
  return Math.max(1, Math.ceil(durasiMenit / 60));
}

export function hitungBiaya({
  waktuMulai,
  waktuSelesai,
  tarifPerJam,
  persentasePemilik,
}: InputBiaya): HasilBiaya {
  if (!Number.isInteger(tarifPerJam) || tarifPerJam < 0) {
    throw new Error("Tarif per jam harus berupa rupiah bulat dan tidak negatif.");
  }
  if (
    !Number.isInteger(persentasePemilik) ||
    persentasePemilik < 0 ||
    persentasePemilik > 100
  ) {
    throw new Error("Persentase bagi hasil pemilik harus bilangan bulat 0 sampai 100.");
  }

  const durasiMenit = hitungDurasiMenit(waktuMulai, waktuSelesai);
  const durasiJamDitagih = hitungJamDitagih(durasiMenit);
  const totalBiaya = durasiJamDitagih * tarifPerJam;

  // Bagian rental dihitung sebagai sisa, bukan persentase tersendiri. Dengan
  // begitu jumlah kedua bagian selalu persis sama dengan total biaya dan tidak
  // ada rupiah yang hilang atau tercipta karena pembulatan.
  const bagianPemilik = Math.floor((totalBiaya * persentasePemilik) / 100);
  const bagianRental = totalBiaya - bagianPemilik;

  return { durasiMenit, durasiJamDitagih, totalBiaya, bagianPemilik, bagianRental };
}

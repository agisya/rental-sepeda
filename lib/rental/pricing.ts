/**
 * Inti perhitungan uang aplikasi. Sengaja dibuat murni: tanpa database, tanpa
 * membaca jam sistem, tanpa impor apa pun selain tipe satuan.
 *
 * Aturannya dibagi dua bagian yang disengaja terpisah:
 *
 *  - **Satuan pokok** dibulatkan ke BAWAH. Dulu dibulatkan ke atas, sehingga sewa
 *    1 jam 1 menit ditagih 2 jam. Di lapangan itu terasa seperti hukuman atas
 *    keterlambatan sepele, dan akibatnya kasir enggan mencatat waktu apa adanya.
 *  - **Tambahan keterlambatan** menutupi sisa menit di luar satuan pokok, dihitung
 *    per separuh satuan, dan hanya berupa SARAN. Kasir yang memutuskan angka
 *    akhirnya, karena hanya dia yang tahu sepeda itu telat karena ban bocor atau
 *    karena penyewanya santai.
 *
 * Pemisahan itu juga yang membuat laporan bisa menjawab "berapa uang sewa dan
 * berapa uang denda", pertanyaan yang dulu tidak bisa dijawab karena keduanya
 * melebur jadi satu angka.
 */

import { MENIT_PER_SATUAN, type Satuan } from "./satuan";

export type InputBiaya = {
  waktuMulai: Date;
  waktuSelesai: Date;
  tarif: number;
  satuan: Satuan;
  /** Bagian pemilik dalam persen bulat 0..100. */
  persentasePemilik: number;
  /** Kelewatan yang masih dianggap wajar, dalam menit. */
  toleransiMenit: number;
  /**
   * Tambahan keterlambatan yang benar-benar ditagih kasir. Kalau tidak diisi,
   * sarannya yang dipakai — itu jalur normal saat kasir tidak mengubah apa pun.
   */
  tambahanDitagih?: number;
};

export type HasilBiaya = {
  durasiMenit: number;
  /** Satuan pokok, hasil pembulatan ke bawah dengan minimum 1. */
  durasiSatuanDitagih: number;
  /** Menit di luar satuan pokok. */
  sisaMenit: number;
  tambahanSaran: number;
  tambahanDitagih: number;
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
 * Satuan yang ditagih penuh: dibulatkan ke bawah, minimum 1. Sewa 1 jam 50
 * menit berpokok 1 jam; 50 menit sisanya diurus sebagai tambahan keterlambatan.
 * Sewa 2 hari 3 jam berpokok 2 hari, dengan logika yang sama persis.
 */
export function hitungSatuanPokok(durasiMenit: number, satuan: Satuan): number {
  pastikanDurasiSah(durasiMenit);
  return Math.max(1, Math.floor(durasiMenit / MENIT_PER_SATUAN[satuan]));
}

/**
 * Menit di luar satuan pokok.
 *
 * Selalu lebih kecil dari satu satuan penuh, dan itu bukan kebetulan melainkan
 * yang menjamin denda tidak pernah melebihi satu satuan tarif. Sewa di bawah
 * satu satuan menghasilkan 0, karena menitnya sudah terserap oleh minimum satu
 * satuan yang tetap ditagih.
 */
export function hitungSisaMenit(durasiMenit: number, satuan: Satuan): number {
  pastikanDurasiSah(durasiMenit);
  return Math.max(
    0,
    durasiMenit - hitungSatuanPokok(durasiMenit, satuan) * MENIT_PER_SATUAN[satuan],
  );
}

/**
 * Saran tambahan keterlambatan: per separuh satuan dibulatkan ke atas, separuh
 * tarif per blok. Nol selama sisanya masih di dalam toleransi.
 *
 * Dibulatkan ke bawah saat membagi tarif supaya tarif ganjil tidak pernah
 * membuat denda sedikit lebih mahal daripada yang bisa dijelaskan ke penyewa.
 */
export function hitungSaranTambahan(
  sisaMenit: number,
  tarif: number,
  toleransiMenit: number,
  satuan: Satuan,
): number {
  pastikanTarifSah(tarif);
  pastikanToleransiSah(toleransiMenit);
  if (sisaMenit <= toleransiMenit) return 0;

  // Blok denda adalah separuh satuan: 30 menit untuk jam, 12 jam untuk hari.
  const menitPerBlok = MENIT_PER_SATUAN[satuan] / 2;
  const blok = Math.ceil(sisaMenit / menitPerBlok);
  return blok * Math.floor(tarif / 2);
}

export function hitungBiaya({
  waktuMulai,
  waktuSelesai,
  tarif,
  satuan,
  persentasePemilik,
  toleransiMenit,
  tambahanDitagih,
}: InputBiaya): HasilBiaya {
  pastikanTarifSah(tarif);
  pastikanToleransiSah(toleransiMenit);
  if (
    !Number.isInteger(persentasePemilik) ||
    persentasePemilik < 0 ||
    persentasePemilik > 100
  ) {
    throw new Error("Persentase bagi hasil pemilik harus bilangan bulat 0 sampai 100.");
  }

  const durasiMenit = hitungDurasiMenit(waktuMulai, waktuSelesai);
  const durasiSatuanDitagih = hitungSatuanPokok(durasiMenit, satuan);
  const sisaMenit = hitungSisaMenit(durasiMenit, satuan);
  const tambahanSaran = hitungSaranTambahan(sisaMenit, tarif, toleransiMenit, satuan);

  const tambahanFinal = tambahanDitagih ?? tambahanSaran;
  if (!Number.isInteger(tambahanFinal) || tambahanFinal < 0) {
    throw new Error("Tambahan keterlambatan harus rupiah bulat dan tidak negatif.");
  }
  // Kasir hanya boleh MENURUNKAN. Menaikkan ditolak di sini, bukan hanya di
  // formulir: menagih penyewa di atas aturan lalu menyimpan selisihnya adalah
  // arah penyelewengan yang lebih sulit ketahuan daripada memberi keringanan,
  // karena tidak ada penyewa yang mengeluh saat ia dibebaskan dari denda.
  if (tambahanFinal > tambahanSaran) {
    throw new Error(
      "Tambahan keterlambatan tidak boleh melebihi saran sistem. Kasir hanya boleh menurunkannya.",
    );
  }

  const totalBiaya = durasiSatuanDitagih * tarif + tambahanFinal;

  // Bagian rental dihitung sebagai sisa, bukan persentase tersendiri. Dengan
  // begitu jumlah kedua bagian selalu persis sama dengan total biaya dan tidak
  // ada rupiah yang hilang atau tercipta karena pembulatan.
  //
  // Tambahan keterlambatan ikut dibagi seperti uang sewa biasa. Kalau tidak,
  // rental punya insentif menggeser angka dari kolom sewa ke kolom denda.
  const bagianPemilik = Math.floor((totalBiaya * persentasePemilik) / 100);
  const bagianRental = totalBiaya - bagianPemilik;

  return {
    durasiMenit,
    durasiSatuanDitagih,
    sisaMenit,
    tambahanSaran,
    tambahanDitagih: tambahanFinal,
    totalBiaya,
    bagianPemilik,
    bagianRental,
  };
}

function pastikanDurasiSah(durasiMenit: number): void {
  if (!Number.isFinite(durasiMenit) || durasiMenit < 0) {
    throw new Error("Durasi menit tidak valid.");
  }
}

function pastikanTarifSah(tarif: number): void {
  if (!Number.isInteger(tarif) || tarif < 0) {
    throw new Error("Tarif harus berupa rupiah bulat dan tidak negatif.");
  }
}

function pastikanToleransiSah(toleransiMenit: number): void {
  if (!Number.isInteger(toleransiMenit) || toleransiMenit < 0) {
    throw new Error("Toleransi keterlambatan harus menit bulat dan tidak negatif.");
  }
}

/**
 * Inti perhitungan uang aplikasi. Sengaja dibuat murni: tanpa database, tanpa
 * membaca jam sistem, tanpa impor apa pun. Semua nilai uang adalah rupiah bulat.
 *
 * Aturannya dibagi dua bagian yang disengaja terpisah:
 *
 *  - **Jam pokok** dibulatkan ke BAWAH. Dulu dibulatkan ke atas, sehingga sewa
 *    1 jam 1 menit ditagih 2 jam. Di lapangan itu terasa seperti hukuman atas
 *    keterlambatan sepele, dan akibatnya kasir enggan mencatat waktu apa adanya.
 *  - **Tambahan keterlambatan** menutupi sisa menit di luar jam pokok, dihitung
 *    per setengah jam, dan hanya berupa SARAN. Kasir yang memutuskan angka
 *    akhirnya, karena hanya dia yang tahu sepeda itu telat karena ban bocor atau
 *    karena penyewanya santai.
 *
 * Pemisahan itu juga yang membuat laporan bisa menjawab "berapa uang sewa dan
 * berapa uang denda", pertanyaan yang dulu tidak bisa dijawab karena keduanya
 * melebur jadi satu angka.
 */

export type InputBiaya = {
  waktuMulai: Date;
  waktuSelesai: Date;
  tarifPerJam: number;
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
  /** Jam pokok, hasil pembulatan ke bawah dengan minimum 1. */
  durasiJamDitagih: number;
  /** Menit di luar jam pokok. Selalu 0..59. */
  sisaMenit: number;
  tambahanSaran: number;
  tambahanDitagih: number;
  totalBiaya: number;
  bagianPemilik: number;
  bagianRental: number;
};

const MILIDETIK_PER_MENIT = 60_000;
const MENIT_PER_BLOK_DENDA = 30;

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
 * Jam yang ditagih penuh: dibulatkan ke bawah, minimum 1 jam. Sewa 1 jam 50
 * menit berpokok 1 jam; 50 menit sisanya diurus sebagai tambahan keterlambatan.
 */
export function hitungJamPokok(durasiMenit: number): number {
  pastikanDurasiSah(durasiMenit);
  return Math.max(1, Math.floor(durasiMenit / 60));
}

/**
 * Menit di luar jam pokok.
 *
 * Selalu bernilai 0..59, dan itu bukan kebetulan melainkan yang menjamin denda
 * tidak pernah melebihi satu jam tarif. Sewa di bawah satu jam menghasilkan 0,
 * karena menitnya sudah terserap oleh minimum satu jam yang tetap ditagih.
 */
export function hitungSisaMenit(durasiMenit: number): number {
  pastikanDurasiSah(durasiMenit);
  return Math.max(0, durasiMenit - hitungJamPokok(durasiMenit) * 60);
}

/**
 * Saran tambahan keterlambatan: per setengah jam dibulatkan ke atas, setengah
 * tarif per blok. Nol selama sisanya masih di dalam toleransi.
 *
 * Dibulatkan ke bawah saat membagi tarif supaya tarif ganjil tidak pernah
 * membuat denda sedikit lebih mahal daripada yang bisa dijelaskan ke penyewa.
 */
export function hitungSaranTambahan(
  sisaMenit: number,
  tarifPerJam: number,
  toleransiMenit: number,
): number {
  pastikanTarifSah(tarifPerJam);
  pastikanToleransiSah(toleransiMenit);
  if (sisaMenit <= toleransiMenit) return 0;

  const blok = Math.ceil(sisaMenit / MENIT_PER_BLOK_DENDA);
  return blok * Math.floor(tarifPerJam / 2);
}

export function hitungBiaya({
  waktuMulai,
  waktuSelesai,
  tarifPerJam,
  persentasePemilik,
  toleransiMenit,
  tambahanDitagih,
}: InputBiaya): HasilBiaya {
  pastikanTarifSah(tarifPerJam);
  pastikanToleransiSah(toleransiMenit);
  if (
    !Number.isInteger(persentasePemilik) ||
    persentasePemilik < 0 ||
    persentasePemilik > 100
  ) {
    throw new Error("Persentase bagi hasil pemilik harus bilangan bulat 0 sampai 100.");
  }

  const durasiMenit = hitungDurasiMenit(waktuMulai, waktuSelesai);
  const durasiJamDitagih = hitungJamPokok(durasiMenit);
  const sisaMenit = hitungSisaMenit(durasiMenit);
  const tambahanSaran = hitungSaranTambahan(sisaMenit, tarifPerJam, toleransiMenit);

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

  const totalBiaya = durasiJamDitagih * tarifPerJam + tambahanFinal;

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
    durasiJamDitagih,
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

function pastikanTarifSah(tarifPerJam: number): void {
  if (!Number.isInteger(tarifPerJam) || tarifPerJam < 0) {
    throw new Error("Tarif per jam harus berupa rupiah bulat dan tidak negatif.");
  }
}

function pastikanToleransiSah(toleransiMenit: number): void {
  if (!Number.isInteger(toleransiMenit) || toleransiMenit < 0) {
    throw new Error("Toleransi keterlambatan harus menit bulat dan tidak negatif.");
  }
}

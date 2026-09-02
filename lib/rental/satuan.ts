/**
 * Satuan sewa. Murni tanpa impor apa pun supaya bisa dipakai mesin harga maupun
 * definisi skema, dan nilainya tidak mungkin berbeda di dua tempat.
 */

export const SATUAN = ["jam", "hari"] as const;

export type Satuan = (typeof SATUAN)[number];

/**
 * Sepeda disewa per jam, mobil hampir selalu per hari. Seluruh perhitungan bekerja
 * dalam menit, jadi satuan cukup diterjemahkan menjadi angka ini.
 */
export const MENIT_PER_SATUAN: Record<Satuan, number> = {
  jam: 60,
  hari: 1440,
};

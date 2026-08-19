/**
 * Jangkauan yang dicoba bergantian oleh pemindai kamera, dinyatakan sebagai
 * pecahan dari bingkai.
 *
 * Kenapa lebih dari satu: bingkai kamera sungguhan tidak bersih. Ada bayangan,
 * pantulan, rangka sepeda, dan tangan di sekitar stiker. Pembaca menentukan
 * ambang hitam-putih dari isi gambar, jadi apa yang mengelilingi barcode ikut
 * menentukan apakah garis-garisnya masih terbaca sebagai garis. Membaca
 * potongan tengah memberi kesempatan kedua dengan latar yang jauh lebih sedikit.
 *
 * Yang TIDAK terbukti: dugaan bahwa barcode kecil di bingkai besar meleset dari
 * sapuan baris pembaca. Pada gambar bersih, bingkai 20 kali lebih tinggi dari
 * barcode-nya tetap terbaca utuh. Jadi pemotongan ini bukan keharusan
 * geometris — ia kesempatan tambahan yang murah, bukan penyelamat.
 *
 * Dipisah dari komponennya supaya angkanya bisa diuji tanpa memuat React dan
 * seluruh pustaka kamera.
 */
export type Jangkauan = {
  /** Tepi kiri, sebagai pecahan lebar bingkai. */
  x: number;
  /** Tepi atas, sebagai pecahan tinggi bingkai. */
  y: number;
  /** Lebar, sebagai pecahan lebar bingkai. */
  w: number;
  /** Tinggi, sebagai pecahan tinggi bingkai. */
  h: number;
};

/**
 * Urutannya disengaja: bingkai penuh lebih dulu.
 *
 * Dari dekat, memotong justru berisiko memangkas ujung barcode beserta ruang
 * putih di sisinya — dan Code 128 tanpa ruang putih itu tidak terbaca sama
 * sekali. Potongan yang makin sempit baru dicoba sesudahnya.
 */
export const JANGKAUAN: Jangkauan[] = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 0.05, y: 0.28, w: 0.9, h: 0.44 },
  { x: 0.2, y: 0.34, w: 0.6, h: 0.32 },
];

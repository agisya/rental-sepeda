/**
 * Jangkauan yang dicoba bergantian oleh pemindai kamera, dinyatakan sebagai
 * pecahan dari bingkai.
 *
 * Kenapa lebih dari satu: bingkai kamera sungguhan tidak bersih. Ada bayangan,
 * pantulan, rangka sepeda, dan tangan di sekitar stiker. Pembaca menentukan
 * ambang hitam-putih dari isi gambar, jadi apa yang mengelilingi QR ikut
 * menentukan apakah modulnya masih terbaca sebagai modul. Membaca potongan
 * tengah memberi kesempatan kedua dengan latar yang jauh lebih sedikit.
 *
 * Yang TIDAK diklaim: bahwa pemotongan ini perlu. Pada gambar bersih, QR yang
 * hanya mengisi seperdelapan tinggi bingkai tetap terbaca utuh tanpa dipotong.
 * Jadi pemotongan bukan keharusan geometris — ia kesempatan tambahan yang
 * murah, bukan penyelamat.
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
 * Potongannya mendekati persegi, mengikuti bentuk QR.
 *
 * Ini yang berubah saat stiker beralih dari Code 128 ke QR. Barcode garis itu
 * lebar dan pendek, jadi potongan yang masuk akal untuknya juga berbentuk pita.
 * QR persegi: pita selebar 0,6 bingkai tapi setinggi 0,32 akan memangkas atas
 * dan bawah QR berukuran sedang, sementara kelebihan lebarnya tidak menolong
 * sedikit pun. Angka di bawah dipilih supaya setiap potongan mendekati persegi
 * pada bingkai 16:9 yang diminta aplikasi — 0,45 × 16/9 ≈ 0,8, dan
 * 0,28 × 16/9 ≈ 0,5.
 *
 * Urutannya disengaja: bingkai penuh lebih dulu. Dari dekat, QR-nya lebih besar
 * daripada potongan mana pun, dan hanya bingkai penuh yang memuatnya. Potongan
 * yang makin sempit baru berguna saat stikernya justru terlihat kecil.
 */
export const JANGKAUAN: Jangkauan[] = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 0.275, y: 0.1, w: 0.45, h: 0.8 },
  { x: 0.36, y: 0.25, w: 0.28, h: 0.5 },
];

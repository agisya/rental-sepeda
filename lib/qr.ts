/**
 * Pilihan penyandian QR yang dipakai stiker sepeda.
 *
 * Dijadikan satu konstanta karena dua pihak harus sepakat dan keduanya tidak
 * pernah bertemu di kode mana pun: halaman cetak menghasilkan stikernya lewat
 * bwip-js, uji baca-ulang memeriksanya lewat @zxing. Sebelumnya kesepakatan itu
 * hanya dijaga komentar "harus sama persis dengan halaman cetak" — dan komentar
 * tidak ikut berubah saat salah satu sisi disunting.
 *
 * Kalau keduanya menyimpang, gejalanya muncul di konter sebagai "kamera tidak
 * bisa scan", yang membuat orang mencari kesalahan pada kamera, izin, atau
 * pencahayaan. Padahal stikernya memang tidak pernah bisa dibaca sejak dicetak.
 */
export const OPSI_QR = {
  bcid: "qrcode",

  /*
    Tingkat koreksi galat tertinggi: seperempat sampai sepertiga modul boleh
    rusak dan kodenya tetap terbaca. Stiker ini hidup di rangka sepeda yang
    kena lumpur, hujan, dan gesekan rantai, jadi kerusakan sebagian bukan
    kemungkinan yang jauh — itu keadaan normal setelah beberapa bulan.

    Diambil karena ternyata gratis. Kode sepeda sependek "MTB-023" tetap muat
    di 21 modul pada tingkat H, ukuran yang sama persis dengan tingkat bawaan;
    hanya kode sepanjang dua puluh karakter yang naik ke 25 modul. Tidak ada
    yang ditukar untuk mendapatkannya.
  */
  eclevel: "H",
} as const;

/** Zona sunyi yang dituntut spesifikasi QR, dihitung dalam modul. */
export const SUNYI_MODUL = 4;

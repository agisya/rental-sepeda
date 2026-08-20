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

  /*
    Zona sunyi ikut dicetak di dalam gambarnya sendiri.

    bwip-js tidak menambahkannya: keluaran bawaannya menutup persis matriks
    modul, nol ruang putih. Tanpa ini, stiker tetap terbaca — tapi hanya kalau
    sudutnya pas dan cahayanya baik. Gejalanya "kadang bisa, kadang harus
    diutak-atik dulu", bentuk kegagalan yang paling mahal ditelusuri karena
    tidak pernah salah dengan cara yang sama dua kali.

    Menyerahkannya ke tata letak halaman tidak cukup, dan itu sudah terbukti
    sekali: di stiker, kiri dan kanan kebetulan kebagian ruang dari lebar
    kolomnya, sementara atas dan bawah langsung berbatasan dengan tulisan —
    kurang dari satu modul. Karena ikut di dalam SVG, ruang ini terbawa ke mana
    pun gambarnya dipakai, walau tata letaknya nanti diubah orang lain.

    Satuan padding bwip-js adalah setengah modul, tidak bergantung pada scale.
  */
  padding: 4 * 2,
} as const;

/** Zona sunyi yang dituntut spesifikasi QR, dihitung dalam modul. */
export const SUNYI_MODUL = 4;

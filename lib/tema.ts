/**
 * Aturan tema, dipisahkan dari peramban.
 *
 * Tema hidup di localStorage dan di atribut elemen html, tapi keputusannya —
 * mana yang menang, apa yang terjadi saat tombol ditekan — tidak butuh DOM
 * sama sekali. Dipisah ke sini supaya bisa diuji seperti logika lain di lib/,
 * dan supaya pemilih di Pengaturan dan tombol di bilah atas memakai aturan
 * yang sama persis, bukan dua salinan yang bisa menyimpang.
 */

/** Kunci localStorage. Dipakai juga oleh skrip anti-kedip di bawah. */
export const KUNCI_TEMA = "tema";

/**
 * Dua keadaan, bukan tiga. Aplikasi ini dipakai sebagai demo portofolio, dan
 * layar pertama yang dilihat pengunjung tidak boleh bergantung pada setelan
 * perangkat masing-masing — jadi tidak ada lagi keadaan "ikut sistem" yang
 * jatuh ke gelap kalau kebetulan HP peninjau sedang gelap. Awalnya selalu
 * terang; siapa pun bisa berpindah ke gelap lewat tombol, dan pilihan itu
 * yang tersimpan.
 */
export type Tema = "terang" | "gelap";

/**
 * Warna bilah peramban HP (meta theme-color) untuk tiap tema.
 *
 * Harus sama dengan --bg dan --d-bg di app/globals.css. Ditulis ulang di sini
 * karena skrip anti-kedip berjalan sebelum stylesheet pasti termuat, jadi
 * belum bisa membacanya dari CSS. Tanpa ini, halaman gelap di HP dimahkotai
 * bilah alamat putih — yang paling terasa justru di layar yang paling sering
 * dipakai petugas.
 */
export const WARNA_BILAH: Record<Tema, string> = {
  terang: "#ffffff",
  gelap: "#0d0f0c",
};

/**
 * Menerjemahkan isi localStorage menjadi pilihan yang bisa dipercaya.
 *
 * Apa pun yang tidak dikenali jatuh ke "terang" — termasuk "sistem", nilai
 * lama yang mungkin masih tersimpan di peramban orang yang memakai aplikasi
 * ini sebelum tema disederhanakan jadi dua keadaan. Nilai asing lain bisa
 * datang dari devtools atau aplikasi lain di domain yang sama; membiarkannya
 * lolos berarti keadaan tema jadi nilai yang tidak pernah diperiksa di
 * tempat lain.
 */
export function bacaTema(nilai: string | null): Tema {
  return nilai === "gelap" ? "gelap" : "terang";
}

/**
 * Tema yang dituju saat tombol di bilah atas ditekan: kebalikan dari yang
 * sedang tampil.
 *
 * Fungsi kecil ini ada supaya aturannya tertulis sekali dan bisa diuji
 * sendiri, bukan diulang sebagai `tema === "gelap" ? "terang" : "gelap"` di
 * dalam komponen.
 */
export function temaBerikutnya(tema: Tema): Tema {
  return tema === "gelap" ? "terang" : "gelap";
}

/**
 * Skrip yang menerapkan tema pilihan sebelum halaman digambar, dipasang di
 * <head> oleh app/layout.tsx.
 *
 * Harus berjalan lebih dulu daripada React, karena kalau tidak, halaman sempat
 * tampil terang sekejap lalu berubah gelap. Kedipan itu paling terasa justru
 * bagi orang yang memilih gelap karena silau.
 *
 * Hanya "gelap" yang mengubah apa pun. Nilai lain — termasuk "sistem" dari
 * versi lama, atau localStorage yang kosong — dibiarkan, karena :root di
 * globals.css sudah terang tanpa atribut. Dibungkus try: peramban dengan
 * penyimpanan diblokir cukup mengabaikannya dan tetap tampil terang.
 *
 * Disusun dari konstanta di atas, bukan ditulis sebagai teks lepas, supaya
 * kunci dan warnanya tidak bisa berbeda dari yang dipakai tombol tema.
 */
export const SKRIP_TEMA =
  `try{if(localStorage.getItem(${JSON.stringify(KUNCI_TEMA)})==="gelap"){` +
  `document.documentElement.dataset.theme="dark";` +
  `var m=document.querySelector('meta[name="theme-color"]');` +
  `if(m)m.content=${JSON.stringify(WARNA_BILAH.gelap)}}}catch(e){}`;

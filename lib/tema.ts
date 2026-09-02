/**
 * Aturan tema, dipisahkan dari peramban.
 *
 * Tema hidup di localStorage dan di atribut elemen html, tapi keputusannya —
 * mana yang menang, apa yang terjadi saat tombol ditekan — tidak butuh DOM
 * sama sekali. Dipisah ke sini supaya bisa diuji seperti logika lain di lib/,
 * dan supaya pemilih di Pengaturan dan tombol di bilah atas memakai aturan
 * yang sama persis, bukan dua salinan yang bisa menyimpang.
 */

/** Kunci localStorage. Dipakai juga oleh skrip anti-kedip di app/layout.tsx. */
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

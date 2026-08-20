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
 * Tiga keadaan, bukan dua. "Sistem" bukan pelengkap — itulah keadaan awal semua
 * orang, dan petugas yang ponselnya berganti gelap sendiri saat malam tidak
 * perlu mengurus apa pun.
 */
export type Tema = "sistem" | "terang" | "gelap";

/** Yang benar-benar tampil di layar. "Sistem" selalu jatuh ke salah satunya. */
export type TemaNyata = "terang" | "gelap";

/**
 * Menerjemahkan isi localStorage menjadi pilihan yang bisa dipercaya.
 *
 * Apa pun yang tidak dikenali dianggap belum pernah memilih. Nilai asing bisa
 * datang dari versi lama, dari devtools, atau dari aplikasi lain di domain yang
 * sama, dan membiarkannya lolos berarti keadaan tema jadi nilai yang tidak
 * pernah diperiksa di tempat lain.
 */
export function bacaTema(nilai: string | null): Tema {
  return nilai === "terang" || nilai === "gelap" ? nilai : "sistem";
}

/** Tema yang sedang tampil. Pilihan sendiri menang atas setelan sistem, ke dua arah. */
export function temaEfektif(tema: Tema, sistemGelap: boolean): TemaNyata {
  if (tema !== "sistem") return tema;
  return sistemGelap ? "gelap" : "terang";
}

/**
 * Tema yang dituju saat tombol di bilah atas ditekan.
 *
 * Dihitung dari apa yang sedang tampil, bukan dari pilihan yang tersimpan.
 * Bedanya terasa pada petugas yang belum pernah menyentuh tema: menebak
 * "sistem berarti terang" membuat klik pertama menyetel gelap ke layar yang
 * memang sudah gelap — tombolnya terasa rusak padahal berfungsi.
 */
export function temaBerikutnya(tema: Tema, sistemGelap: boolean): TemaNyata {
  return temaEfektif(tema, sistemGelap) === "gelap" ? "terang" : "gelap";
}

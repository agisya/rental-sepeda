import { describe, expect, it } from "vitest";
import { config } from "@/proxy";
import { RUTE_SESI_HABIS } from "@/lib/auth/rute";

/**
 * Penjaga terhadap putaran pengalihan tak berujung.
 *
 * Cookie sesi bisa bertanda tangan sah tapi menunjuk ke pengguna yang sudah tidak
 * ada atau sudah dinonaktifkan — terjadi ketika akun dihapus, dinonaktifkan lewat
 * Pengaturan, atau ketika DATABASE_URL dipindah ke database lain yang memakai
 * SESSION_SECRET sama.
 *
 * Dulu keadaan itu membuat aplikasi tidak bisa dipakai sama sekali:
 *
 *   proxy meloloskan cookie yang sah  ->  halaman tidak menemukan penggunanya
 *   -> redirect ke /login             ->  proxy melihat cookie sah di rute publik
 *   -> redirect ke /dashboard         ->  berulang tanpa henti
 *
 * Pemutusnya adalah rute yang menghapus cookie lebih dulu. Rute itu HARUS berada di
 * luar jangkauan proxy — kalau ikut dijaga, ia sendiri akan dialihkan ke /dashboard
 * dan putarannya kembali utuh. Karena syarat itu tersembunyi di dalam sebuah regex,
 * ia dikunci di sini.
 */

const pola = new RegExp(`^${config.matcher[0]}$`);

describe("rute pembersih sesi", () => {
  it("berada di luar jangkauan proxy", () => {
    expect(pola.test(RUTE_SESI_HABIS)).toBe(false);
  });

  // Pembanding: kalau yang ini ikut gagal, polanya sudah rusak sama sekali dan tes
  // di atas lolos karena alasan yang salah.
  it("tetap menjaga halaman biasa", () => {
    expect(pola.test("/dashboard")).toBe(true);
    expect(pola.test("/login")).toBe(true);
  });
});

import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Alamat komputer ini di jaringan lokal.
 *
 * Selama pengembangan, Next memblokir permintaan berkas dev dari asal selain
 * localhost. Membuka aplikasi dari HP lewat alamat 192.168.x.x membuat seluruh
 * JavaScript-nya ditolak — halaman tetap tampil karena dirender server, tapi
 * tidak ada tombol yang bisa ditekan. Gejalanya sangat menyesatkan: yang
 * terlihat "tombol rusak", padahal kodenya tidak pernah sampai ke peramban.
 *
 * Alamatnya dideteksi, bukan ditulis tetap, karena IP berubah setiap berpindah
 * jaringan — dan alamat yang basi menghidupkan kembali persoalan yang sama.
 *
 * Hanya berlaku saat `next dev`; pada build produksi daftar ini diabaikan.
 */
function alamatLokal(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((antarmuka) => antarmuka?.family === "IPv4" && !antarmuka.internal)
    .map((antarmuka) => antarmuka!.address);
}

const nextConfig: NextConfig = {
  // Menghasilkan .next/standalone berisi server beserta dependensi yang
  // benar-benar dipakai. Image Docker jadi jauh lebih kecil karena tidak perlu
  // menyalin seluruh node_modules.
  //
  // Vercel memaketkan aplikasinya sendiri lewat adapter dan tidak membaca
  // keluaran ini, jadi di sana penyalinannya cuma memperlambat build tanpa
  // menghasilkan apa pun yang dipakai. VERCEL diisi otomatis oleh Vercel.
  output: process.env.VERCEL ? undefined : "standalone",

  // PGlite membawa berkas WASM Postgres. Bundler tidak boleh mencoba
  // memaketkannya; biarkan Node memuatnya langsung dari node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],

  allowedDevOrigins: alamatLokal(),
};

export default nextConfig;

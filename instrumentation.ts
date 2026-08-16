/**
 * Dijalankan sekali setiap server Next menyala, dan wajib selesai sebelum server
 * mulai menerima permintaan.
 *
 * Dipakai untuk menerapkan migrasi database saat container dinyalakan. Dengan
 * begitu deploy di Dokploy cukup menarik image baru: skema ikut menyesuaikan
 * sendiri, tanpa langkah manual yang gampang terlupa dan tanpa jeda ketika
 * halaman pertama dibuka dengan tabel yang belum ada.
 *
 * Kalau migrasi gagal, proses sengaja dihentikan. Aplikasi yang menyala di atas
 * skema yang salah akan menampilkan galat pada tiap halaman dan berpotensi
 * menulis data yang tidak konsisten — lebih baik container ditandai gagal
 * sehingga deploy sebelumnya tetap melayani.
 */
export async function register() {
  // Berkas ini juga dimuat pada runtime Edge, yang tidak punya akses database.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const otomatis = process.env.MIGRASI_OTOMATIS ?? "1";
  if (otomatis === "0") {
    console.log("[migrasi] dilewati karena MIGRASI_OTOMATIS=0");
    return;
  }

  // Database lokal berbasis berkas dipakai saat pengembangan; migrasinya
  // dijalankan lewat `npm run db:seed`, tidak perlu ikut menahan `next dev`.
  if (!process.env.DATABASE_URL?.trim()) return;

  const { bukaKoneksiSkrip } = await import("@/lib/db/koneksi-skrip");
  const koneksi = bukaKoneksiSkrip();

  try {
    console.log(`[migrasi] memakai ${koneksi.keterangan}`);
    await koneksi.jalankanMigrasi();
    console.log("[migrasi] selesai");
  } catch (galat) {
    console.error("[migrasi] GAGAL:", galat);
    throw galat;
  } finally {
    // Koneksi ini hanya untuk migrasi. Aplikasi memakai koneksinya sendiri.
    await koneksi.tutup().catch(() => {});
  }
}

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

  const adaDatabase = Boolean(process.env.DATABASE_URL?.trim());

  /**
   * DATABASE_URL yang kosong bukan galat saat pengembangan — artinya "pakai
   * PGlite, database berbasis berkas di ./data/rental". Di produksi arti itu
   * berubah jadi jebakan: aplikasi tetap menyala, tetap menerima input, tapi
   * menulis ke berkas yang di hosting tanpa penyimpanan permanen (Vercel,
   * sebagian besar PaaS) lenyap setiap instance baru dibuat. Yang terlihat bukan
   * pesan galat melainkan data yang hilang diam-diam — dan itu baru ketahuan
   * setelah petugas mengetik sesuatu yang penting.
   *
   * Karena itu server dibuat menolak menyala. Pemeriksaannya sengaja di luar
   * cabang MIGRASI_OTOMATIS di bawah: mematikan migrasi otomatis adalah setelan
   * yang wajar di Vercel, dan tidak boleh ikut mematikan penjaga ini.
   */
  if (!adaDatabase && process.env.NODE_ENV === "production") {
    // Jalan keluar untuk `npm run build && npm start` di komputer sendiri, yang
    // memang produksi tapi berkasnya tidak ke mana-mana.
    if (process.env.IZINKAN_DB_LOKAL !== "1") {
      throw new Error(
        "DATABASE_URL kosong padahal berjalan di mode produksi. Aplikasi akan " +
          "memakai database lokal berbasis berkas, yang datanya hilang setiap " +
          "instance baru menyala di hosting seperti Vercel.\n" +
          "Isi DATABASE_URL dengan connection string Postgres, atau setel " +
          "IZINKAN_DB_LOKAL=1 kalau memang sengaja menjalankan build produksi " +
          "di komputer sendiri.",
      );
    }
    console.warn("[db] IZINKAN_DB_LOKAL=1 — memakai database lokal di mode produksi");
  }

  const otomatis = process.env.MIGRASI_OTOMATIS ?? "1";
  if (otomatis === "0") {
    console.log("[migrasi] dilewati karena MIGRASI_OTOMATIS=0");
    return;
  }

  // Database lokal berbasis berkas dipakai saat pengembangan; migrasinya
  // dijalankan lewat `npm run db:seed`, tidak perlu ikut menahan `next dev`.
  if (!adaDatabase) return;

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

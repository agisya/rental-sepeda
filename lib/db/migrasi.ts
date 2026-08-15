/**
 * Menerapkan migrasi tanpa mengisi data awal.
 *
 * Jalankan: npm run db:migrate
 *
 * Dipakai saat menambah tabel baru pada database yang sudah berisi data sungguhan,
 * ketika `db:seed` tidak diinginkan.
 */

import { bukaKoneksiSkrip } from "./koneksi-skrip";

async function main() {
  const koneksi = bukaKoneksiSkrip();

  console.log(`\nMemakai ${koneksi.keterangan}`);
  console.log("Menerapkan migrasi…");

  await koneksi.jalankanMigrasi();

  console.log("Selesai.\n");
  await koneksi.tutup();
}

main().catch((galat) => {
  console.error("\nGagal menerapkan migrasi:\n");
  console.error(galat instanceof Error ? galat.message : galat);
  console.error("");
  process.exit(1);
});

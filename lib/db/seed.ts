/**
 * Menyiapkan database: menjalankan migrasi lalu mengisi data awal.
 *
 * Jalankan: npm run db:seed
 *
 * Bekerja pada database lokal maupun Neon — driver dipilih otomatis dari
 * DATABASE_URL. Aman dijalankan berulang: migrasi yang sudah pernah diterapkan
 * dilewati, dan data yang sudah ada tidak digandakan.
 */

import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { bikes, owners, settings, users } from "./schema";
import { bukaKoneksiSkrip } from "./koneksi-skrip";

const PENGGUNA = [
  { username: "admin", nama: "Admin Rental", peran: "admin" as const, kataSandi: "admin123" },
  { username: "kasir", nama: "Rina Kasir", peran: "kasir" as const, kataSandi: "kasir123" },
  { username: "owner", nama: "H. Dedi", peran: "owner" as const, kataSandi: "owner123" },
];

const PEMILIK = [
  { nama: "Budi Santoso", noHp: "081234567890", persentaseBagiHasil: 60, alamat: "Tarogong Kidul, Garut" },
  { nama: "Andi Permana", noHp: "081298765432", persentaseBagiHasil: 55, alamat: "Cipanas, Garut" },
  { nama: "Rental Sepeda Garut", noHp: "082100001111", persentaseBagiHasil: 100, alamat: "Jl. Cimanuk, Garut" },
];

const SEPEDA = [
  { kode: "MTB-021", nama: "Polygon Xtrada 5", jenis: "MTB", merk: "Polygon", tarifPerJam: 15000, pemilik: 0 },
  { kode: "MTB-022", nama: "Polygon Xtrada 6", jenis: "MTB", merk: "Polygon", tarifPerJam: 15000, pemilik: 0 },
  { kode: "MTB-023", nama: "Polygon Xtrada 7", jenis: "MTB", merk: "Polygon", tarifPerJam: 15000, pemilik: 0 },
  { kode: "MTB-024", nama: "Thrill Ravage", jenis: "MTB", merk: "Thrill", tarifPerJam: 15000, pemilik: 0 },
  { kode: "MTB-025", nama: "United Miami", jenis: "MTB", merk: "United", tarifPerJam: 12000, pemilik: 0 },
  { kode: "CTY-011", nama: "Element Troy", jenis: "City Bike", merk: "Element", tarifPerJam: 10000, pemilik: 1 },
  { kode: "CTY-012", nama: "Element Ecosmo", jenis: "City Bike", merk: "Element", tarifPerJam: 10000, pemilik: 1 },
  { kode: "LIP-005", nama: "United Trifold", jenis: "Sepeda Lipat", merk: "United", tarifPerJam: 12000, pemilik: 1 },
  { kode: "ANK-003", nama: "Wimcycle Dora", jenis: "Sepeda Anak", merk: "Wimcycle", tarifPerJam: 8000, pemilik: 2 },
  { kode: "ANK-004", nama: "Wimcycle Hotwheels", jenis: "Sepeda Anak", merk: "Wimcycle", tarifPerJam: 8000, pemilik: 2 },
];

async function main() {
  const koneksi = bukaKoneksiSkrip();
  const { db } = koneksi;

  console.log(`\nMemakai ${koneksi.keterangan}\n`);

  console.log("Menerapkan migrasi…");
  await koneksi.jalankanMigrasi();
  console.log("  tabel siap\n");

  console.log("Mengisi data awal…");

  // Baris pengaturan selalu tepat satu, dengan id 1.
  const [pengaturanAda] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (pengaturanAda) {
    console.log("  pengaturan sudah ada, dilewati");
  } else {
    await db.insert(settings).values({
      id: 1,
      namaUsaha: "Rental Sepeda Garut",
      alamat: "Jl. Cimanuk, Garut",
      noHp: "082100001111",
    });
    console.log("  + pengaturan awal");
  }

  for (const p of PENGGUNA) {
    const [ada] = await db.select().from(users).where(eq(users.username, p.username)).limit(1);
    if (ada) {
      console.log(`  pengguna ${p.username} sudah ada, dilewati`);
      continue;
    }
    await db.insert(users).values({
      username: p.username,
      passwordHash: await hash(p.kataSandi, 10),
      nama: p.nama,
      peran: p.peran,
    });
    console.log(`  + pengguna ${p.username} (kata sandi: ${p.kataSandi})`);
  }

  const idPemilik: number[] = [];
  for (const p of PEMILIK) {
    const [ada] = await db.select().from(owners).where(eq(owners.noHp, p.noHp)).limit(1);
    if (ada) {
      idPemilik.push(ada.id);
      console.log(`  pemilik ${p.nama} sudah ada, dilewati`);
      continue;
    }
    const [baru] = await db.insert(owners).values(p).returning({ id: owners.id });
    idPemilik.push(baru.id);
    console.log(`  + pemilik ${p.nama} (${p.persentaseBagiHasil}%)`);
  }

  for (const s of SEPEDA) {
    const [ada] = await db.select().from(bikes).where(eq(bikes.kode, s.kode)).limit(1);
    if (ada) {
      console.log(`  sepeda ${s.kode} sudah ada, dilewati`);
      continue;
    }
    await db.insert(bikes).values({
      kode: s.kode,
      nama: s.nama,
      jenis: s.jenis,
      merk: s.merk,
      tarifPerJam: s.tarifPerJam,
      ownerId: idPemilik[s.pemilik],
    });
    console.log(`  + sepeda ${s.kode} — ${s.nama}`);
  }

  console.log('\nSelesai. Masuk dengan username "kasir" kata sandi "kasir123".');
  console.log("Ganti semua kata sandi bawaan sebelum dipakai sungguhan.\n");

  await koneksi.tutup();
}

main().catch((galat) => {
  console.error("\nGagal menyiapkan database:\n");
  console.error(galat instanceof Error ? galat.message : galat);
  console.error("");
  process.exit(1);
});

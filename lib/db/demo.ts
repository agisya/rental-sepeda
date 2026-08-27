/**
 * Menyiapkan akun demo dan transaksi contoh untuk deployment portofolio.
 *
 * Jalankan: npm run db:demo
 *
 * Sengaja dipisah dari db:seed. Seed membuat akun admin, kasir, dan owner dengan
 * kata sandi yang tertulis di dalam berkasnya — aman untuk database di laptop,
 * berbahaya untuk alamat yang dibagikan ke publik. Skrip ini hanya membuat satu
 * akun berperan kasir, yang sudah diblokir dari setiap aksi merusak oleh
 * pemeriksaan peran di lib/actions.
 *
 * Aman dijalankan berulang: akun yang sudah ada dilewati, dan transaksi contoh
 * hanya dibuat kalau tabelnya masih kosong.
 */

import { count, eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { bikes, rentals, renters, users } from "./schema";
import { bukaKoneksiSkrip } from "./koneksi-skrip";
import { hitungBiaya } from "../rental/pricing";

const AKUN = {
  username: "demo",
  nama: "Pengunjung Demo",
  peran: "kasir" as const,
  kataSandi: "demo-rental-2026",
};

const PENYEWA = [
  { nama: "Rizki Maulana", noHp: "081311110001" },
  { nama: "Siti Aminah", noHp: "081311110002" },
  { nama: "Dewi Lestari", noHp: "081311110003" },
  { nama: "Bagus Prakoso", noHp: "081311110004" },
  { nama: "Nurul Hidayah", noHp: "081311110005" },
];

const MENIT = 60 * 1000;

/**
 * Rental yang sudah selesai, disebar ke belakang dari hari ini.
 *
 * Sebarannya disengaja: ada yang hari ini supaya Dashboard berisi, ada yang dalam
 * tujuh hari terakhir supaya Laporan Mingguan punya grafik, dan ada yang lebih
 * lama supaya Laporan Bulanan dan Laba/Rugi tidak menampilkan nol. Beberapa dibuat
 * lewat dari jam pokok supaya denda keterlambatan ikut terlihat — itu bagian yang
 * paling sulit dijelaskan tanpa contoh.
 */
const SELESAI = [
  { hariLalu: 0, mulaiJam: 8, menit: 95, sepeda: 0, penyewa: 0 },
  { hariLalu: 0, mulaiJam: 9, menit: 180, sepeda: 1, penyewa: 1 },
  { hariLalu: 0, mulaiJam: 10, menit: 60, sepeda: 5, penyewa: 2 },
  { hariLalu: 1, mulaiJam: 7, menit: 240, sepeda: 2, penyewa: 3 },
  { hariLalu: 1, mulaiJam: 15, menit: 65, sepeda: 6, penyewa: 4 },
  { hariLalu: 2, mulaiJam: 9, menit: 120, sepeda: 3, penyewa: 0 },
  { hariLalu: 3, mulaiJam: 8, menit: 150, sepeda: 0, penyewa: 1 },
  { hariLalu: 4, mulaiJam: 16, menit: 55, sepeda: 8, penyewa: 2 },
  { hariLalu: 5, mulaiJam: 10, menit: 300, sepeda: 4, penyewa: 3 },
  { hariLalu: 6, mulaiJam: 7, menit: 90, sepeda: 7, penyewa: 4 },
  { hariLalu: 9, mulaiJam: 11, menit: 200, sepeda: 1, penyewa: 0 },
  { hariLalu: 12, mulaiJam: 8, menit: 135, sepeda: 2, penyewa: 1 },
  { hariLalu: 16, mulaiJam: 14, menit: 75, sepeda: 9, penyewa: 2 },
  { hariLalu: 21, mulaiJam: 9, menit: 260, sepeda: 5, penyewa: 3 },
  { hariLalu: 27, mulaiJam: 10, menit: 110, sepeda: 3, penyewa: 4 },
];

/** Rental yang masih berjalan, supaya halaman Scan dan Dashboard punya isi. */
const BERJALAN = [
  { mulaiMenitLalu: 40, sepeda: 6, penyewa: 0 },
  { mulaiMenitLalu: 95, sepeda: 9, penyewa: 3 },
];

async function main() {
  const koneksi = bukaKoneksiSkrip();
  const { db } = koneksi;

  console.log(`\nMemakai ${koneksi.keterangan}\n`);

  console.log("Menerapkan migrasi…");
  await koneksi.jalankanMigrasi();
  console.log("  tabel siap\n");

  // --- Akun demo ---
  const [akunAda] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, AKUN.username))
    .limit(1);

  let idDemo: number;

  if (akunAda) {
    idDemo = akunAda.id;
    console.log(`Akun ${AKUN.username} sudah ada, dilewati.`);
  } else {
    const [baru] = await db
      .insert(users)
      .values({
        username: AKUN.username,
        passwordHash: await hash(AKUN.kataSandi, 10),
        nama: AKUN.nama,
        peran: AKUN.peran,
      })
      .returning({ id: users.id });
    idDemo = baru.id;
    console.log(`+ akun ${AKUN.username} (peran ${AKUN.peran})`);
  }

  // --- Transaksi contoh ---
  const [{ jumlah }] = await db.select({ jumlah: count() }).from(rentals);

  if (jumlah > 0) {
    console.log(`\nSudah ada ${jumlah} rental tercatat; transaksi contoh dilewati.`);
    console.log("Hapus isinya lebih dulu kalau memang ingin data contoh yang baru.\n");
    await koneksi.tutup();
    return;
  }

  const daftarSepeda = await db
    .select({
      id: bikes.id,
      kode: bikes.kode,
      tarifPerJam: bikes.tarifPerJam,
      ownerId: bikes.ownerId,
    })
    .from(bikes)
    .orderBy(bikes.id);

  if (daftarSepeda.length === 0) {
    throw new Error(
      "Belum ada sepeda di database. Jalankan `npm run db:seed` lebih dulu di database " +
        "kosong, atau tambahkan sepeda lewat aplikasi.",
    );
  }

  const pemilik = await db.query.owners.findMany();
  const persenPemilik = new Map(pemilik.map((p) => [p.id, p.persentaseBagiHasil]));

  // Penyewa dibuat lebih dulu karena rental mengacu ke sana.
  const idPenyewa: number[] = [];
  for (const p of PENYEWA) {
    const [ada] = await db
      .select({ id: renters.id })
      .from(renters)
      .where(eq(renters.noHp, p.noHp))
      .limit(1);

    if (ada) {
      idPenyewa.push(ada.id);
      continue;
    }

    const [baru] = await db.insert(renters).values(p).returning({ id: renters.id });
    idPenyewa.push(baru.id);
  }
  console.log(`+ ${idPenyewa.length} penyewa contoh`);

  const sekarang = new Date();

  function sepedaKe(i: number) {
    return daftarSepeda[i % daftarSepeda.length];
  }

  function penyewaKe(i: number) {
    return idPenyewa[i % idPenyewa.length];
  }

  let dibuat = 0;

  for (const r of SELESAI) {
    const sepeda = sepedaKe(r.sepeda);
    const persentase = persenPemilik.get(sepeda.ownerId) ?? 0;

    const waktuMulai = new Date(sekarang);
    waktuMulai.setDate(waktuMulai.getDate() - r.hariLalu);
    waktuMulai.setHours(r.mulaiJam, 0, 0, 0);

    const waktuSelesai = new Date(waktuMulai.getTime() + r.menit * MENIT);

    // Angka-angkanya dihitung fungsi yang sama dengan yang dipakai aplikasi saat
    // kasir menyelesaikan rental. Menghitungnya sendiri di sini akan menghasilkan
    // data contoh yang tidak mungkin muncul dari pemakaian sungguhan.
    const biaya = hitungBiaya({
      waktuMulai,
      waktuSelesai,
      tarifPerJam: sepeda.tarifPerJam,
      persentasePemilik: persentase,
      toleransiMenit: 5,
    });

    await db.insert(rentals).values({
      bikeId: sepeda.id,
      renterId: penyewaKe(r.penyewa),
      kasirId: idDemo,
      diselesaikanOleh: idDemo,
      ownerIdSnapshot: sepeda.ownerId,
      tarifPerJamSnapshot: sepeda.tarifPerJam,
      persentasePemilikSnapshot: persentase,
      waktuMulai,
      waktuSelesai,
      durasiMenit: biaya.durasiMenit,
      durasiJamDitagih: biaya.durasiJamDitagih,
      tambahanSaran: biaya.tambahanSaran,
      tambahanDitagih: biaya.tambahanDitagih,
      totalBiaya: biaya.totalBiaya,
      bagianPemilik: biaya.bagianPemilik,
      bagianRental: biaya.bagianRental,
      metodeBayar: r.hariLalu % 2 === 0 ? "tunai" : "transfer",
      status: "selesai",
      dibuatPada: waktuMulai,
    });

    dibuat++;
  }

  console.log(`+ ${dibuat} rental selesai`);

  let berjalan = 0;

  for (const r of BERJALAN) {
    const sepeda = sepedaKe(r.sepeda);
    const persentase = persenPemilik.get(sepeda.ownerId) ?? 0;
    const waktuMulai = new Date(sekarang.getTime() - r.mulaiMenitLalu * MENIT);

    await db.insert(rentals).values({
      bikeId: sepeda.id,
      renterId: penyewaKe(r.penyewa),
      kasirId: idDemo,
      ownerIdSnapshot: sepeda.ownerId,
      tarifPerJamSnapshot: sepeda.tarifPerJam,
      persentasePemilikSnapshot: persentase,
      waktuMulai,
      estimasiJam: 2,
      status: "berjalan",
      dibuatPada: waktuMulai,
    });

    berjalan++;
  }

  console.log(`+ ${berjalan} rental berjalan`);

  console.log(`\nSelesai. Masuk lewat tombol "Coba demo" di halaman login.`);
  console.log(`Setel AKUN_DEMO=${AKUN.username} di environment supaya tombolnya muncul.\n`);

  await koneksi.tutup();
}

main().catch((galat) => {
  console.error("\nGagal menyiapkan data demo:\n");
  console.error(galat instanceof Error ? galat.message : galat);
  console.error("");
  process.exit(1);
});

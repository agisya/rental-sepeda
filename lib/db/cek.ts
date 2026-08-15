/**
 * Memeriksa kesiapan database dan akun login.
 *
 * Jalankan: npm run db:cek
 *
 * Menjawab pertanyaan "kenapa saya belum bisa login" tanpa perlu membuka kode:
 * apakah databasenya terhubung, tabelnya sudah ada, dan akunnya sudah terisi.
 */

import { compare } from "bcryptjs";
import { bikes, owners, users } from "./schema";
import { bukaKoneksiSkrip } from "./koneksi-skrip";

const AKUN_BAWAAN = [
  { username: "admin", kataSandi: "admin123" },
  { username: "kasir", kataSandi: "kasir123" },
  { username: "owner", kataSandi: "owner123" },
];

function baris(lulus: boolean, teks: string) {
  console.log(`  ${lulus ? "OK   " : "GAGAL"}  ${teks}`);
}

async function main() {
  const koneksi = bukaKoneksiSkrip();
  console.log(`\nMemeriksa ${koneksi.keterangan}\n`);

  let masalah = 0;
  const pakaiBawaan: string[] = [];

  try {
    const daftarPengguna = await koneksi.db.select().from(users);
    const daftarPemilik = await koneksi.db.select().from(owners);
    const daftarSepeda = await koneksi.db.select().from(bikes);

    baris(true, "koneksi database berhasil dan tabel sudah ada");

    if (daftarPengguna.length === 0) {
      baris(false, "belum ada akun pengguna — jalankan: npm run db:seed");
      masalah += 1;
    } else {
      baris(true, `${daftarPengguna.length} akun pengguna terdaftar`);
      for (const p of daftarPengguna) {
        const status = p.aktif ? "aktif" : "NONAKTIF";
        console.log(`         · ${p.username} (${p.peran}, ${status})`);
      }
    }

    baris(daftarPemilik.length > 0, `${daftarPemilik.length} pemilik terdaftar`);
    baris(daftarSepeda.length > 0, `${daftarSepeda.length} sepeda terdaftar`);
    if (daftarPemilik.length === 0 || daftarSepeda.length === 0) masalah += 1;

    // Deteksi kata sandi bawaan yang belum diganti. Ini peringatan keamanan,
    // bukan kegagalan — tapi harus terlihat sebelum aplikasi dipakai sungguhan.
    for (const akun of AKUN_BAWAAN) {
      const pengguna = daftarPengguna.find((p) => p.username === akun.username);
      if (pengguna && (await compare(akun.kataSandi, pengguna.passwordHash))) {
        pakaiBawaan.push(akun.username);
      }
    }
  } catch (galat) {
    const pesan = galat instanceof Error ? galat.message : String(galat);

    if (/relation .* does not exist|no such table/i.test(pesan)) {
      baris(false, "tabel belum dibuat — jalankan: npm run db:seed");
    } else {
      baris(false, `tidak bisa membaca database: ${pesan}`);
    }
    masalah += 1;
  }

  await koneksi.tutup();

  if (masalah === 0) {
    console.log("\nDatabase siap. Jalankan npm run dev lalu masuk dengan kasir / kasir123.");
  } else {
    console.log(`\n${masalah} hal perlu dibereskan sebelum bisa login.`);
  }

  if (pakaiBawaan.length > 0) {
    console.log(
      `\nPERINGATAN: akun ${pakaiBawaan.join(", ")} masih memakai kata sandi bawaan.` +
        "\nGanti sebelum aplikasi dipakai sungguhan.",
    );
  }

  console.log("");
  process.exit(masalah === 0 ? 0 : 1);
}

main().catch((galat) => {
  console.error("\nPemeriksaan gagal:\n");
  console.error(galat instanceof Error ? galat.message : galat);
  console.error("");
  process.exit(1);
});

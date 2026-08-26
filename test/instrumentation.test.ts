import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";

/**
 * Penjaga DATABASE_URL saat server menyala.
 *
 * DATABASE_URL kosong berarti "pakai PGlite" — benar saat pengembangan, jebakan
 * saat produksi: aplikasi tetap menyala dan tetap menerima input, tapi menulis ke
 * berkas yang lenyap setiap instance baru dibuat di hosting seperti Vercel. Yang
 * muncul bukan pesan galat melainkan data yang hilang diam-diam, dan itu baru
 * ketahuan setelah petugas mencatat sesuatu yang penting.
 *
 * Semua kasus di sini sengaja tanpa DATABASE_URL, sehingga tidak ada satu pun yang
 * benar-benar menyentuh database.
 */

const disimpan: Record<string, string | undefined> = {};
const KUNCI = [
  "NEXT_RUNTIME",
  "NODE_ENV",
  "DATABASE_URL",
  "IZINKAN_DB_LOKAL",
  "MIGRASI_OTOMATIS",
  "VERCEL",
];

function setel(env: Record<string, string | undefined>) {
  for (const [kunci, nilai] of Object.entries(env)) {
    if (nilai === undefined) delete process.env[kunci];
    else process.env[kunci] = nilai;
  }
}

beforeEach(() => {
  for (const kunci of KUNCI) disimpan[kunci] = process.env[kunci];
  // Penjaga hanya berlaku di runtime Node; Edge tidak punya akses database.
  setel({
    NEXT_RUNTIME: "nodejs",
    DATABASE_URL: undefined,
    IZINKAN_DB_LOKAL: undefined,
    MIGRASI_OTOMATIS: undefined,
    VERCEL: undefined,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  setel(disimpan);
  vi.restoreAllMocks();
});

describe("penjaga database saat server menyala", () => {
  it("menolak menyala di produksi kalau DATABASE_URL kosong", async () => {
    setel({ NODE_ENV: "production" });
    await expect(register()).rejects.toThrow(/DATABASE_URL kosong/i);
  });

  // Pesannya harus menyebut akibatnya, bukan cuma menyebut variabelnya kurang.
  // Yang membaca galat ini sedang menatap deploy yang gagal dan perlu tahu
  // kenapa itu justru lebih baik daripada berhasil menyala.
  it("menjelaskan akibatnya, bukan sekadar menyebut variabel kurang", async () => {
    setel({ NODE_ENV: "production" });
    await expect(register()).rejects.toThrow(/hilang|tidak permanen|lokal/i);
  });

  // MIGRASI_OTOMATIS=0 adalah setelan yang wajar di Vercel, karena migrasi di sana
  // dijalankan manual. Ia tidak boleh ikut mematikan penjaga ini — kalau iya,
  // justru deployment yang paling butuh penjaga yang kehilangan penjaganya.
  it("tetap menjaga meski migrasi otomatis dimatikan", async () => {
    setel({ NODE_ENV: "production", MIGRASI_OTOMATIS: "0" });
    await expect(register()).rejects.toThrow(/DATABASE_URL kosong/i);
  });

  // `npm run build && npm start` di komputer sendiri juga berjalan sebagai
  // produksi, padahal berkasnya tidak ke mana-mana.
  it("memberi jalan keluar lewat IZINKAN_DB_LOKAL untuk build lokal", async () => {
    setel({ NODE_ENV: "production", IZINKAN_DB_LOKAL: "1" });
    await expect(register()).resolves.toBeUndefined();
  });

  it("membiarkan pengembangan tanpa DATABASE_URL memakai PGlite", async () => {
    setel({ NODE_ENV: "development" });
    await expect(register()).resolves.toBeUndefined();
  });

  // Berkas instrumentation juga dimuat pada runtime Edge, yang tidak punya akses
  // database sama sekali. Melempar di sana akan mematikan proxy.ts.
  it("tidak ikut campur pada runtime Edge", async () => {
    setel({ NEXT_RUNTIME: "edge", NODE_ENV: "production" });
    await expect(register()).resolves.toBeUndefined();
  });
});

/**
 * Migrasi otomatis di Vercel.
 *
 * Migrasi membaca berkas SQL dari ./drizzle lewat filesystem. Penelusuran berkas
 * Next hanya mengikuti import secara statis, jadi folder itu tidak pernah ikut ke
 * bundle Vercel — di Docker ia ada semata karena Dockerfile menyalinnya. Sebelum
 * pemeriksaan VERCEL ditambahkan, deploy pertama selalu berakhir dengan
 * "Internal Server Error": register() melempar ENOENT dan server gagal menyala.
 *
 * Semua kasus di sini berhenti sebelum koneksi database dibuka, jadi tidak ada
 * yang benar-benar menyentuh Postgres.
 */
describe("migrasi otomatis di Vercel", () => {
  const URL_PALSU = "postgresql://a:b@ep-palsu.ap-southeast-1.aws.neon.tech/db";

  it("dilewati tanpa melempar meski DATABASE_URL terisi", async () => {
    setel({ NODE_ENV: "production", VERCEL: "1", DATABASE_URL: URL_PALSU });
    await expect(register()).resolves.toBeUndefined();
  });

  // Kalau ini gagal, syarat wajibnya kembali bergantung pada orang yang ingat
  // menyetel MIGRASI_OTOMATIS=0 — dan lupa berarti deploy gagal total.
  it("tidak lagi menuntut MIGRASI_OTOMATIS=0 untuk bisa menyala", async () => {
    setel({
      NODE_ENV: "production",
      VERCEL: "1",
      DATABASE_URL: URL_PALSU,
      MIGRASI_OTOMATIS: "1",
    });
    await expect(register()).resolves.toBeUndefined();
  });

  // Melewati migrasi bukan alasan untuk ikut melewati penjaga. Deploy Vercel tanpa
  // DATABASE_URL tetap harus gagal menyala, bukan diam-diam memakai berkas.
  it("tetap menolak menyala kalau DATABASE_URL kosong", async () => {
    setel({ NODE_ENV: "production", VERCEL: "1" });
    await expect(register()).rejects.toThrow(/DATABASE_URL kosong/i);
  });
});

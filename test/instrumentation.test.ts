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

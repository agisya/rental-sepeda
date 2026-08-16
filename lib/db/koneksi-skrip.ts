/**
 * Koneksi database untuk skrip baris perintah (migrasi dan seed).
 *
 * Dipisah dari lib/db/index.ts karena skrip perlu menutup koneksinya sendiri dan
 * menjalankan migrasi, sementara aplikasi tidak.
 */

import { config } from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Pool as PoolNeon, neonConfig } from "@neondatabase/serverless";
import { Pool as PoolPg } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { tentukanModeDb } from "./mode";

config({ path: ".env.local" });

const FOLDER_MIGRASI = "./drizzle";

export type KoneksiSkrip = {
  db: ReturnType<typeof drizzleNeon<typeof schema>>;
  keterangan: string;
  jalankanMigrasi: () => Promise<void>;
  tutup: () => Promise<void>;
};

export function bukaKoneksiSkrip(): KoneksiSkrip {
  const mode = tentukanModeDb(process.env.DATABASE_URL);

  if (mode.jenis === "lokal") {
    // Direktori induknya dibuat lebih dulu supaya PGlite tidak gagal hanya karena
    // folder data belum ada saat pertama kali dijalankan.
    mkdirSync(dirname(mode.direktori), { recursive: true });

    let klien: PGlite;
    try {
      klien = new PGlite(mode.direktori);
    } catch (galat) {
      throw galatDirektoriTerkunci(galat);
    }

    const db = drizzlePglite(klien, { schema });

    return {
      db: db as unknown as KoneksiSkrip["db"],
      keterangan: `database lokal di ${mode.direktori}`,
      jalankanMigrasi: async () => {
        try {
          await migratePglite(db, { migrationsFolder: FOLDER_MIGRASI });
        } catch (galat) {
          throw galatDirektoriTerkunci(galat);
        }
      },
      tutup: () => klien.close(),
    };
  }

  // Kata sandi disamarkan sebelum ditampilkan, supaya log deploy tidak pernah
  // memuat kredensial database.
  const inang = mode.connectionString.replace(/:\/\/[^@]*@/, "://***@");

  if (mode.jenis === "neon") {
    if (typeof WebSocket !== "undefined") {
      neonConfig.webSocketConstructor = WebSocket;
    }

    const pool = new PoolNeon({ connectionString: mode.connectionString });
    const db = drizzleNeon(pool, { schema });

    return {
      db,
      keterangan: `Neon (${inang.slice(0, 60)}…)`,
      jalankanMigrasi: () => migrateNeon(db, { migrationsFolder: FOLDER_MIGRASI }),
      tutup: () => pool.end(),
    };
  }

  const pool = new PoolPg({ connectionString: mode.connectionString });
  const db = drizzlePg(pool, { schema });

  return {
    db: db as unknown as KoneksiSkrip["db"],
    keterangan: `Postgres (${inang.slice(0, 60)}…)`,
    jalankanMigrasi: () => migratePg(db, { migrationsFolder: FOLDER_MIGRASI }),
    tutup: () => pool.end(),
  };
}

/**
 * Database lokal berupa berkas dan hanya boleh dibuka satu proses. Kalau `next dev`
 * sedang menyalakannya, skrip ini akan gagal dengan pesan yang membingungkan —
 * jadi diterjemahkan menjadi instruksi yang bisa langsung dikerjakan.
 */
function galatDirektoriTerkunci(galat: unknown): Error {
  const pesan = galat instanceof Error ? galat.message : String(galat);
  const terkunci = /lock|EBUSY|EACCES|in use|already open/i.test(pesan);

  if (!terkunci) return galat instanceof Error ? galat : new Error(pesan);

  return new Error(
    "Database lokal sedang dipakai proses lain.\n" +
      "Hentikan dulu server pengembangan (tekan Ctrl+C di terminal yang menjalankan npm run dev), " +
      "jalankan lagi perintah ini, baru nyalakan kembali servernya.\n\n" +
      `Pesan asli: ${pesan}`,
  );
}

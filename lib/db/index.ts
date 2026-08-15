import { Pool, neonConfig } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { tentukanModeDb } from "./mode";

/**
 * Koneksi database aplikasi.
 *
 * Driver dipilih otomatis dari DATABASE_URL:
 *
 *  - kosong atau "file:..."  → PGlite, Postgres asli yang berjalan di dalam
 *    proses dan menyimpan data sebagai berkas. Untuk pengembangan lokal: tanpa
 *    mendaftar layanan apa pun dan tanpa internet.
 *  - "postgresql://..."      → Neon lewat WebSocket. Untuk produksi.
 *
 * Keduanya Postgres yang sama, jadi query, migrasi, dan transaksi tidak perlu
 * ditulis dua kali. Mengimpor kedua driver di sini murah: WASM PGlite baru
 * dimuat ketika instance-nya benar-benar dibuat.
 */

type Database = NeonDatabase<typeof schema>;

// Hot reload di `next dev` menjalankan ulang modul ini berkali-kali. Tanpa cache
// global, tiap reload membuka koneksi baru — pada Neon kuota koneksi habis, pada
// PGlite direktori datanya bentrok dengan instance sebelumnya.
const globalForDb = globalThis as unknown as { __rentalDb?: Database };

function buatDb(): Database {
  const mode = tentukanModeDb(process.env.DATABASE_URL);

  let instance: Database;

  if (mode.jenis === "lokal") {
    // Kedua driver sama-sama PgDatabase dengan API query identik; yang berbeda
    // hanya tipe hasil mentahnya, yang tidak dipakai di aplikasi ini.
    instance = drizzlePglite(new PGlite(mode.direktori), {
      schema,
    }) as unknown as Database;
  } else {
    // Driver WebSocket dipakai (bukan neon-http) karena aplikasi butuh transaksi
    // sungguhan saat memulai dan menyelesaikan rental.
    if (typeof WebSocket !== "undefined") {
      neonConfig.webSocketConstructor = WebSocket;
    }
    instance = drizzleNeon(new Pool({ connectionString: mode.connectionString }), {
      schema,
    });
  }

  globalForDb.__rentalDb = instance;
  return instance;
}

let dbUji: Database | undefined;

/**
 * Menukar koneksi dengan instance lain. Hanya dipakai uji integrasi, yang
 * menjalankan Postgres di dalam proses uji. Panggil dengan undefined untuk
 * mengembalikannya seperti semula.
 */
export function pakaiDbUji(instance: Database | undefined): void {
  dbUji = instance;
}

function ambilDb(): Database {
  return dbUji ?? globalForDb.__rentalDb ?? buatDb();
}

/**
 * Koneksi dibuat saat pertama kali dipakai, bukan saat modul diimpor, supaya
 * `next build` tetap berhasil di mesin yang belum menyiapkan database sama sekali.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(ambilDb(), prop, receiver);
  },
});

export type { Database };
export { schema };

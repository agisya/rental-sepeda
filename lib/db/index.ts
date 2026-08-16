import { Pool as PoolNeon, neonConfig } from "@neondatabase/serverless";
import { Pool as PoolPg } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { tentukanModeDb } from "./mode";

/**
 * Koneksi database aplikasi.
 *
 * Driver dipilih otomatis dari DATABASE_URL:
 *
 *  - kosong atau "file:..."   → PGlite, Postgres asli yang berjalan di dalam
 *    proses dan menyimpan data sebagai berkas. Untuk pengembangan lokal: tanpa
 *    mendaftar layanan apa pun dan tanpa internet.
 *  - host berakhiran neon.tech → driver Neon lewat WebSocket.
 *  - "postgresql://" lainnya   → driver Postgres biasa. Untuk Postgres yang
 *    dijalankan sendiri, misalnya layanan Postgres di Dokploy atau VPS.
 *
 * Pemisahan Neon dan Postgres biasa bukan pilihan gaya: driver Neon bicara lewat
 * WebSocket ke proksi milik Neon dan tidak bisa menyambung ke Postgres biasa,
 * sedangkan driver Postgres biasa tidak bisa menyambung ke Neon.
 *
 * Ketiganya Postgres yang sama, jadi query, migrasi, dan transaksi tidak perlu
 * ditulis berkali-kali. Mengimpor semua driver di sini murah: WASM PGlite baru
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

  // Ketiga driver sama-sama PgDatabase dengan API query identik; yang berbeda
  // hanya tipe hasil mentahnya, yang tidak dipakai di aplikasi ini.
  if (mode.jenis === "lokal") {
    instance = drizzlePglite(new PGlite(mode.direktori), {
      schema,
    }) as unknown as Database;
  } else if (mode.jenis === "neon") {
    // Driver WebSocket dipakai (bukan neon-http) karena aplikasi butuh transaksi
    // sungguhan saat memulai dan menyelesaikan rental.
    if (typeof WebSocket !== "undefined") {
      neonConfig.webSocketConstructor = WebSocket;
    }
    instance = drizzleNeon(new PoolNeon({ connectionString: mode.connectionString }), {
      schema,
    });
  } else {
    instance = drizzlePg(new PoolPg({ connectionString: mode.connectionString }), {
      schema,
    }) as unknown as Database;
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

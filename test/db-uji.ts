import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { pakaiDbUji } from "@/lib/db";

/**
 * Postgres sungguhan yang berjalan di dalam proses uji lewat PGlite (WASM).
 *
 * Skema dibuat dari berkas migrasi yang sama dengan yang dipakai produksi, jadi
 * uji ini ikut membuktikan SQL hasil drizzle-kit benar-benar bisa dijalankan —
 * termasuk indeks unik parsial yang mencegah rental ganda.
 */

const DIR_MIGRASI = join(process.cwd(), "drizzle");

function sqlMigrasi(): string[] {
  const berkas = readdirSync(DIR_MIGRASI)
    .filter((n) => n.endsWith(".sql"))
    .sort();

  if (berkas.length === 0) {
    throw new Error(
      "Belum ada berkas migrasi di folder drizzle/. Jalankan: npx drizzle-kit generate",
    );
  }

  return berkas.flatMap((n) =>
    readFileSync(join(DIR_MIGRASI, n), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export type DbUji = Awaited<ReturnType<typeof buatDbUji>>;

export async function buatDbUji() {
  const klien = new PGlite();
  const db = drizzle(klien, { schema });

  for (const pernyataan of sqlMigrasi()) {
    await klien.exec(pernyataan);
  }

  // Semua fungsi di lib/queries dan lib/actions memakai `db` bersama, jadi
  // penukaran ini membuat kode produksi yang diuji, bukan salinannya.
  pakaiDbUji(db as never);

  return {
    db,
    klien,
    async tutup() {
      pakaiDbUji(undefined);
      await klien.close();
    },
  };
}

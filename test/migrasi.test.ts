import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

/**
 * Migrasi harus bisa diterapkan di atas database yang sudah berisi data.
 *
 * Uji lain di proyek ini membangun skema dari nol, sehingga hanya membuktikan
 * SQL-nya sah. Produksi menempuh jalur yang berbeda: migrasi baru dijalankan
 * otomatis saat container menyala, di atas database yang sudah dipakai berbulan
 * bulan. Kolom NOT NULL tanpa nilai bawaan, atau constraint yang dilanggar baris
 * lama, hanya gagal di jalur itu — dan gagalnya saat deploy, bukan saat uji.
 */

const DIR_MIGRASI = join(process.cwd(), "drizzle");

function berkasMigrasi(): string[] {
  return readdirSync(DIR_MIGRASI)
    .filter((n) => n.endsWith(".sql"))
    .sort();
}

async function terapkan(klien: PGlite, berkas: string) {
  const pernyataan = readFileSync(join(DIR_MIGRASI, berkas), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sql of pernyataan) {
    await klien.exec(sql);
  }
}

/** Data yang sudah ada sebelum migrasi susulan dijalankan. */
const DATA_LAMA = `
  insert into users (username, password_hash, nama, peran)
  values ('lama', 'x', 'Petugas Lama', 'kasir');

  insert into owners (nama, no_hp, persentase_bagi_hasil)
  values ('Pemilik Lama', '0811', 60);

  insert into bikes (kode, nama, jenis, tarif_per_jam, owner_id)
  values ('LAMA-001', 'Sepeda Lama', 'MTB', 15000, 1);

  insert into renters (nama, no_hp) values ('Penyewa Lama', '0822');

  insert into rentals (
    bike_id, renter_id, kasir_id, owner_id_snapshot,
    tarif_per_jam_snapshot, persentase_pemilik_snapshot,
    waktu_mulai, waktu_selesai, total_biaya, bagian_pemilik, bagian_rental,
    metode_bayar, status
  ) values (
    1, 1, 1, 1, 15000, 60,
    now() - interval '2 hours', now(), 30000, 18000, 12000,
    'tunai', 'selesai'
  );

  insert into expenses (tanggal, kategori, keterangan, jumlah, dicatat_oleh)
  values (now(), 'operasional', 'Bensin', 20000, 1);
`;

describe("migrasi di atas database yang sudah berisi data", () => {
  it("menerapkan migrasi susulan tanpa menggagalkan baris lama", async () => {
    const berkas = berkasMigrasi();
    expect(berkas.length).toBeGreaterThan(1);

    const klien = new PGlite();

    try {
      // Keadaan awal: baru migrasi pertama, seperti instance yang sudah lama jalan.
      await terapkan(klien, berkas[0]);

      // Kolomnya sengaja disebut satu per satu lewat SQL mentah, bukan lewat skema
      // TypeScript. Skema TS selalu menggambarkan bentuk terbaru, jadi memakainya
      // di sini justru melewatkan persoalan yang ingin ditangkap.
      await klien.exec(DATA_LAMA);

      // Inilah yang diuji: sisa migrasi diterapkan di atas data tadi.
      for (const b of berkas.slice(1)) {
        await terapkan(klien, b);
      }

      // Kolom NOT NULL yang ditambahkan ke tabel berisi wajib punya nilai bawaan;
      // kalau tidak, seluruh deploy gagal saat migrasi dan container tidak menyala.
      const pengeluaran = await klien.query<{ metode: string }>(
        "select metode from expenses",
      );
      expect(pengeluaran.rows[0].metode).toBe("tunai");

      const rental = await klien.query<{
        dibatalkan_oleh: number | null;
        diselesaikan_oleh: number | null;
      }>("select dibatalkan_oleh, diselesaikan_oleh from rentals");
      expect(rental.rows[0].dibatalkan_oleh).toBeNull();
      expect(rental.rows[0].diselesaikan_oleh).toBeNull();

      const setoran = await klien.query("select * from cash_deposits");
      expect(setoran.rows).toHaveLength(0);
    } finally {
      await klien.close();
    }
  });

  it("membangun skema utuh dari nol juga tetap berhasil", async () => {
    const klien = new PGlite();

    try {
      for (const b of berkasMigrasi()) {
        await terapkan(klien, b);
      }

      const tabel = await klien.query<{ nama: string }>(
        "select table_name as nama from information_schema.tables where table_schema = 'public'",
      );

      expect(tabel.rows.map((t) => t.nama)).toContain("cash_deposits");
    } finally {
      await klien.close();
    }
  });
});

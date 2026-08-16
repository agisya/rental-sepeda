/**
 * Menentukan database mana yang dipakai dari isi DATABASE_URL.
 *
 * Fungsi murni tanpa impor apa pun supaya bisa diuji dan dipanggil dari mana saja,
 * termasuk skrip CLI.
 */

export type ModeDb =
  | { jenis: "lokal"; direktori: string }
  | { jenis: "neon"; connectionString: string }
  | { jenis: "postgres"; connectionString: string };

/** Tempat berkas database lokal kalau DATABASE_URL dikosongkan. */
export const DIREKTORI_LOKAL_BAWAAN = "./data/rental";

/**
 * Neon tidak bicara protokol Postgres biasa; ia dijangkau lewat WebSocket dan
 * menuntut driver tersendiri. Driver itu tidak bisa dipakai untuk Postgres biasa,
 * dan sebaliknya. Karena itu jenisnya dikenali dari nama host.
 */
function inangNeon(connectionString: string): boolean {
  try {
    const inang = new URL(connectionString).hostname.toLowerCase();
    return inang.endsWith(".neon.tech") || inang.endsWith(".neon.build");
  } catch {
    return false;
  }
}

export function tentukanModeDb(databaseUrl: string | undefined): ModeDb {
  const nilai = (databaseUrl ?? "").trim();

  // Kosong berarti pengembangan lokal: Postgres berjalan di dalam proses lewat
  // PGlite, tanpa perlu mendaftar layanan apa pun dan tanpa internet.
  if (nilai === "") {
    return { jenis: "lokal", direktori: DIREKTORI_LOKAL_BAWAAN };
  }

  // file:./data/rental atau file://./data/rental — menyebut lokasi berkas lokal.
  if (nilai.startsWith("file:")) {
    const jalur = nilai.replace(/^file:(\/\/)?/, "").trim();
    return { jenis: "lokal", direktori: jalur === "" ? DIREKTORI_LOKAL_BAWAAN : jalur };
  }

  if (nilai.startsWith("postgresql://") || nilai.startsWith("postgres://")) {
    return inangNeon(nilai)
      ? { jenis: "neon", connectionString: nilai }
      : { jenis: "postgres", connectionString: nilai };
  }

  throw new Error(
    `DATABASE_URL tidak dikenali: "${nilai.slice(0, 24)}…". ` +
      'Kosongkan untuk memakai database lokal, atau isi dengan connection string yang diawali "postgresql://".',
  );
}

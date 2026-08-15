/**
 * Pengenalan galat Postgres.
 *
 * Drizzle membungkus galat driver di dalam galat miliknya sendiri, jadi kode
 * SQLSTATE tidak ada di objek terluar melainkan di rantai `cause`. Memeriksa
 * hanya lapisan terluar akan selalu meleset.
 */

export const KODE_PELANGGARAN_UNIK = "23505";
export const KODE_PELANGGARAN_FK = "23503";

const KEDALAMAN_MAKSIMAL = 6;

/** Semua kode SQLSTATE yang ditemukan di sepanjang rantai penyebab galat. */
function kodeSepanjangRantai(galat: unknown): string[] {
  const kode: string[] = [];
  let saat: unknown = galat;

  for (let i = 0; i < KEDALAMAN_MAKSIMAL && saat; i += 1) {
    if (typeof saat === "object" && saat !== null && "code" in saat) {
      const nilai = (saat as { code?: unknown }).code;
      if (typeof nilai === "string") kode.push(nilai);
    }
    saat =
      typeof saat === "object" && saat !== null
        ? (saat as { cause?: unknown }).cause
        : undefined;
  }

  return kode;
}

export function galatBerkode(galat: unknown, kode: string): boolean {
  return kodeSepanjangRantai(galat).includes(kode);
}

/** Benar kalau galat berasal dari pelanggaran indeks atau constraint unik. */
export function pelanggaranUnik(galat: unknown): boolean {
  return galatBerkode(galat, KODE_PELANGGARAN_UNIK);
}

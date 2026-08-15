/**
 * Kode booking yang dibacakan ke penyewa lewat telepon.
 *
 * Murni turunan dari id booking, jadi tidak perlu disimpan sebagai kolom dan
 * tidak mungkin bentrok. Fungsi murni supaya mudah diuji.
 */

const AWALAN = "BK-";
const PANJANG_ANGKA = 4;

export function kodeBooking(id: number): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Id booking harus bilangan bulat positif.");
  }
  return AWALAN + String(id).padStart(PANJANG_ANGKA, "0");
}

/**
 * Membaca kembali id dari kode booking. Menerima huruf kecil dan spasi berlebih
 * supaya petugas bisa mengetik ulang kode yang dibacakan penyewa lewat telepon.
 * Mengembalikan null kalau kodenya tidak masuk akal.
 */
export function idDariKodeBooking(kode: string): number | null {
  const bersih = kode.trim().toUpperCase().replace(/\s+/g, "");
  const cocok = new RegExp(`^${AWALAN}(\\d{1,9})$`).exec(bersih);
  if (!cocok) return null;

  const id = Number(cocok[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Penulisan angka dan uang. Semua nilai uang adalah rupiah bulat. */

const formatterRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatterAngka = new Intl.NumberFormat("id-ID");

/** 15000 -> "Rp15.000". Nilai kosong ditulis sebagai "Rp0". */
export function rupiah(nilai: number | null | undefined): string {
  return formatterRupiah.format(nilai ?? 0);
}

/** 1290000 -> "1.290.000" tanpa awalan Rp, untuk tabel yang sudah berjudul rupiah. */
export function angka(nilai: number | null | undefined): string {
  return formatterAngka.format(nilai ?? 0);
}

/** Normalkan nomor HP Indonesia supaya penyewa lama dikenali: 08xx dan +628xx jadi satu. */
export function normalkanNoHp(input: string): string {
  const bersih = input.replace(/[^\d+]/g, "");
  if (bersih.startsWith("+62")) return "0" + bersih.slice(3);
  if (bersih.startsWith("62")) return "0" + bersih.slice(2);
  return bersih;
}

/** Kode barcode selalu disimpan huruf besar tanpa spasi supaya scan selalu cocok. */
export function normalkanKode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

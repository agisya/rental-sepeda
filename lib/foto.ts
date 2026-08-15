/**
 * Aturan foto sepeda.
 *
 * Foto disimpan di dalam database, bukan di penyimpanan berkas. Alasannya:
 * berkas yang ditulis di Vercel tidak permanen, sedangkan layanan penyimpanan
 * luar akan membuat pengembangan lokal menuntut internet dan pendaftaran akun.
 * Jumlah sepeda satu rental kecil, jadi ukurannya tidak jadi masalah.
 *
 * Fungsi murni supaya bisa diuji tanpa database dan tanpa permintaan HTTP.
 */

export const UKURAN_MAKS_FOTO = 2 * 1024 * 1024; // 2 MB

/**
 * Hanya format gambar raster yang diizinkan. SVG sengaja TIDAK diterima: berkas
 * SVG bisa memuat skrip, dan menyajikannya dari alamat aplikasi sendiri membuat
 * skrip itu berjalan seolah-olah bagian dari aplikasi.
 */
export const TIPE_FOTO_DIIZINKAN = ["image/jpeg", "image/png", "image/webp"] as const;

export type TipeFoto = (typeof TIPE_FOTO_DIIZINKAN)[number];

export type HasilPeriksaFoto =
  | { ok: true; tipe: TipeFoto }
  | { ok: false; pesan: string };

/**
 * Memeriksa berkas foto yang diunggah.
 *
 * Tipe tidak dipercaya dari header unggahan saja — itu ditentukan browser dan
 * mudah dipalsukan. Isi berkasnya ikut diperiksa lewat angka ajaib di awal data.
 */
export function periksaFoto(
  namaTipe: string,
  ukuran: number,
  isi: Uint8Array,
): HasilPeriksaFoto {
  if (ukuran === 0) {
    return { ok: false, pesan: "Berkas foto kosong." };
  }
  if (ukuran > UKURAN_MAKS_FOTO) {
    const mb = (UKURAN_MAKS_FOTO / 1024 / 1024).toFixed(0);
    return { ok: false, pesan: `Ukuran foto maksimal ${mb} MB.` };
  }

  const tipeIsi = tipeDariIsi(isi);
  if (!tipeIsi) {
    return {
      ok: false,
      pesan: "Berkas ini bukan gambar JPG, PNG, atau WebP.",
    };
  }

  // Tipe yang disebut browser boleh berbeda penulisannya, tapi tidak boleh
  // menunjuk jenis gambar yang lain dari isinya.
  if (namaTipe && !namaTipe.startsWith("image/")) {
    return { ok: false, pesan: "Berkas yang diunggah bukan gambar." };
  }

  return { ok: true, tipe: tipeIsi };
}

/** Mengenali jenis gambar dari beberapa byte pertamanya. */
export function tipeDariIsi(isi: Uint8Array): TipeFoto | null {
  if (isi.length < 12) return null;

  // JPEG: FF D8 FF
  if (isi[0] === 0xff && isi[1] === 0xd8 && isi[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => isi[i] === b)) return "image/png";

  // WebP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (riff.every((b, i) => isi[i] === b) && webp.every((b, i) => isi[8 + i] === b)) {
    return "image/webp";
  }

  return null;
}

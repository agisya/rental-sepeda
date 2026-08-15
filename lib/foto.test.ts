import { describe, expect, it } from "vitest";
import { UKURAN_MAKS_FOTO, periksaFoto, tipeDariIsi } from "./foto";

function isiDengan(awalan: number[], panjang = 32): Uint8Array {
  const buf = new Uint8Array(panjang);
  awalan.forEach((b, i) => (buf[i] = b));
  return buf;
}

const JPEG = isiDengan([0xff, 0xd8, 0xff, 0xe0]);
const PNG = isiDengan([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = (() => {
  const buf = new Uint8Array(32);
  [0x52, 0x49, 0x46, 0x46].forEach((b, i) => (buf[i] = b)); // RIFF
  [0x57, 0x45, 0x42, 0x50].forEach((b, i) => (buf[8 + i] = b)); // WEBP
  return buf;
})();

describe("mengenali jenis gambar dari isinya", () => {
  it("mengenali JPG, PNG, dan WebP", () => {
    expect(tipeDariIsi(JPEG)).toBe("image/jpeg");
    expect(tipeDariIsi(PNG)).toBe("image/png");
    expect(tipeDariIsi(WEBP)).toBe("image/webp");
  });

  it("menolak isi yang bukan gambar", () => {
    expect(tipeDariIsi(isiDengan([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // PDF
    expect(tipeDariIsi(isiDengan([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // ZIP
    expect(tipeDariIsi(new Uint8Array(4))).toBeNull(); // terlalu pendek
  });
});

describe("pemeriksaan berkas unggahan", () => {
  it("menerima gambar yang wajar", () => {
    expect(periksaFoto("image/jpeg", JPEG.length, JPEG)).toEqual({
      ok: true,
      tipe: "image/jpeg",
    });
  });

  it("menolak berkas kosong", () => {
    expect(periksaFoto("image/jpeg", 0, JPEG)).toMatchObject({ ok: false });
  });

  it("menolak yang melebihi batas ukuran", () => {
    const hasil = periksaFoto("image/jpeg", UKURAN_MAKS_FOTO + 1, JPEG);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.pesan).toMatch(/maksimal 2 MB/i);
  });

  // Tipe yang disebut browser mudah dipalsukan, jadi isi berkas yang menentukan.
  it("menolak berkas yang mengaku gambar padahal bukan", () => {
    const pdf = isiDengan([0x25, 0x50, 0x44, 0x46]);
    const hasil = periksaFoto("image/png", pdf.length, pdf);

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.pesan).toMatch(/bukan gambar/i);
  });

  // SVG bisa memuat skrip. Menyajikannya dari alamat aplikasi sendiri membuat
  // skrip itu berjalan seolah-olah bagian dari aplikasi.
  it("menolak SVG walaupun tipenya image/svg+xml", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const hasil = periksaFoto("image/svg+xml", svg.length, svg);

    expect(hasil.ok).toBe(false);
  });

  it("menolak berkas yang tipenya jelas bukan gambar", () => {
    const hasil = periksaFoto("application/pdf", JPEG.length, JPEG);
    expect(hasil.ok).toBe(false);
  });
});

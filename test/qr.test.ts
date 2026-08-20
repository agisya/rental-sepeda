import { describe, expect, it } from "vitest";
// Lewat ekspor bawaan, bukan ekspor bernama: data mentah matriks hanya ada
// sebagai metode pada ekspor bawaan, sedangkan toSVG diekspor bernama.
import bwipjs, { toSVG } from "bwip-js/node";
import { OPSI_QR, SUNYI_MODUL } from "@/lib/qr";
import { bacaQr, gambarQr } from "./qr-uji";

/**
 * Stiker yang dicetak harus bisa dibaca kembali oleh pemindai yang sama.
 *
 * Dua sisi pemindaian dipegang pustaka yang berbeda: bwip-js mencetak stikernya,
 * @zxing/library membacanya lewat kamera. Keduanya tidak pernah bertemu di kode
 * mana pun, jadi tidak ada yang menjamin mereka sepakat — dan kalau tidak,
 * gejalanya muncul sebagai "kamera tidak bisa scan", yang membuat orang mencari
 * kesalahan pada kamera, izin, atau pencahayaan. Padahal QR-nya memang tidak
 * pernah bisa dibaca sejak dicetak.
 *
 * Uji ini melewati kamera sepenuhnya: matriks modul hasil cetak digambar jadi
 * piksel, lalu diserahkan ke pembaca QR yang dipakai aplikasi.
 */

function bacaKembali(teks: string): string | null {
  return bacaQr(gambarQr(teks));
}

describe("stiker yang dicetak bisa dibaca kembali", () => {
  it("membaca kode sepeda seperti yang dipakai aplikasi", () => {
    expect(bacaKembali("MTB-023")).toBe("MTB-023");
  });

  it("membaca kode dengan huruf, angka, dan tanda hubung", () => {
    // Bentuk-bentuk yang benar-benar dipakai di seed dan di lapangan.
    for (const kode of ["MTB-021", "CTY-011", "LIP-005", "ANK-003"]) {
      expect(bacaKembali(kode)).toBe(kode);
    }
  });

  it("membaca kode pendek maupun panjang", () => {
    expect(bacaKembali("A1")).toBe("A1");
    expect(bacaKembali("SEPEDA-GUNUNG-000123")).toBe("SEPEDA-GUNUNG-000123");
  });

  it("membaca kode yang seluruhnya angka", () => {
    // QR punya mode angka tersendiri yang jalur penyandiannya berbeda dari
    // huruf, jadi diuji terpisah.
    expect(bacaKembali("12345678")).toBe("12345678");
  });
});

describe("ukuran QR pada tingkat koreksi galat tertinggi", () => {
  /*
    Alasan eclevel "H" dipilih adalah karena ia gratis untuk kode sepanjang
    yang dipakai di sini. Kalau suatu saat kodenya diperpanjang sampai QR-nya
    membengkak, itu keputusan yang harus diambil sadar-sadar — bukan ditemukan
    sebagai stiker yang mendadak terlalu rapat untuk dibaca dari jarak biasa.
  */
  it("kode sepeda biasa tetap muat di 21 modul", () => {
    for (const kode of ["A1", "MTB-023", "CTY-011"]) {
      const [bagian] = bwipjs.raw({ ...OPSI_QR, text: kode });
      if (!("pixs" in bagian)) throw new Error("bukan matriks");

      expect(bagian.pixx, kode).toBe(21);
      expect(bagian.pixy, kode).toBe(21);
    }
  });
});

describe("halaman cetak", () => {
  it("menghasilkan SVG dengan pilihan yang sama seperti yang diuji di atas", () => {
    // Menjaga agar OPSI_QR tetap diterima jalur cetak, bukan hanya jalur raw().
    const svg = toSVG({ ...OPSI_QR, text: "MTB-023", scale: 4 });

    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
  });

  /** Sisi bujur sangkar SVG, dalam satuan viewBox. */
  function sisiSvg(opsi: Record<string, unknown>): number {
    const svg = toSVG({ ...OPSI_QR, text: "MTB-023", scale: 4, ...opsi } as never);
    const kotak = /viewBox="([^"]+)"/.exec(svg)?.[1];
    if (!kotak) throw new Error("SVG tanpa viewBox");

    return Number(kotak.split(" ")[2]);
  }

  /*
    Zona sunyi harus ikut tercetak di dalam gambarnya sendiri, bukan diserahkan
    kepada tata letak halaman.

    bwip-js memancarkan QR tanpa zona sunyi sama sekali: viewBox-nya menutup
    persis matriks modulnya. Di stiker, kiri dan kanan kebetulan masih kebagian
    ruang putih dari lebar kolomnya, tapi atas dan bawah langsung berbatasan
    dengan tulisan — kurang dari satu modul, sedangkan spesifikasi QR menuntut
    empat. Akibatnya bukan gagal total melainkan "kadang terbaca, kadang harus
    diutak-atik dulu", gejala yang paling mahal ditelusuri.

    Karena ikut di dalam SVG, ruang itu tetap terbawa ke mana pun gambarnya
    dipakai, walau tata letaknya nanti diubah orang lain.
  */
  it("menyisakan zona sunyi minimal empat modul di keempat sisi", () => {
    const [bagian] = bwipjs.raw({ ...OPSI_QR, text: "MTB-023" });
    if (!("pixs" in bagian)) throw new Error("bukan matriks");

    const modul = bagian.pixx;

    // Diukur terhadap keluaran tanpa padding, bukan terhadap angka ajaib, agar
    // tetap sahih kalau satuan internal bwip-js berubah.
    const tanpaSunyi = sisiSvg({ padding: 0 });
    const satuanPerModul = tanpaSunyi / modul;
    const sunyiModul = (sisiSvg({}) - tanpaSunyi) / 2 / satuanPerModul;

    expect(sunyiModul).toBeGreaterThanOrEqual(SUNYI_MODUL);
  });
});

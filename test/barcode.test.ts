import { describe, expect, it } from "vitest";
// Lewat ekspor bawaan, bukan ekspor bernama: pada bangunan ESM, `raw` adalah
// nama simbologi barcode tersendiri, sedangkan data mentah pola garis hanya ada
// sebagai metode pada ekspor bawaan.
import bwipjs from "bwip-js/node";
import { BitArray, Code128Reader, DecodeHintType } from "@zxing/library";

/**
 * Stiker yang dicetak harus bisa dibaca kembali oleh pemindai yang sama.
 *
 * Dua sisi pemindaian dipegang pustaka yang berbeda: bwip-js mencetak stikernya,
 * @zxing/library membacanya lewat kamera. Keduanya tidak pernah bertemu di kode
 * mana pun, jadi tidak ada yang menjamin mereka sepakat — dan kalau tidak,
 * gejalanya muncul sebagai "kamera tidak bisa scan", yang membuat orang mencari
 * kesalahan pada kamera, izin, atau pencahayaan. Padahal barcode-nya memang
 * tidak pernah bisa dibaca sejak dicetak.
 *
 * Uji ini melewati kamera sepenuhnya: pola garis hasil cetak diubah jadi satu
 * baris piksel, lalu diserahkan ke pembaca Code 128 yang dipakai aplikasi.
 */

/** Pilihan cetak harus sama persis dengan halaman cetak barcode. */
const BCID = "code128";

/**
 * Mengubah pola lebar garis-dan-spasi menjadi satu baris hitam-putih.
 *
 * bwip-js mengembalikan sbs: lebar bergantian, dimulai dari garis hitam. Satu
 * satuan lebar dilebarkan menjadi beberapa piksel supaya menyerupai hasil cetak
 * dan pemindaian sungguhan, bukan pola sempit yang tidak realistis.
 */
function barisPiksel(sbs: number[], skala = 3): BitArray {
  const total = sbs.reduce((jumlah, lebar) => jumlah + lebar, 0) * skala;

  // Zona sunyi di kiri dan kanan. Code 128 menuntutnya, dan tanpa itu pembaca
  // tidak bisa menemukan tepi awal barcode.
  const sunyi = 10 * skala;
  const baris = new BitArray(sunyi + total + sunyi);

  let posisi = sunyi;
  let hitam = true;

  for (const lebar of sbs) {
    const piksel = lebar * skala;
    if (hitam) {
      for (let i = 0; i < piksel; i += 1) baris.set(posisi + i);
    }
    posisi += piksel;
    hitam = !hitam;
  }

  return baris;
}

function bacaKembali(teks: string): string {
  // Barcode garis mengembalikan sbs; simbologi matriks seperti QR mengembalikan
  // bentuk lain. Code 128 selalu yang pertama, tapi tipenya menggabungkan
  // keduanya, jadi keberadaannya diperiksa dan bukan diasumsikan.
  const [bagian] = bwipjs.raw({ bcid: BCID, text: teks });
  if (!("sbs" in bagian)) {
    throw new Error(`bwip-js tidak mengembalikan pola garis untuk "${teks}"`);
  }

  const baris = barisPiksel(bagian.sbs);

  const pembaca = new Code128Reader();
  const petunjuk = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);

  return pembaca.decodeRow(0, baris, petunjuk).getText();
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
    // Code 128 memampatkan angka berpasangan lewat mode C. Jalur penyandiannya
    // berbeda dari huruf, jadi diuji terpisah.
    expect(bacaKembali("12345678")).toBe("12345678");
  });
});

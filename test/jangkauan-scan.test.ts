import { describe, expect, it } from "vitest";
import bwipjs from "bwip-js/node";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { JANGKAUAN } from "@/lib/scan/jangkauan";

/**
 * Menjaga agar jangkauan pemindaian tidak memangkas barcode.
 *
 * Pemindai kamera membaca beberapa potongan bingkai secara bergantian. Satu
 * angka yang digeser sedikit saja bisa membuat potongan itu memotong ujung
 * barcode beserta ruang putih di sisinya — dan Code 128 tanpa ruang putih tidak
 * terbaca sama sekali. Kegagalannya hanya muncul di lapangan, sebagai "kadang
 * bisa kadang tidak", yang hampir mustahil ditelusuri.
 *
 * Uji ini menaruh barcode di tengah bingkai lalu membaca setiap jangkauan yang
 * benar-benar dipakai aplikasi.
 *
 * Yang uji ini TIDAK klaim: bahwa pemotongan itu perlu. Pada gambar bersih,
 * bingkai 20 kali lebih tinggi dari barcode-nya tetap terbaca utuh tanpa
 * dipotong. Pemotongan adalah kesempatan kedua yang murah untuk bingkai
 * sungguhan yang penuh bayangan dan latar, bukan keharusan geometris.
 */

const PUTIH = 0xff;
const HITAM = 0x00;

type Gambar = { data: Uint8ClampedArray; lebar: number; tinggi: number };

/** Satu baris hitam-putih dari pola lebar garis milik bwip-js. */
function polaBaris(teks: string, skala: number): number[] {
  const [bagian] = bwipjs.raw({ bcid: "code128", text: teks });
  if (!("sbs" in bagian)) throw new Error("bwip-js tidak memberi pola garis");

  const piksel: number[] = [];
  let hitam = true;

  for (const lebar of bagian.sbs) {
    for (let i = 0; i < lebar * skala; i += 1) piksel.push(hitam ? HITAM : PUTIH);
    hitam = !hitam;
  }

  return piksel;
}

/**
 * Barcode di tengah bingkai yang jauh lebih besar, seperti stiker sepeda yang
 * dilihat dari agak jauh. Ruang putih di sekelilingnya terbentuk sendiri.
 */
function bingkaiDenganBarcode(teks: string, skala = 2): Gambar {
  const baris = polaBaris(teks, skala);
  const tinggiBarcode = 30 * skala;

  const lebar = baris.length * 3;
  const tinggi = tinggiBarcode * 6;

  const data = new Uint8ClampedArray(lebar * tinggi).fill(PUTIH);

  const kiri = Math.floor((lebar - baris.length) / 2);
  const atas = Math.floor((tinggi - tinggiBarcode) / 2);

  for (let y = 0; y < tinggiBarcode; y += 1) {
    const awal = (atas + y) * lebar + kiri;
    for (let x = 0; x < baris.length; x += 1) data[awal + x] = baris[x];
  }

  return { data, lebar, tinggi };
}

/** Memotong memakai pecahan yang sama seperti pemindai kamera. */
function potong(gambar: Gambar, bagian: (typeof JANGKAUAN)[number]): Gambar {
  const lebar = Math.round(gambar.lebar * bagian.w);
  const tinggi = Math.round(gambar.tinggi * bagian.h);
  const kiri = Math.round(gambar.lebar * bagian.x);
  const atas = Math.round(gambar.tinggi * bagian.y);

  const data = new Uint8ClampedArray(lebar * tinggi);

  for (let y = 0; y < tinggi; y += 1) {
    const sumber = (atas + y) * gambar.lebar + kiri;
    data.set(gambar.data.subarray(sumber, sumber + lebar), y * lebar);
  }

  return { data, lebar, tinggi };
}

/** Petunjuk yang sama persis dengan yang dipakai pemindai kamera. */
function baca(gambar: Gambar): string | null {
  const alat = new MultiFormatReader();
  alat.setHints(
    new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]],
      [DecodeHintType.TRY_HARDER, true],
    ]),
  );

  const sumber = new RGBLuminanceSource(gambar.data, gambar.lebar, gambar.tinggi);

  try {
    return alat.decode(new BinaryBitmap(new HybridBinarizer(sumber))).getText();
  } catch {
    return null;
  }
}

describe("jangkauan pemindaian kamera", () => {
  it("setiap jangkauan masih memuat barcode utuh", () => {
    const bingkai = bingkaiDenganBarcode("MTB-023");

    for (const [nomor, bagian] of JANGKAUAN.entries()) {
      expect(baca(potong(bingkai, bagian)), `jangkauan ke-${nomor + 1}`).toBe("MTB-023");
    }
  });

  it("jangkauan pertama adalah seluruh bingkai", () => {
    // Dari dekat, memotong berisiko memangkas ujung barcode beserta ruang
    // putihnya. Karena itu yang penuh harus selalu dicoba lebih dulu.
    expect(JANGKAUAN[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("tidak ada jangkauan yang keluar dari bingkai", () => {
    for (const bagian of JANGKAUAN) {
      expect(bagian.x + bagian.w).toBeLessThanOrEqual(1);
      expect(bagian.y + bagian.h).toBeLessThanOrEqual(1);
    }
  });
});

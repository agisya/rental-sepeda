import bwipjs from "bwip-js/node";
import {
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { OPSI_QR, SUNYI_MODUL } from "@/lib/qr";

/**
 * Perkakas bersama untuk uji yang perlu QR sungguhan sebagai piksel.
 *
 * Dipakai dua berkas uji: yang memeriksa stiker cetak bisa dibaca kembali, dan
 * yang memeriksa jangkauan potongan kamera tidak memangkasnya. Penggambaran
 * piksel dan zona sunyinya harus sama di keduanya — kalau tidak, satu uji bisa
 * lulus karena menggambar lebih longgar daripada yang lain.
 */

export const PUTIH = 0xff;
export const HITAM = 0x00;

export type Gambar = { data: Uint8ClampedArray; lebar: number; tinggi: number };

/** Satu modul digambar sebesar ini supaya menyerupai hasil cetak, bukan pola sempit. */
export const SKALA = 6;

/**
 * Menggambar QR menjadi gambar hitam-putih beserta zona sunyinya.
 *
 * Zona sunyi bukan hiasan. Pembaca menemukan pola pencari di tiga sudut dengan
 * membandingkannya terhadap latar kosong di sekelilingnya; tanpa itu, QR yang
 * mepet tepi gambar tidak akan pernah ditemukan.
 */
export function gambarQr(teks: string): Gambar {
  const [bagian] = bwipjs.raw({ ...OPSI_QR, text: teks });

  // Simbologi garis mengembalikan sbs, simbologi matriks mengembalikan pixs.
  // Tipenya menggabungkan keduanya, jadi keberadaannya diperiksa dan bukan
  // diasumsikan.
  if (!("pixs" in bagian)) {
    throw new Error(`bwip-js tidak mengembalikan matriks untuk "${teks}"`);
  }

  const { pixs, pixx, pixy } = bagian;
  const sunyi = SUNYI_MODUL * SKALA;
  const lebar = pixx * SKALA + sunyi * 2;
  const tinggi = pixy * SKALA + sunyi * 2;

  const data = new Uint8ClampedArray(lebar * tinggi).fill(PUTIH);

  for (let y = 0; y < pixy; y += 1) {
    for (let x = 0; x < pixx; x += 1) {
      if (!pixs[y * pixx + x]) continue;

      for (let dy = 0; dy < SKALA; dy += 1) {
        const awal = (sunyi + y * SKALA + dy) * lebar + sunyi + x * SKALA;
        for (let dx = 0; dx < SKALA; dx += 1) data[awal + dx] = HITAM;
      }
    }
  }

  return { data, lebar, tinggi };
}

/** Membaca gambar memakai pembaca QR yang sama dengan yang dipakai kamera. */
export function bacaQr(gambar: Gambar): string | null {
  const sumber = new RGBLuminanceSource(gambar.data, gambar.lebar, gambar.tinggi);
  const petunjuk = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);

  try {
    return new QRCodeReader()
      .decode(new BinaryBitmap(new HybridBinarizer(sumber)), petunjuk)
      .getText();
  } catch {
    return null;
  }
}

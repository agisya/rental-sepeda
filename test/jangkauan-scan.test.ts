import { describe, expect, it } from "vitest";
import { JANGKAUAN } from "@/lib/scan/jangkauan";
import { bacaQr, gambarQr, type Gambar, PUTIH } from "./qr-uji";

/**
 * Menjaga agar jangkauan pemindaian tidak memangkas QR.
 *
 * Pemindai kamera membaca beberapa potongan bingkai secara bergantian. Satu
 * angka yang digeser sedikit saja bisa membuat potongan itu memotong tepi QR —
 * dan QR yang kehilangan salah satu pola pencari di sudutnya tidak terbaca sama
 * sekali. Kegagalannya hanya muncul di lapangan, sebagai "kadang bisa kadang
 * tidak", yang hampir mustahil ditelusuri.
 *
 * Bentuk potongannya penting justru karena QR persegi. Pita lebar-pendek yang
 * cocok untuk barcode garis akan memangkas atas dan bawah QR berukuran sedang,
 * meski lebarnya berlebih. Uji ini menaruh QR di tengah bingkai berbanding 16:9
 * seperti kamera sungguhan, lalu membaca setiap jangkauan yang benar-benar
 * dipakai aplikasi.
 */

/** Perbandingan bingkai kamera yang diminta aplikasi: 1920×1080. */
const RASIO_BINGKAI = 16 / 9;

/**
 * QR di tengah bingkai yang jauh lebih besar, seperti stiker sepeda yang
 * dilihat dari jarak sedang. Ruang putih di sekelilingnya terbentuk sendiri.
 *
 * Sepertiga tinggi bingkai dipilih karena itulah jarak pandang yang wajar saat
 * petugas mengarahkan HP ke rangka sepeda — cukup jauh untuk memuat seluruh
 * stiker, cukup dekat untuk terbaca.
 */
function bingkaiDenganQr(teks: string, bagianTinggi = 1 / 3): Gambar {
  const qr = gambarQr(teks);

  const tinggi = Math.round(qr.tinggi / bagianTinggi);
  const lebar = Math.round(tinggi * RASIO_BINGKAI);

  const data = new Uint8ClampedArray(lebar * tinggi).fill(PUTIH);

  const kiri = Math.floor((lebar - qr.lebar) / 2);
  const atas = Math.floor((tinggi - qr.tinggi) / 2);

  for (let y = 0; y < qr.tinggi; y += 1) {
    const sumber = y * qr.lebar;
    data.set(qr.data.subarray(sumber, sumber + qr.lebar), (atas + y) * lebar + kiri);
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

describe("jangkauan pemindaian kamera", () => {
  /*
    Diuji pada beberapa jarak, bukan satu. Pada jarak sepertiga saja, pita
    lebar-pendek peninggalan barcode garis ternyata masih lolos — pemangkasannya
    hanya menyerempet zona sunyi, belum mengenai pola pencari. Uji yang lolos
    untuk bentuk potongan yang salah tidak menjaga apa pun.
  */
  it("setiap jangkauan masih memuat QR utuh pada jarak yang wajar", () => {
    for (const bagianTinggi of [1 / 3, 1 / 5, 1 / 8]) {
      const bingkai = bingkaiDenganQr("MTB-023", bagianTinggi);

      for (const [nomor, bagian] of JANGKAUAN.entries()) {
        expect(
          bacaQr(potong(bingkai, bagian)),
          `jangkauan ke-${nomor + 1} pada QR setinggi ${bagianTinggi.toFixed(3)} bingkai`,
        ).toBe("MTB-023");
      }
    }
  });

  /*
    Dari dekat, QR-nya lebih besar daripada potongan mana pun, jadi hanya
    bingkai penuh yang bisa memuatnya. Itu bukan kekurangan — justru itulah
    alasan bingkai penuh selalu dicoba lebih dulu.
  */
  it("dari jarak dekat, bingkai penuh yang menangkapnya", () => {
    const bingkai = bingkaiDenganQr("MTB-023", 0.9);

    expect(bacaQr(potong(bingkai, JANGKAUAN[0]))).toBe("MTB-023");
  });

  it("jangkauan pertama adalah seluruh bingkai", () => {
    // Dari dekat, memotong berisiko memangkas tepi QR beserta zona sunyinya.
    // Karena itu yang penuh harus selalu dicoba lebih dulu.
    expect(JANGKAUAN[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("tidak ada jangkauan yang keluar dari bingkai", () => {
    for (const bagian of JANGKAUAN) {
      expect(bagian.x + bagian.w).toBeLessThanOrEqual(1);
      expect(bagian.y + bagian.h).toBeLessThanOrEqual(1);
    }
  });

  /*
    Inti perbedaannya dari barcode garis. Potongan yang lebarnya berlebih tapi
    tingginya kurang akan memangkas QR berukuran sedang, dan kelebihan lebar itu
    tidak menolong sedikit pun. Angka yang dipilih menghasilkan potongan yang
    mendekati persegi pada bingkai 16:9 — properti inilah yang harus bertahan,
    bukan angka-angka tertentu, sehingga penyuntingan berikutnya tetap terjaga.
  */
  it("potongan di dalam bingkai berbentuk mendekati persegi", () => {
    for (const bagian of JANGKAUAN.slice(1)) {
      const rasio = (bagian.w * RASIO_BINGKAI) / bagian.h;
      expect(rasio, JSON.stringify(bagian)).toBeGreaterThan(0.75);
      expect(rasio, JSON.stringify(bagian)).toBeLessThan(1.35);
    }
  });

  it("potongan tersempit masih memuat QR yang mengisi sepertiga tinggi bingkai", () => {
    // Batas yang sebenarnya, dinyatakan sebagai geometri dan bukan sebagai
    // gambar: potongan paling sempit harus tetap lebih besar dari QR-nya.
    const tersempit = JANGKAUAN[JANGKAUAN.length - 1];

    expect(tersempit.h).toBeGreaterThan(1 / 3);
    expect(tersempit.w * RASIO_BINGKAI).toBeGreaterThan(1 / 3);
  });
});

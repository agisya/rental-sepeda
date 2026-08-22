import { describe, expect, it } from "vitest";
import {
  hitungBiaya,
  hitungDurasiMenit,
  hitungJamPokok,
  hitungSaranTambahan,
  hitungSisaMenit,
} from "./pricing";

const TARIF = 15_000;
const TOLERANSI = 5;

function menitSetelah(mulai: Date, menit: number) {
  return new Date(mulai.getTime() + menit * 60_000);
}

const MULAI = new Date("2026-08-14T02:00:00.000Z"); // 09:00 WIB

function biayaSetelah(menit: number, tambahan?: number) {
  return hitungBiaya({
    waktuMulai: MULAI,
    waktuSelesai: menitSetelah(MULAI, menit),
    tarifPerJam: TARIF,
    persentasePemilik: 60,
    toleransiMenit: TOLERANSI,
    tambahanDitagih: tambahan,
  });
}

describe("hitungDurasiMenit", () => {
  it("menghitung selisih menit yang pas", () => {
    expect(hitungDurasiMenit(MULAI, menitSetelah(MULAI, 90))).toBe(90);
  });

  it("membulatkan detik ke atas menjadi satu menit penuh", () => {
    const selesai = new Date(MULAI.getTime() + 61_000); // 1 menit 1 detik
    expect(hitungDurasiMenit(MULAI, selesai)).toBe(2);
  });

  it("mengembalikan 0 kalau selesai sama dengan mulai", () => {
    expect(hitungDurasiMenit(MULAI, MULAI)).toBe(0);
  });

  it("menolak waktu selesai sebelum waktu mulai", () => {
    expect(() => hitungDurasiMenit(MULAI, menitSetelah(MULAI, -1))).toThrow(
      /sebelum waktu mulai/i,
    );
  });
});

describe("hitungJamPokok — bulatkan ke BAWAH per jam, minimum 1 jam", () => {
  it.each([
    [0, 1],
    [1, 1],
    [30, 1],
    [59, 1],
    [60, 1],
    [61, 1],
    [119, 1],
    [120, 2],
    [121, 2],
    [1440, 24],
  ])("durasi %i menit menghasilkan pokok %i jam", (menit, jam) => {
    expect(hitungJamPokok(menit)).toBe(jam);
  });
});

describe("hitungSisaMenit", () => {
  it.each([
    [0, 0],
    [20, 0], // di bawah satu jam, sudah terserap minimum 1 jam
    [59, 0],
    [60, 0],
    [64, 4],
    [90, 30],
    [119, 59],
    [120, 0],
    [130, 10],
  ])("durasi %i menit menyisakan %i menit", (menit, sisa) => {
    expect(hitungSisaMenit(menit)).toBe(sisa);
  });

  // Inilah yang membuat denda tidak pernah melebihi satu jam tarif. Kalau
  // invarian ini pecah, seluruh jaminan batas atas denda ikut pecah.
  it("tidak pernah negatif dan selalu di bawah 60", () => {
    for (let menit = 0; menit <= 600; menit++) {
      const sisa = hitungSisaMenit(menit);
      expect(sisa).toBeGreaterThanOrEqual(0);
      expect(sisa).toBeLessThan(60);
    }
  });
});

describe("hitungSaranTambahan — per setengah jam, nol di dalam toleransi", () => {
  it.each([
    [0, 0],
    [1, 0],
    [5, 0], // tepat di batas toleransi masih dianggap wajar
    [6, 7_500],
    [10, 7_500],
    [30, 7_500],
    [31, 15_000],
    [45, 15_000],
    [59, 15_000],
  ])("sisa %i menit disarankan Rp%i", (sisa, saran) => {
    expect(hitungSaranTambahan(sisa, TARIF, TOLERANSI)).toBe(saran);
  });

  it("tidak pernah melebihi satu jam tarif", () => {
    for (let sisa = 0; sisa < 60; sisa++) {
      expect(hitungSaranTambahan(sisa, TARIF, TOLERANSI)).toBeLessThanOrEqual(TARIF);
    }
  });

  it("toleransi nol berarti lewat semenit pun kena tambahan", () => {
    expect(hitungSaranTambahan(1, TARIF, 0)).toBe(7_500);
  });
});

describe("hitungBiaya — tabel di spesifikasi", () => {
  // Tarif 5.000 supaya angkanya persis sama dengan tabel di
  // docs/superpowers/specs/2026-08-21-biaya-keterlambatan-design.md
  const TARIF_KECIL = 5_000;

  it.each([
    // durasi, pokokJam, sisa, saran, total
    [20, 1, 0, 0, 5_000],
    [64, 1, 4, 0, 5_000],
    [90, 1, 30, 2_500, 7_500],
    [130, 2, 10, 2_500, 12_500],
    [165, 2, 45, 5_000, 15_000],
  ])(
    "durasi %i menit: %i jam pokok, sisa %i, saran %i, total %i",
    (menit, jam, sisa, saran, total) => {
      const hasil = hitungBiaya({
        waktuMulai: MULAI,
        waktuSelesai: menitSetelah(MULAI, menit),
        tarifPerJam: TARIF_KECIL,
        persentasePemilik: 60,
        toleransiMenit: TOLERANSI,
      });

      expect(hasil.durasiMenit).toBe(menit);
      expect(hasil.durasiJamDitagih).toBe(jam);
      expect(hasil.sisaMenit).toBe(sisa);
      expect(hasil.tambahanSaran).toBe(saran);
      expect(hasil.totalBiaya).toBe(total);
    },
  );

  it("keluhan aslinya: telat 4 menit tidak lagi ditagih dobel", () => {
    const hasil = biayaSetelah(64);
    expect(hasil.totalBiaya).toBe(TARIF); // dulu 2 × TARIF
  });
});

describe("hitungBiaya — tambahan yang ditagih kasir", () => {
  it("memakai saran kalau kasir tidak mengubah apa pun", () => {
    const hasil = biayaSetelah(90);
    expect(hasil.tambahanSaran).toBe(7_500);
    expect(hasil.tambahanDitagih).toBe(7_500);
    expect(hasil.totalBiaya).toBe(TARIF + 7_500);
  });

  it("boleh diturunkan sampai nol", () => {
    const hasil = biayaSetelah(90, 0);
    expect(hasil.tambahanDitagih).toBe(0);
    expect(hasil.totalBiaya).toBe(TARIF);
  });

  it("boleh diturunkan sebagian", () => {
    const hasil = biayaSetelah(90, 3_000);
    expect(hasil.tambahanDitagih).toBe(3_000);
    expect(hasil.totalBiaya).toBe(TARIF + 3_000);
  });

  // Arah inilah yang lebih berbahaya daripada memberi keringanan: menagih
  // penyewa di atas aturan, lalu selisihnya tidak sampai ke laci.
  it("menolak tambahan yang lebih besar dari saran", () => {
    expect(() => biayaSetelah(90, 7_501)).toThrow(/melebihi saran/i);
  });

  it("menolak tambahan pada rental yang tidak telat", () => {
    expect(() => biayaSetelah(64, 1_000)).toThrow(/melebihi saran/i);
  });

  it("menolak tambahan negatif atau tidak bulat", () => {
    expect(() => biayaSetelah(90, -1)).toThrow(/tambahan/i);
    expect(() => biayaSetelah(90, 1_000.5)).toThrow(/tambahan/i);
  });
});

describe("hitungBiaya — bagi hasil", () => {
  it("membagi tambahan keterlambatan seperti uang sewa biasa", () => {
    const hasil = biayaSetelah(90);
    expect(hasil.totalBiaya).toBe(22_500);
    expect(hasil.bagianPemilik).toBe(13_500); // 60%
    expect(hasil.bagianRental).toBe(9_000);
  });

  it("memberi seluruh omzet ke rental kalau persentase pemilik 0", () => {
    const hasil = hitungBiaya({
      waktuMulai: MULAI,
      waktuSelesai: menitSetelah(MULAI, 60),
      tarifPerJam: TARIF,
      persentasePemilik: 0,
      toleransiMenit: TOLERANSI,
    });

    expect(hasil.bagianPemilik).toBe(0);
    expect(hasil.bagianRental).toBe(TARIF);
  });

  // Invarian terpenting di seluruh aplikasi. Kalau pembulatan bagi hasil
  // meleset satu rupiah pun, laporan omzet tidak akan pernah cocok dengan
  // jumlah bagian pemilik ditambah bagian rental.
  it("selalu menjaga bagianPemilik + bagianRental === totalBiaya", () => {
    const tarifUji = [1_000, 7_500, 12_500, 15_000, 17_777, 33_333];
    const persenUji = [0, 33, 45, 50, 55, 60, 67, 70, 100];
    const menitUji = [1, 45, 61, 64, 90, 130, 187, 359, 1_441];

    for (const tarifPerJam of tarifUji) {
      for (const persentasePemilik of persenUji) {
        for (const menit of menitUji) {
          const hasil = hitungBiaya({
            waktuMulai: MULAI,
            waktuSelesai: menitSetelah(MULAI, menit),
            tarifPerJam,
            persentasePemilik,
            toleransiMenit: TOLERANSI,
          });

          expect(hasil.bagianPemilik + hasil.bagianRental).toBe(hasil.totalBiaya);
          expect(Number.isInteger(hasil.bagianPemilik)).toBe(true);
          expect(Number.isInteger(hasil.bagianRental)).toBe(true);
          expect(hasil.bagianPemilik).toBeGreaterThanOrEqual(0);
          expect(hasil.bagianRental).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe("hitungBiaya — masukan yang tidak sah", () => {
  it("tidak pernah menghasilkan biaya nol walau sepeda langsung dikembalikan", () => {
    const hasil = biayaSetelah(0);
    expect(hasil.durasiJamDitagih).toBe(1);
    expect(hasil.totalBiaya).toBe(TARIF);
  });

  it("menolak persentase di luar 0..100", () => {
    expect(() =>
      hitungBiaya({
        waktuMulai: MULAI,
        waktuSelesai: menitSetelah(MULAI, 60),
        tarifPerJam: TARIF,
        persentasePemilik: 120,
        toleransiMenit: TOLERANSI,
      }),
    ).toThrow(/persentase/i);
  });

  it("menolak tarif negatif atau tidak bulat", () => {
    for (const tarifPerJam of [-1, 15_000.5]) {
      expect(() =>
        hitungBiaya({
          waktuMulai: MULAI,
          waktuSelesai: menitSetelah(MULAI, 60),
          tarifPerJam,
          persentasePemilik: 60,
          toleransiMenit: TOLERANSI,
        }),
      ).toThrow(/tarif/i);
    }
  });

  it("menolak toleransi negatif atau tidak bulat", () => {
    for (const toleransiMenit of [-1, 5.5]) {
      expect(() =>
        hitungBiaya({
          waktuMulai: MULAI,
          waktuSelesai: menitSetelah(MULAI, 60),
          tarifPerJam: TARIF,
          persentasePemilik: 60,
          toleransiMenit,
        }),
      ).toThrow(/toleransi/i);
    }
  });
});

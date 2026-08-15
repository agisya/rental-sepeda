import { describe, expect, it } from "vitest";
import { hitungBiaya, hitungDurasiMenit, hitungJamDitagih } from "./pricing";

const TARIF = 15_000;

function menitSetelah(mulai: Date, menit: number) {
  return new Date(mulai.getTime() + menit * 60_000);
}

const MULAI = new Date("2026-08-14T02:00:00.000Z"); // 09:00 WIB

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

describe("hitungJamDitagih — bulatkan ke atas per jam, minimum 1 jam", () => {
  it.each([
    [0, 1],
    [1, 1],
    [30, 1],
    [59, 1],
    [60, 1],
    [61, 2],
    [119, 2],
    [120, 2],
    [121, 3],
    [1440, 24],
  ])("durasi %i menit ditagih %i jam", (menit, jam) => {
    expect(hitungJamDitagih(menit)).toBe(jam);
  });
});

describe("hitungBiaya", () => {
  it("menagih 1 jam untuk sewa 45 menit", () => {
    const hasil = hitungBiaya({
      waktuMulai: MULAI,
      waktuSelesai: menitSetelah(MULAI, 45),
      tarifPerJam: TARIF,
      persentasePemilik: 60,
    });

    expect(hasil.durasiMenit).toBe(45);
    expect(hasil.durasiJamDitagih).toBe(1);
    expect(hasil.totalBiaya).toBe(15_000);
    expect(hasil.bagianPemilik).toBe(9_000);
    expect(hasil.bagianRental).toBe(6_000);
  });

  it("menagih 2 jam untuk sewa 1 jam 10 menit", () => {
    const hasil = hitungBiaya({
      waktuMulai: MULAI,
      waktuSelesai: menitSetelah(MULAI, 70),
      tarifPerJam: TARIF,
      persentasePemilik: 60,
    });

    expect(hasil.durasiJamDitagih).toBe(2);
    expect(hasil.totalBiaya).toBe(30_000);
    expect(hasil.bagianPemilik).toBe(18_000);
    expect(hasil.bagianRental).toBe(12_000);
  });

  it("mencocokkan contoh di spesifikasi: 86 jam tarif 15.000 bagi hasil 60%", () => {
    const hasil = hitungBiaya({
      waktuMulai: MULAI,
      waktuSelesai: menitSetelah(MULAI, 86 * 60),
      tarifPerJam: TARIF,
      persentasePemilik: 60,
    });

    expect(hasil.totalBiaya).toBe(1_290_000);
    expect(hasil.bagianPemilik).toBe(774_000);
    expect(hasil.bagianRental).toBe(516_000);
  });

  it("tidak pernah menghasilkan biaya nol walau sepeda langsung dikembalikan", () => {
    const hasil = hitungBiaya({
      waktuMulai: MULAI,
      waktuSelesai: MULAI,
      tarifPerJam: TARIF,
      persentasePemilik: 60,
    });

    expect(hasil.durasiJamDitagih).toBe(1);
    expect(hasil.totalBiaya).toBe(15_000);
  });

  // Ini invarian terpenting di seluruh aplikasi. Kalau pembulatan bagi hasil
  // meleset satu rupiah pun, laporan omzet tidak akan pernah cocok dengan
  // jumlah bagian pemilik ditambah bagian rental.
  it("selalu menjaga bagianPemilik + bagianRental === totalBiaya", () => {
    const tarifUji = [1_000, 7_500, 12_500, 15_000, 17_777, 33_333];
    const persenUji = [0, 33, 45, 50, 55, 60, 67, 70, 100];
    const menitUji = [1, 45, 61, 130, 187, 359, 1_441];

    for (const tarifPerJam of tarifUji) {
      for (const persentasePemilik of persenUji) {
        for (const menit of menitUji) {
          const hasil = hitungBiaya({
            waktuMulai: MULAI,
            waktuSelesai: menitSetelah(MULAI, menit),
            tarifPerJam,
            persentasePemilik,
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

  it("memberi seluruh omzet ke rental kalau persentase pemilik 0", () => {
    const hasil = hitungBiaya({
      waktuMulai: MULAI,
      waktuSelesai: menitSetelah(MULAI, 60),
      tarifPerJam: TARIF,
      persentasePemilik: 0,
    });

    expect(hasil.bagianPemilik).toBe(0);
    expect(hasil.bagianRental).toBe(15_000);
  });

  it("menolak persentase di luar 0..100", () => {
    expect(() =>
      hitungBiaya({
        waktuMulai: MULAI,
        waktuSelesai: menitSetelah(MULAI, 60),
        tarifPerJam: TARIF,
        persentasePemilik: 120,
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
        }),
      ).toThrow(/tarif/i);
    }
  });
});

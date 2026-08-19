import { describe, expect, it } from "vitest";
import { namaOrang, noHpKontak, noHpWa, rupiahPositif } from "./validasi";

/**
 * Aturan isian yang dipakai bersama.
 *
 * Yang dijaga di sini bukan sekadar "menolak yang salah", tapi juga tidak
 * menolak yang benar. Validasi yang terlalu ketat lebih berbahaya daripada yang
 * longgar: petugas yang nomornya sah tapi ditolak akan mengetik nomor palsu
 * supaya bisa lanjut, dan sejak itu datanya tidak bisa dipercaya lagi.
 */

const lolos = (skema: { safeParse: (v: unknown) => { success: boolean } }, nilai: string) =>
  skema.safeParse(nilai).success;

describe("nomor yang harus bisa di-WhatsApp", () => {
  it("menerima bentuk-bentuk nomor seluler yang lazim ditulis orang", () => {
    for (const n of [
      "081234567890",
      "0812 3456 7890",
      "0812-3456-7890",
      "+6281234567890",
      "6281234567890",
      "0851234567", // 10 angka, batas terpendek
    ]) {
      expect(lolos(noHpWa, n), n).toBe(true);
    }
  });

  it("menyatukan bentuk yang berbeda menjadi satu nomor", () => {
    // Penyewa dikenali dari nomornya. Kalau +62 dan 08 tersimpan berbeda, orang
    // yang sama akan terdata dua kali dan riwayatnya terpecah.
    const bentuk = ["081234567890", "+6281234567890", "6281234567890", "0812-3456-7890"];
    const hasil = bentuk.map((b) => noHpWa.parse(b));

    expect(new Set(hasil).size).toBe(1);
    expect(hasil[0]).toBe("081234567890");
  });

  it("menolak yang tidak mungkin dihubungi", () => {
    for (const n of ["1", "08", "abcd", "+++", "0262123456", "0812345678901234"]) {
      expect(lolos(noHpWa, n), n).toBe(false);
    }
  });
});

describe("nomor kontak yang tidak harus seluler", () => {
  it("menerima telepon rumah, karena masih lazim dipakai pemilik sepeda", () => {
    // Memaksa berawalan 08 di sini akan menolak nomor yang benar-benar dipakai.
    for (const n of ["0262123456", "02621234567", "081234567890"]) {
      expect(lolos(noHpKontak, n), n).toBe(true);
    }
  });

  it("tetap menolak yang bukan nomor", () => {
    for (const n of ["1", "abcd", "62812", "9812345678"]) {
      expect(lolos(noHpKontak, n), n).toBe(false);
    }
  });
});

describe("nama orang", () => {
  it("menerima nama yang benar-benar dipakai", () => {
    for (const n of ["Andi", "Budi Santoso", "H. Dedi", "Siti Nur'aini", "Ang Lie"]) {
      expect(lolos(namaOrang, n), n).toBe(true);
    }
  });

  it("menolak yang tidak memuat huruf sama sekali", () => {
    // Panjang minimal saja tidak cukup: "12" dan "--" lolos, dan daftar penyewa
    // jadi tidak bisa dipakai mengenali siapa pun.
    for (const n of ["12", "--", "...", "1234"]) {
      expect(lolos(namaOrang, n), n).toBe(false);
    }
  });

  it("menolak yang terlalu pendek", () => {
    expect(lolos(namaOrang, "A")).toBe(false);
    expect(lolos(namaOrang, " ")).toBe(false);
  });
});

describe("nominal rupiah", () => {
  it("menerima angka bulat wajar, termasuk yang bukan kelipatan ribuan", () => {
    // 9.000 pernah ditolak karena step formulirnya 1000; aturan di sisi server
    // tidak boleh mengulang kekeliruan yang sama.
    for (const n of [1, 9000, 12500, 999_999_999]) {
      expect(rupiahPositif.safeParse(n).success, String(n)).toBe(true);
    }
  });

  it("menolak nol, negatif, pecahan, dan yang tidak masuk akal", () => {
    for (const n of [0, -1, 1500.5, 2_000_000_000]) {
      expect(rupiahPositif.safeParse(n).success, String(n)).toBe(false);
    }
  });
});

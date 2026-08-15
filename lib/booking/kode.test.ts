import { describe, expect, it } from "vitest";
import { idDariKodeBooking, kodeBooking } from "./kode";

describe("kode booking", () => {
  it("memberi nomor berpadding supaya rapi dibacakan", () => {
    expect(kodeBooking(1)).toBe("BK-0001");
    expect(kodeBooking(31)).toBe("BK-0031");
    expect(kodeBooking(9999)).toBe("BK-9999");
  });

  it("tetap bekerja setelah melewati empat digit", () => {
    expect(kodeBooking(12345)).toBe("BK-12345");
  });

  it("menolak id yang tidak masuk akal", () => {
    for (const id of [0, -1, 1.5, NaN]) {
      expect(() => kodeBooking(id)).toThrow(/id booking/i);
    }
  });

  it("bisa dibaca kembali menjadi id semula", () => {
    for (const id of [1, 31, 9999, 12345]) {
      expect(idDariKodeBooking(kodeBooking(id))).toBe(id);
    }
  });

  // Petugas mengetik ulang kode yang dibacakan penyewa lewat telepon, jadi
  // huruf kecil dan spasi yang tidak sengaja harus tetap dikenali.
  it("memaafkan huruf kecil dan spasi saat diketik ulang", () => {
    expect(idDariKodeBooking("bk-0031")).toBe(31);
    expect(idDariKodeBooking("  BK-0031  ")).toBe(31);
    expect(idDariKodeBooking("BK - 0031")).toBe(31);
    expect(idDariKodeBooking("BK-31")).toBe(31);
  });

  it("mengembalikan null untuk kode yang tidak masuk akal", () => {
    for (const salah of ["", "BK-", "0031", "XX-0031", "BK-abc", "BK-0031x"]) {
      expect(idDariKodeBooking(salah)).toBeNull();
    }
  });
});

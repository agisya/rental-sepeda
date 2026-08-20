import { describe, expect, it } from "vitest";
import { bacaTema, temaBerikutnya, temaEfektif, type Tema } from "./tema";

describe("baca tema tersimpan", () => {
  it("mengenali dua pilihan yang memang pernah disimpan", () => {
    expect(bacaTema("terang")).toBe("terang");
    expect(bacaTema("gelap")).toBe("gelap");
  });

  it("menganggap belum pernah memilih sebagai ikut sistem", () => {
    expect(bacaTema(null)).toBe("sistem");
    expect(bacaTema("")).toBe("sistem");
  });

  // Nilai di localStorage bisa saja tertinggal dari versi lama, disunting
  // tangan lewat devtools, atau dipakai aplikasi lain di domain yang sama.
  // Apa pun yang tidak dikenali diperlakukan seperti belum memilih, bukan
  // dibiarkan lolos dan merusak perbandingan di tempat lain.
  it("mengabaikan nilai yang tidak dikenali", () => {
    for (const asing of ["dark", "light", "sistem", "GELAP", "null", "0"]) {
      expect(bacaTema(asing)).toBe("sistem");
    }
  });
});

describe("tema yang benar-benar tampil", () => {
  it("membiarkan pilihan sendiri menang atas setelan sistem, ke dua arah", () => {
    expect(temaEfektif("terang", true)).toBe("terang");
    expect(temaEfektif("gelap", false)).toBe("gelap");
  });

  it("mengikuti setelan sistem selama belum ada yang dipilih", () => {
    expect(temaEfektif("sistem", true)).toBe("gelap");
    expect(temaEfektif("sistem", false)).toBe("terang");
  });
});

describe("tema setelah tombol ditekan", () => {
  it("membalik pilihan yang sudah eksplisit", () => {
    expect(temaBerikutnya("terang", false)).toBe("gelap");
    expect(temaBerikutnya("gelap", true)).toBe("terang");
  });

  /*
    Inti tombolnya. Petugas yang belum pernah menyentuh tema ada di keadaan
    "sistem", dan menebak "sistem berarti terang" membuat tombol terasa rusak
    bagi orang yang ponselnya sedang gelap: klik pertama menyetel "gelap" ke
    layar yang memang sudah gelap, jadi tidak terjadi apa-apa. Karena itu
    setelan sistem dibaca dulu, bukan diasumsikan.
  */
  it("tetap membalik yang terlihat walau tema masih ikut sistem", () => {
    expect(temaBerikutnya("sistem", true)).toBe("terang");
    expect(temaBerikutnya("sistem", false)).toBe("gelap");
  });

  it("tidak pernah menghasilkan tema yang sedang tampil", () => {
    const semua: Tema[] = ["sistem", "terang", "gelap"];

    for (const tema of semua) {
      for (const sistemGelap of [true, false]) {
        expect(temaBerikutnya(tema, sistemGelap)).not.toBe(
          temaEfektif(tema, sistemGelap),
        );
      }
    }
  });
});

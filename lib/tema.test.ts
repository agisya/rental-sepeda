import { describe, expect, it } from "vitest";
import { bacaTema, temaBerikutnya, type Tema } from "./tema";

describe("baca tema tersimpan", () => {
  it("mengenali dua pilihan yang memang pernah disimpan", () => {
    expect(bacaTema("terang")).toBe("terang");
    expect(bacaTema("gelap")).toBe("gelap");
  });

  it("menganggap belum pernah memilih sebagai terang", () => {
    expect(bacaTema(null)).toBe("terang");
    expect(bacaTema("")).toBe("terang");
  });

  // Sebelum tema disederhanakan jadi dua keadaan, "sistem" adalah pilihan sah
  // yang bisa saja masih tersimpan di localStorage peninjau yang pernah
  // membuka aplikasi ini di versi lama. Tipe Tema sekarang hanya
  // "terang" | "gelap", jadi nilai itu harus jatuh ke "terang", bukan lolos
  // sebagai nilai ketiga yang sudah tidak ada tempatnya.
  it("membaca nilai lama \"sistem\" sebagai terang", () => {
    expect(bacaTema("sistem")).toBe("terang");
  });

  // Nilai di localStorage bisa saja disunting tangan lewat devtools, atau
  // dipakai aplikasi lain di domain yang sama. Apa pun yang tidak dikenali
  // diperlakukan seperti belum memilih, bukan dibiarkan lolos dan merusak
  // perbandingan di tempat lain.
  it("mengabaikan nilai yang tidak dikenali", () => {
    for (const asing of ["dark", "light", "GELAP", "null", "0"]) {
      expect(bacaTema(asing)).toBe("terang");
    }
  });
});

describe("tema setelah tombol ditekan", () => {
  it("membalik tema yang sedang tampil", () => {
    expect(temaBerikutnya("terang")).toBe("gelap");
    expect(temaBerikutnya("gelap")).toBe("terang");
  });

  it("tidak pernah menghasilkan tema yang sedang tampil", () => {
    const semua: Tema[] = ["terang", "gelap"];

    for (const tema of semua) {
      expect(temaBerikutnya(tema)).not.toBe(tema);
    }
  });
});

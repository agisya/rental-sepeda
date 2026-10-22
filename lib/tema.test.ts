import { describe, expect, it } from "vitest";
import { bacaTema, SKRIP_TEMA, temaBerikutnya, WARNA_BILAH, type Tema } from "./tema";

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

/**
 * Skrip anti-kedip dijalankan sungguhan terhadap tiruan kecil peramban.
 * Yang diuji teksnya yang dikirim ke <head>, bukan salinan logikanya — salah
 * ketik di dalam string itu tidak akan tertangkap pemeriksa tipe.
 */
function jalankanSkrip(tersimpan: string | null | Error) {
  const akar = { dataset: {} as Record<string, string> };
  const meta = { content: WARNA_BILAH.terang };
  const localStorage = {
    getItem: () => {
      if (tersimpan instanceof Error) throw tersimpan;
      return tersimpan;
    },
  };
  const document = { documentElement: akar, querySelector: () => meta };

  new Function("localStorage", "document", SKRIP_TEMA)(localStorage, document);
  return { tema: akar.dataset.theme, bilah: meta.content };
}

describe("skrip anti-kedip", () => {
  it("menggelapkan halaman dan bilah peramban bagi yang memilih gelap", () => {
    expect(jalankanSkrip("gelap")).toEqual({ tema: "dark", bilah: WARNA_BILAH.gelap });
  });

  it("membiarkan halaman terang untuk pilihan lain", () => {
    for (const nilai of ["terang", "sistem", null]) {
      expect(jalankanSkrip(nilai)).toEqual({ tema: undefined, bilah: WARNA_BILAH.terang });
    }
  });

  it("tidak melempar galat saat penyimpanan diblokir", () => {
    expect(() => jalankanSkrip(new Error("SecurityError"))).not.toThrow();
  });
});

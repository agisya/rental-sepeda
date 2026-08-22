import { describe, expect, it } from "vitest";
import { nomorWa, pesanWa, tautanWa } from "./kontak";

describe("nomorWa", () => {
  it.each([
    ["081234567890", "6281234567890"],
    ["0812-3456-7890", "6281234567890"],
    ["0812 3456 7890", "6281234567890"],
    ["+6281234567890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    // Sebagian orang menulis nomornya tanpa nol di depan.
    ["81234567890", "6281234567890"],
  ])("mengubah %s menjadi %s", (masukan, hasil) => {
    expect(nomorWa(masukan)).toBe(hasil);
  });

  // Kolom nomor bertipe teks bebas, jadi isinya bisa apa saja. Yang tidak bisa
  // menerima WhatsApp harus mengembalikan null supaya tombolnya disembunyikan,
  // bukan menghasilkan tautan yang membuka percakapan kosong.
  it.each([
    ["nomor rumah Garut", "0265123456"],
    ["kosong", ""],
    ["spasi saja", "   "],
    ["bukan angka", "hubungi lewat toko"],
    ["terlalu pendek", "0812345"],
    ["terlalu panjang", "08123456789012345"],
    ["kode negara lain", "+601234567890"],
  ])("menolak %s", (_nama, masukan) => {
    expect(nomorWa(masukan)).toBeNull();
  });

  it("menolak null dan undefined tanpa melempar", () => {
    expect(nomorWa(null)).toBeNull();
    expect(nomorWa(undefined)).toBeNull();
  });

  // Batasnya harus sama persis dengan noHpWa di lib/validasi.ts, yang menerima
  // 10–14 angka lokal. Kalau keduanya bergeser sendiri-sendiri, nomor yang sah
  // saat disimpan bisa kehilangan tombol WhatsApp-nya tanpa penjelasan apa pun.
  describe("batasnya sama persis dengan validator aplikasi", () => {
    it("menerima 10 angka, yang terpendek diterima noHpWa", () => {
      expect(nomorWa("0812345678")).toBe("62812345678");
    });

    it("menerima 14 angka, yang terpanjang diterima noHpWa", () => {
      expect(nomorWa("08123456789012")).toBe("628123456789012");
    });

    it("menolak 9 angka, yang juga ditolak noHpWa", () => {
      expect(nomorWa("081234567")).toBeNull();
    });

    it("menolak 15 angka, yang juga ditolak noHpWa", () => {
      expect(nomorWa("081234567890123")).toBeNull();
    });
  });
});

describe("tautanWa", () => {
  it("menyusun tautan tanpa pesan", () => {
    expect(tautanWa("081234567890")).toBe("https://wa.me/6281234567890");
  });

  it("menyandikan pesan supaya spasi dan tanda baca tidak merusak tautan", () => {
    const tautan = tautanWa("081234567890", "Halo Asep, apakah masih di jalan?");
    expect(tautan).toBe(
      "https://wa.me/6281234567890?text=Halo%20Asep%2C%20apakah%20masih%20di%20jalan%3F",
    );
  });

  it("mengembalikan null kalau nomornya tidak bisa dipakai", () => {
    expect(tautanWa("0265123456", "Halo")).toBeNull();
  });
});

describe("pesanWa", () => {
  it("menyebut kode sepeda pada pesan keterlambatan", () => {
    const pesan = pesanWa.sepedaTelat("Asep Sunandar", "MTB-021");
    expect(pesan).toContain("Asep Sunandar");
    expect(pesan).toContain("MTB-021");
  });

  it("menyebut kode booking, sepeda, dan jamnya pada pesan penjemputan", () => {
    const pesan = pesanWa.bookingJemput("Budi", "BK-0002", "LIP-005", "18:50");
    for (const bagian of ["Budi", "BK-0002", "LIP-005", "18:50"]) {
      expect(pesan).toContain(bagian);
    }
  });

  // Sepeda telat paling sering karena ban bocor atau hujan. Pesan pertama yang
  // terdengar menagih menyulitkan percakapan yang belum tentu perlu sulit.
  it("bertanya, bukan menagih", () => {
    expect(pesanWa.sepedaTelat("Asep", "MTB-021")).toContain("?");
    expect(pesanWa.bookingHangus("Budi", "BK-0003", "13:20")).toContain("?");
  });
});

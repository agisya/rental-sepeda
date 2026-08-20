import { describe, expect, it } from "vitest";
import { pesanGalatKamera } from "./galat-kamera";

const PONSEL_UJI = { protokol: "https:", hostname: "192.168.1.7" };
const PRODUKSI = { protokol: "https:", hostname: "rental.contoh.id" };
const LOKAL = { protokol: "http:", hostname: "localhost" };

describe("izin kamera ditolak", () => {
  /*
    Sebab yang paling sering terjadi saat menguji dari HP, dan yang paling
    membingungkan: peramban menolak kamera pada HTTPS bersertifikat buatan
    sendiri, walau peringatan sertifikatnya sudah dilewati. Ia tidak pernah
    bertanya soal izin, jadi menyuruh petugas "nyalakan izin di pengaturan"
    mengirimnya mencari sesuatu yang tidak ada di sana.
  */
  it("menyebut sertifikat saat alamatnya IP mentah ber-HTTPS", () => {
    const pesan = pesanGalatKamera("NotAllowedError", PONSEL_UJI);

    expect(pesan).toMatch(/sertifikat/i);
  });

  it("tidak menyebut sertifikat di alamat resmi", () => {
    // Petugas di konter memakai domain sungguhan dengan sertifikat sah. Di sana
    // sebabnya pasti izin, dan penjelasan soal sertifikat hanya kebisingan yang
    // membuat pesannya lebih panjang daripada yang mau dibaca orang.
    const pesan = pesanGalatKamera("NotAllowedError", PRODUKSI);

    expect(pesan).not.toMatch(/sertifikat/i);
    expect(pesan).toMatch(/izin/i);
  });

  it("tidak menyebut sertifikat di localhost", () => {
    // localhost sudah dianggap alamat aman tanpa sertifikat apa pun, jadi
    // jebakan itu tidak berlaku di sana.
    expect(pesanGalatKamera("NotAllowedError", LOKAL)).not.toMatch(/sertifikat/i);
  });

  it("tetap menyebut izin walau sertifikat ikut disebut", () => {
    // Keduanya mungkin. Menyebut sertifikat saja akan menyesatkan orang yang
    // memang pernah menekan Tolak.
    expect(pesanGalatKamera("NotAllowedError", PONSEL_UJI)).toMatch(/izin/i);
  });
});

describe("galat lain saat membuka kamera", () => {
  it("menyebut kamera tidak ada saat perangkatnya memang tidak punya", () => {
    for (const nama of ["NotFoundError", "OverconstrainedError"]) {
      expect(pesanGalatKamera(nama, PONSEL_UJI), nama).toMatch(/ganti kamera/i);
    }
  });

  it("memberi pesan umum untuk galat yang tidak dikenali", () => {
    expect(pesanGalatKamera("AbortError", PONSEL_UJI)).toMatch(/tidak bisa dibuka/i);
    expect(pesanGalatKamera("", PONSEL_UJI)).toMatch(/tidak bisa dibuka/i);
  });
});

describe("jalan keluar", () => {
  /*
    Apa pun sebabnya, petugas sedang berdiri di depan pelanggan. Setiap pesan
    harus berakhir dengan sesuatu yang bisa dikerjakan sekarang juga, dan yang
    selalu tersedia adalah mengetik kodenya sendiri.
  */
  it("setiap pesan menawarkan ketik manual", () => {
    const semua = ["NotAllowedError", "NotFoundError", "OverconstrainedError", "AbortError"];

    for (const nama of semua) {
      expect(pesanGalatKamera(nama, PONSEL_UJI), nama).toMatch(/ketik/i);
      expect(pesanGalatKamera(nama, PRODUKSI), nama).toMatch(/ketik/i);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  susunNotifikasi,
  type BookingUntukNotifikasi,
  type RentalUntukNotifikasi,
} from "./susun";

const SEKARANG = new Date("2026-08-21T05:00:00.000Z"); // 12:00 WIB
const PENGATURAN = { toleransiBookingMenit: 60, batasJamRental: 12 };

const menitLalu = (m: number) => new Date(SEKARANG.getTime() - m * 60_000);

function rental(opsi: Partial<RentalUntukNotifikasi> = {}): RentalUntukNotifikasi {
  return {
    id: 12,
    waktuMulai: menitLalu(60),
    estimasiJam: 2,
    kodeSepeda: "MTB-021",
    namaSepeda: "Xtrada",
    namaPenyewa: "Asep",
    noHpPenyewa: "081200000001",
    ...opsi,
  };
}

function booking(opsi: Partial<BookingUntukNotifikasi> = {}): BookingUntukNotifikasi {
  return {
    id: 5,
    waktuMulai: menitLalu(10),
    durasiJam: 2,
    kodeSepeda: "CTY-004",
    namaSepeda: "Troy",
    namaPenyewa: "Budi",
    noHpPenyewa: "081200000002",
    ...opsi,
  };
}

const susun = (r: RentalUntukNotifikasi[], b: BookingUntukNotifikasi[] = []) =>
  susunNotifikasi(r, b, SEKARANG, PENGATURAN);

describe("rental yang masih dalam perkiraan", () => {
  it("tidak memunculkan apa-apa", () => {
    expect(susun([rental({ waktuMulai: menitLalu(90), estimasiJam: 2 })])).toEqual([]);
  });

  it("tidak memunculkan apa-apa tepat sebelum habis", () => {
    expect(susun([rental({ waktuMulai: menitLalu(119), estimasiJam: 2 })])).toEqual([]);
  });
});

describe("tiga tahap keterlambatan", () => {
  it.each([
    [120, "sewa-habis", "r-12-habis"],
    [149, "sewa-habis", "r-12-habis"],
    [150, "lewat-30", "r-12-lewat30"],
    [179, "lewat-30", "r-12-lewat30"],
    [180, "lewat-60", "r-12-lewat60"],
    [600, "lewat-60", "r-12-lewat60"],
  ])("berjalan %i menit menghasilkan %s", (menit, jenis, kunci) => {
    const [n] = susun([rental({ waktuMulai: menitLalu(menit), estimasiJam: 2 })]);
    expect(n.jenis).toBe(jenis);
    expect(n.kunci).toBe(kunci);
  });

  // Inilah yang membuat menutup popup tidak membungkam tahap berikutnya, dan
  // sekaligus mencegah tiga popup menumpuk untuk satu sepeda yang sama.
  it("hanya memancarkan satu tahap sekaligus untuk tiap sepeda", () => {
    const hasil = susun([rental({ waktuMulai: menitLalu(200), estimasiJam: 2 })]);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].jenis).toBe("lewat-60");
  });

  it("berhenti di tahap ketiga, tidak terus bertambah", () => {
    const empatJam = susun([rental({ waktuMulai: menitLalu(360), estimasiJam: 2 })]);
    const satuJam = susun([rental({ waktuMulai: menitLalu(180), estimasiJam: 2 })]);
    expect(empatJam[0].kunci).toBe(satuJam[0].kunci);
  });
});

describe("rental tanpa perkiraan durasi", () => {
  it("tidak diingatkan sama sekali selama masih di bawah batas jam rental", () => {
    expect(susun([rental({ estimasiJam: null, waktuMulai: menitLalu(600) })])).toEqual([]);
  });

  it("diingatkan setelah melewati batas jam rental", () => {
    const [n] = susun([rental({ estimasiJam: null, waktuMulai: menitLalu(12 * 60) })]);
    expect(n.jenis).toBe("belum-kembali");
    expect(n.nada).toBe("danger");
  });
});

describe("belum kembali mengalahkan tahap keterlambatan", () => {
  it("sepeda yang lewat 12 jam tidak lagi disebut sekadar lewat 1 jam", () => {
    const [n] = susun([rental({ estimasiJam: 2, waktuMulai: menitLalu(13 * 60) })]);
    expect(n.jenis).toBe("belum-kembali");
  });

  // Alarm palsu adalah cara tercepat membuat petugas berhenti membaca
  // notifikasi. Rental panjang yang memang dicatat panjang bukan keadaan
  // darurat, sekalipun sudah melewati batas jam rental.
  it("rental 24 jam TIDAK dialarmi pada jam ke-12, karena belum lewat perkiraannya", () => {
    expect(susun([rental({ estimasiJam: 24, waktuMulai: menitLalu(13 * 60) })])).toEqual(
      [],
    );
  });

  it("rental 24 jam baru dialarmi setelah benar-benar lewat 24 jam", () => {
    const [n] = susun([rental({ estimasiJam: 24, waktuMulai: menitLalu(25 * 60) })]);
    expect(n.jenis).toBe("belum-kembali");
  });

  it("rental panjang yang baru lewat sedikit tetap dapat tahap biasa, bukan alarm merah", () => {
    // 24 jam 40 menit: sudah lewat batas jam rental, tapi baru telat 40 menit.
    const [n] = susun([rental({ estimasiJam: 24, waktuMulai: menitLalu(24 * 60 + 40) })]);
    expect(n.jenis).toBe("belum-kembali");
    // Ia memang belum kembali DAN sudah lewat perkiraan, jadi alarm merah benar.
    expect(n.nada).toBe("danger");
  });
});

describe("booking", () => {
  it("belum jatuh tempo tidak memunculkan apa-apa", () => {
    expect(susun([], [booking({ waktuMulai: new Date(SEKARANG.getTime() + 60_000) })])).toEqual(
      [],
    );
  });

  it("lewat jam jemput tapi masih dalam toleransi berarti belum dijemput", () => {
    const [n] = susun([], [booking({ waktuMulai: menitLalu(30) })]);
    expect(n.jenis).toBe("booking-jemput");
    expect(n.kunci).toBe("b-5-jemput");
    expect(n.href).toBe("/booking/5");
  });

  it("lewat toleransi berarti hangus", () => {
    const [n] = susun([], [booking({ waktuMulai: menitLalu(61) })]);
    expect(n.jenis).toBe("booking-hangus");
    expect(n.kunci).toBe("b-5-hangus");
  });

  it("tepat di batas toleransi masih dianggap belum dijemput", () => {
    const [n] = susun([], [booking({ waktuMulai: menitLalu(60) })]);
    expect(n.jenis).toBe("booking-jemput");
  });
});

describe("urutan tumpukan", () => {
  it("mendahulukan yang paling genting", () => {
    const hasil = susunNotifikasi(
      [
        rental({ id: 1, waktuMulai: menitLalu(125), estimasiJam: 2 }), // sewa-habis
        rental({ id: 2, waktuMulai: menitLalu(13 * 60), estimasiJam: 2 }), // belum-kembali
        rental({ id: 3, waktuMulai: menitLalu(160), estimasiJam: 2 }), // lewat-30
      ],
      [booking({ id: 9, waktuMulai: menitLalu(90) })], // booking-hangus
      SEKARANG,
      PENGATURAN,
    );

    expect(hasil.map((n) => n.jenis)).toEqual([
      "belum-kembali",
      "booking-hangus",
      "lewat-30",
      "sewa-habis",
    ]);
  });
});

describe("isi tiap notifikasi", () => {
  it("membawa nomor HP supaya bisa langsung ditelepon dari popup", () => {
    const [n] = susun([rental({ waktuMulai: menitLalu(200) })]);
    expect(n.noHpPenyewa).toBe("081200000001");
    expect(n.href).toBe("/scan?kode=MTB-021");
  });

  it("menuju halaman scan tanpa penanda pindai, jadi tidak langsung ke tombol selesai", () => {
    const [n] = susun([rental({ waktuMulai: menitLalu(200) })]);
    expect(n.href).not.toContain("pindai");
  });
});

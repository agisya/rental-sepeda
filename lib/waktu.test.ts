import { describe, expect, it } from "vitest";
import {
  akhirBooking,
  akhirHariWib,
  awalHariWib,
  awalJamWib,
  daftarJamBooking,
  dariKunciBulanWib,
  formatBulanWib,
  formatJamWib,
  formatRentangTanggalWib,
  formatTanggalWib,
  jumlahHari,
  kunciBulanWib,
  kunciTanggalWib,
  namaHariWib,
  rentangHariWib,
  rentangMingguWib,
} from "./waktu";

describe("batas hari WIB", () => {
  it("awal hari adalah 00:00 WIB, yaitu 17:00 UTC hari sebelumnya", () => {
    const siang = new Date("2026-08-14T05:00:00.000Z"); // 12:00 WIB
    expect(awalHariWib(siang).toISOString()).toBe("2026-08-13T17:00:00.000Z");
  });

  it("akhir hari adalah awal hari berikutnya (batas eksklusif)", () => {
    const siang = new Date("2026-08-14T05:00:00.000Z");
    expect(akhirHariWib(siang).toISOString()).toBe("2026-08-14T17:00:00.000Z");
  });

  // Ini kesalahan paling mudah terjadi: transaksi malam hari terlempar ke
  // tanggal berikutnya kalau batas hari dihitung dengan UTC.
  it("transaksi pukul 23:30 WIB masih masuk hari yang sama", () => {
    const malam = new Date("2026-08-14T16:30:00.000Z"); // 23:30 WIB tanggal 14
    const { mulai, selesai } = rentangHariWib(new Date("2026-08-14T05:00:00.000Z"));

    expect(malam >= mulai).toBe(true);
    expect(malam < selesai).toBe(true);
    expect(kunciTanggalWib(malam)).toBe("2026-08-14");
  });

  it("transaksi pukul 00:30 WIB masuk hari baru, bukan hari sebelumnya", () => {
    const dini = new Date("2026-08-14T17:30:00.000Z"); // 00:30 WIB tanggal 15
    expect(kunciTanggalWib(dini)).toBe("2026-08-15");

    const { selesai } = rentangHariWib(new Date("2026-08-14T05:00:00.000Z"));
    expect(dini >= selesai).toBe(true);
  });

  it("tepat tengah malam WIB masuk hari baru", () => {
    const tengahMalam = new Date("2026-08-14T17:00:00.000Z"); // 00:00 WIB tanggal 15
    expect(kunciTanggalWib(tengahMalam)).toBe("2026-08-15");
    expect(awalHariWib(tengahMalam).toISOString()).toBe("2026-08-14T17:00:00.000Z");
  });
});

describe("rentang minggu WIB", () => {
  // 14 Agustus 2026 jatuh hari Jumat, jadi minggunya mulai Senin 10 Agustus.
  it("dimulai hari Senin, bukan Minggu", () => {
    const jumat = new Date("2026-08-14T05:00:00.000Z");
    const { mulai, selesai } = rentangMingguWib(jumat);

    expect(namaHariWib(mulai)).toBe("Senin");
    expect(kunciTanggalWib(mulai)).toBe("2026-08-10");
    expect(kunciTanggalWib(new Date(selesai.getTime() - 1))).toBe("2026-08-16");
    expect(jumlahHari({ mulai, selesai })).toBe(7);
  });

  it("hari Senin sendiri menjadi awal minggunya", () => {
    const senin = new Date("2026-08-10T05:00:00.000Z");
    expect(kunciTanggalWib(rentangMingguWib(senin).mulai)).toBe("2026-08-10");
  });

  // Kesalahan klasik: Minggu dianggap hari pertama sehingga terlempar ke minggu berikutnya.
  it("hari Minggu masuk ke minggu yang baru saja lewat", () => {
    const minggu = new Date("2026-08-16T05:00:00.000Z");
    expect(namaHariWib(minggu)).toBe("Minggu");
    expect(kunciTanggalWib(rentangMingguWib(minggu).mulai)).toBe("2026-08-10");
  });

  it("dihitung menurut WIB, bukan UTC", () => {
    // 00:30 WIB Senin 10 Agustus = 17:30 UTC Minggu 9 Agustus.
    const diniHariSenin = new Date("2026-08-09T17:30:00.000Z");
    expect(namaHariWib(diniHariSenin)).toBe("Senin");
    expect(kunciTanggalWib(rentangMingguWib(diniHariSenin).mulai)).toBe("2026-08-10");
  });
});

describe("slot jam booking", () => {
  it("membulatkan waktu mulai ke awal jam WIB", () => {
    const lewat = new Date("2026-08-14T02:37:15.000Z"); // 09:37 WIB
    expect(formatJamWib(awalJamWib(lewat))).toBe("09:00");
  });

  it("menyusun satu slot per jam yang dipesan", () => {
    const mulai = new Date("2026-08-14T02:00:00.000Z"); // 09:00 WIB
    const slot = daftarJamBooking(mulai, 3);

    expect(slot).toHaveLength(3);
    expect(slot.map(formatJamWib)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("booking satu jam menempati tepat satu slot", () => {
    expect(daftarJamBooking(new Date("2026-08-14T02:00:00.000Z"), 1)).toHaveLength(1);
  });

  // Booking 22:00 selama 4 jam melewati tengah malam WIB.
  it("slot boleh melewati tengah malam", () => {
    const malam = new Date("2026-08-14T15:00:00.000Z"); // 22:00 WIB
    const slot = daftarJamBooking(malam, 4);

    expect(slot.map(formatJamWib)).toEqual(["22:00", "23:00", "00:00", "01:00"]);
    expect(kunciTanggalWib(slot[0])).toBe("2026-08-14");
    expect(kunciTanggalWib(slot[3])).toBe("2026-08-15");
  });

  it("waktu selesai booking adalah slot terakhir ditambah satu jam", () => {
    const mulai = new Date("2026-08-14T02:00:00.000Z");
    expect(formatJamWib(akhirBooking(mulai, 3))).toBe("12:00");
  });

  it("menolak durasi yang tidak masuk akal", () => {
    const mulai = new Date("2026-08-14T02:00:00.000Z");
    for (const durasi of [0, -1, 1.5]) {
      expect(() => daftarJamBooking(mulai, durasi)).toThrow(/durasi/i);
    }
  });
});

describe("kunci dan penulisan bulan", () => {
  it("menulis bulan dalam bahasa Indonesia", () => {
    expect(formatBulanWib(new Date("2026-08-14T05:00:00.000Z"))).toBe("Agustus 2026");
  });

  it("membaca dan menulis kunci bulan secara konsisten", () => {
    const kunci = kunciBulanWib(new Date("2026-08-14T05:00:00.000Z"));
    expect(kunci).toBe("2026-08");

    const awal = dariKunciBulanWib(kunci)!;
    expect(kunciTanggalWib(awal)).toBe("2026-08-01");
    expect(formatJamWib(awal)).toBe("00:00");
  });

  it("menolak kunci bulan yang tidak masuk akal", () => {
    for (const salah of ["2026-13", "2026", "agustus", "2026-00"]) {
      expect(dariKunciBulanWib(salah)).toBeNull();
    }
  });
});

describe("penulisan rentang tanggal", () => {
  it("meringkas rentang dalam bulan yang sama", () => {
    const { mulai, selesai } = rentangMingguWib(new Date("2026-08-14T05:00:00.000Z"));
    expect(formatRentangTanggalWib(mulai, selesai)).toBe("10 – 16 Agustus 2026");
  });

  it("menyebut kedua bulan kalau rentangnya menyeberang bulan", () => {
    const mulai = new Date("2026-08-31T17:00:00.000Z"); // 1 Sep 00:00 WIB
    const selesai = new Date("2026-09-07T17:00:00.000Z");
    expect(formatRentangTanggalWib(mulai, selesai)).toBe("1 – 7 September 2026");
  });
});

describe("penulisan tanggal dan jam", () => {
  it("menulis jam dalam WIB, bukan UTC", () => {
    expect(formatJamWib(new Date("2026-08-14T02:05:00.000Z"))).toBe("09:05");
    expect(formatJamWib(new Date("2026-08-14T16:30:00.000Z"))).toBe("23:30");
  });

  it("menulis tanggal dengan nama bulan Indonesia", () => {
    expect(formatTanggalWib(new Date("2026-08-14T05:00:00.000Z"))).toBe(
      "14 Agustus 2026",
    );
  });

  it("menulis tanggal berdasarkan WIB untuk waktu larut malam", () => {
    // 23:00 WIB tanggal 31 Desember 2026 = 16:00 UTC, masih tanggal 31.
    expect(formatTanggalWib(new Date("2026-12-31T16:00:00.000Z"))).toBe(
      "31 Desember 2026",
    );
  });
});

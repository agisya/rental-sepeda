import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import { bikes, bookings, owners, renters, rentals, users } from "@/lib/db/schema";
import { daftarAktivitas } from "@/lib/queries/aktivitas";

/**
 * Daftar gabungan booking dan rental.
 *
 * Yang paling penting diuji di sini adalah aturan anti-penggandaan. Saat sepeda
 * booking diserahkan, aplikasi membuat rental baru SEKALIGUS menandai bookingnya
 * "selesai". Kalau kedua tabel digabung mentah-mentah, sepeda yang baru saja
 * berangkat akan muncul dua kali sekaligus — berlencana "Selesai" sebagai
 * booking dan "Sedang disewa" sebagai rental — dan itu justru kebingungan yang
 * lebih parah daripada memisahkan kedua halaman.
 */

let uji: DbUji;
let idSepedaA: number;
let idSepedaB: number;
let idPenyewa: number;
let idPetugas: number;
let idPemilik: number;

const TARIF = 15_000;
const SEKARANG = new Date("2026-08-21T05:00:00.000Z"); // 12:00 WIB
const TOLERANSI = 60;

const menitDari = (dasar: Date, menit: number) =>
  new Date(dasar.getTime() + menit * 60_000);

async function buatRental(opsi: {
  bikeId: number;
  status: "berjalan" | "selesai" | "batal";
  mulai: Date;
  selesai?: Date;
  dibatalkanPada?: Date;
  total?: number;
}) {
  const [baris] = await uji.db
    .insert(rentals)
    .values({
      bikeId: opsi.bikeId,
      renterId: idPenyewa,
      kasirId: idPetugas,
      ownerIdSnapshot: idPemilik,
      tarifPerJamSnapshot: TARIF,
      persentasePemilikSnapshot: 60,
      waktuMulai: opsi.mulai,
      waktuSelesai: opsi.selesai ?? null,
      dibatalkanPada: opsi.dibatalkanPada ?? null,
      totalBiaya: opsi.total ?? null,
      status: opsi.status,
    })
    .returning({ id: rentals.id });
  return baris.id;
}

async function buatBooking(opsi: {
  bikeId: number;
  status: "booking" | "selesai" | "batal";
  mulai: Date;
  rentalId?: number;
}) {
  const [baris] = await uji.db
    .insert(bookings)
    .values({
      bikeId: opsi.bikeId,
      renterId: idPenyewa,
      dicatatOleh: idPetugas,
      waktuMulai: opsi.mulai,
      durasiJam: 2,
      tarifPerJamSnapshot: TARIF,
      status: opsi.status,
      rentalId: opsi.rentalId ?? null,
    })
    .returning({ id: bookings.id });
  return baris.id;
}

beforeAll(async () => {
  uji = await buatDbUji();

  const [o] = await uji.db
    .insert(owners)
    .values({ nama: "Budi", noHp: "081200000000", persentaseBagiHasil: 60 })
    .returning({ id: owners.id });
  idPemilik = o.id;

  const [a] = await uji.db
    .insert(bikes)
    .values({ kode: "MTB-001", nama: "Xtrada", jenis: "MTB", tarifPerJam: TARIF, ownerId: idPemilik })
    .returning({ id: bikes.id });
  idSepedaA = a.id;

  const [b] = await uji.db
    .insert(bikes)
    .values({ kode: "CTY-001", nama: "Troy", jenis: "City", tarifPerJam: TARIF, ownerId: idPemilik })
    .returning({ id: bikes.id });
  idSepedaB = b.id;

  const [p] = await uji.db
    .insert(renters)
    .values({ nama: "Asep", noHp: "081200000001" })
    .returning({ id: renters.id });
  idPenyewa = p.id;

  const [u] = await uji.db
    .insert(users)
    .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });
  idPetugas = u.id;
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(bookings);
  await uji.db.delete(rentals);
});

describe("satu kejadian tetap satu baris", () => {
  it("booking yang sudah dijemput muncul sekali saja, sebagai sedang disewa", async () => {
    const idRental = await buatRental({
      bikeId: idSepedaA,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -30),
    });
    // Persis seperti yang dilakukan aksi jemput: booking ditandai selesai dan
    // ditautkan ke rental yang baru dibuat.
    await buatBooking({
      bikeId: idSepedaA,
      status: "selesai",
      mulai: menitDari(SEKARANG, -30),
      rentalId: idRental,
    });

    const hasil = await daftarAktivitas(SEKARANG, TOLERANSI);

    expect(hasil).toHaveLength(1);
    expect(hasil[0].status).toBe("disewa");
    expect(hasil[0].kunci).toBe(`r-${idRental}`);
  });

  it("menandai rental itu berasal dari booking, bukan dari penyewa yang datang langsung", async () => {
    const dariBooking = await buatRental({
      bikeId: idSepedaA,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -30),
    });
    await buatBooking({
      bikeId: idSepedaA,
      status: "selesai",
      mulai: menitDari(SEKARANG, -30),
      rentalId: dariBooking,
    });
    await buatRental({
      bikeId: idSepedaB,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -20),
    });

    const hasil = await daftarAktivitas(SEKARANG, TOLERANSI);
    const a = hasil.find((x) => x.kodeSepeda === "MTB-001");
    const b = hasil.find((x) => x.kodeSepeda === "CTY-001");

    expect(a?.dariBooking).toBe(true);
    expect(b?.dariBooking).toBe(false);
  });
});

describe("tahap tiap baris", () => {
  it("booking yang belum jatuh tempo berlencana dibooking", async () => {
    await buatBooking({
      bikeId: idSepedaA,
      status: "booking",
      mulai: menitDari(SEKARANG, 120),
    });

    const [satu] = await daftarAktivitas(SEKARANG, TOLERANSI);
    expect(satu.status).toBe("dibooking");
    expect(satu.durasiJam).toBe(2);
    // Janji harga, bukan jumlah yang sudah diterima — keduanya disimpan di
    // kolom berbeda supaya tidak pernah tertukar di layar.
    expect(satu.perkiraanBiaya).toBe(TARIF * 2);
    expect(satu.totalBiaya).toBeNull();
  });

  it("booking yang lewat toleransi berlencana hangus", async () => {
    await buatBooking({
      bikeId: idSepedaA,
      status: "booking",
      mulai: menitDari(SEKARANG, -TOLERANSI - 1),
    });

    const [satu] = await daftarAktivitas(SEKARANG, TOLERANSI);
    expect(satu.status).toBe("hangus");
  });

  it("rental yang sudah selesai hari ini berlencana selesai beserta totalnya", async () => {
    await buatRental({
      bikeId: idSepedaA,
      status: "selesai",
      mulai: menitDari(SEKARANG, -120),
      selesai: menitDari(SEKARANG, -30),
      total: 22_500,
    });

    const [satu] = await daftarAktivitas(SEKARANG, TOLERANSI);
    expect(satu.status).toBe("selesai");
    expect(satu.totalBiaya).toBe(22_500);
  });
});

describe("cakupan waktu", () => {
  it("rental yang berangkat kemarin dan belum kembali tetap muncul", async () => {
    // Ini justru baris yang paling perlu dilihat petugas, jadi ia tidak boleh
    // hilang hanya karena tanggal sudah berganti.
    await buatRental({
      bikeId: idSepedaA,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -20 * 60),
    });

    const hasil = await daftarAktivitas(SEKARANG, TOLERANSI);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].status).toBe("disewa");
  });

  it("rental yang selesai kemarin tidak ikut ditampilkan", async () => {
    await buatRental({
      bikeId: idSepedaA,
      status: "selesai",
      mulai: menitDari(SEKARANG, -30 * 60),
      selesai: menitDari(SEKARANG, -26 * 60),
      total: 15_000,
    });

    expect(await daftarAktivitas(SEKARANG, TOLERANSI)).toEqual([]);
  });
});

describe("urutan", () => {
  it("mendahulukan yang perlu diurus sekarang", async () => {
    await buatRental({
      bikeId: idSepedaA,
      status: "selesai",
      mulai: menitDari(SEKARANG, -180),
      selesai: menitDari(SEKARANG, -60),
      total: 15_000,
    });
    await buatBooking({
      bikeId: idSepedaB,
      status: "booking",
      mulai: menitDari(SEKARANG, 120),
    });
    await buatRental({
      bikeId: idSepedaB,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -45),
    });

    const hasil = await daftarAktivitas(SEKARANG, TOLERANSI);
    expect(hasil.map((a) => a.status)).toEqual(["disewa", "dibooking", "selesai"]);
  });

  it("yang sedang disewa diurutkan dari yang paling lama di luar", async () => {
    await buatRental({
      bikeId: idSepedaA,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -30),
    });
    await buatRental({
      bikeId: idSepedaB,
      status: "berjalan",
      mulai: menitDari(SEKARANG, -200),
    });

    const hasil = await daftarAktivitas(SEKARANG, TOLERANSI);
    // Yang paling lama di luar paling mungkin kembali berikutnya.
    expect(hasil.map((a) => a.kodeSepeda)).toEqual(["CTY-001", "MTB-001"]);
  });
});

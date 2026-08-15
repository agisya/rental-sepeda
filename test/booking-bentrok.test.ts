import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import {
  bikes,
  bookingSlots,
  bookings,
  owners,
  renters,
  rentals,
  users,
} from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { daftarJamBooking, formatJamWib } from "@/lib/waktu";

/**
 * Penjaga anti-bentrok booking.
 *
 * Cara yang biasa dipakai untuk ini — EXCLUDE constraint dengan tstzrange —
 * menuntut ekstensi btree_gist yang TIDAK tersedia di PGlite. Uji ini
 * membuktikan pengganti yang dipakai aplikasi, yaitu satu baris slot per jam
 * dengan indeks unik parsial, benar-benar menutup semua bentuk tumpang tindih.
 */

let uji: DbUji;
let idSepeda: number;
let idSepedaLain: number;
let idPenyewa: number;
let idPetugas: number;
let idPemilik: number;

const TARIF = 15_000;

beforeAll(async () => {
  uji = await buatDbUji();

  const [pemilik] = await uji.db
    .insert(owners)
    .values({ nama: "Budi", noHp: "081200000000", persentaseBagiHasil: 60 })
    .returning({ id: owners.id });
  idPemilik = pemilik.id;

  const [a] = await uji.db
    .insert(bikes)
    .values({
      kode: "MTB-023",
      nama: "Polygon Xtrada 7",
      jenis: "MTB",
      tarifPerJam: TARIF,
      ownerId: pemilik.id,
    })
    .returning({ id: bikes.id });
  idSepeda = a.id;

  const [b] = await uji.db
    .insert(bikes)
    .values({
      kode: "CTY-011",
      nama: "Element Troy",
      jenis: "City Bike",
      tarifPerJam: 10_000,
      ownerId: pemilik.id,
    })
    .returning({ id: bikes.id });
  idSepedaLain = b.id;

  const [p] = await uji.db
    .insert(renters)
    .values({ nama: "Asep", noHp: "081200000001" })
    .returning({ id: renters.id });
  idPenyewa = p.id;

  const [u] = await uji.db
    .insert(users)
    .values({ username: "kasir", passwordHash: "x", nama: "Rina", peran: "kasir" })
    .returning({ id: users.id });
  idPetugas = u.id;
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(bookingSlots);
  await uji.db.delete(bookings);
});

/** Membuat booking beserta slot jamnya, seperti yang dilakukan aksi aplikasi. */
async function pesan(bikeId: number, mulaiISO: string, durasiJam: number) {
  const waktuMulai = new Date(mulaiISO);

  const [b] = await uji.db
    .insert(bookings)
    .values({
      bikeId,
      renterId: idPenyewa,
      dicatatOleh: idPetugas,
      waktuMulai,
      durasiJam,
      tarifPerJamSnapshot: TARIF,
    })
    .returning({ id: bookings.id });

  await uji.db.insert(bookingSlots).values(
    daftarJamBooking(waktuMulai, durasiJam).map((jam) => ({
      bookingId: b.id,
      bikeId,
      jam,
    })),
  );

  return b.id;
}

async function coba(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (galat) {
    return galat;
  }
}

// 09:00 WIB = 02:00 UTC
const JAM_09 = "2026-08-20T02:00:00.000Z";
const JAM_10 = "2026-08-20T03:00:00.000Z";
const JAM_11 = "2026-08-20T04:00:00.000Z";
const JAM_08 = "2026-08-20T01:00:00.000Z";

describe("migrasi berjalan di PGlite tanpa ekstensi apa pun", () => {
  it("membentuk seluruh tabel yang dibutuhkan", async () => {
    const hasil = await uji.klien.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    const tabel = hasil.rows.map((r) => r.table_name);

    expect(tabel).toContain("bookings");
    expect(tabel).toContain("booking_slots");
    expect(tabel).toContain("maintenances");
    expect(tabel).toContain("expenses");
    expect(tabel).toContain("owner_payments");
    expect(tabel).toContain("settings");
  });

  it("tidak memasang ekstensi apa pun", async () => {
    const hasil = await uji.klien.query<{ extname: string }>(
      "select extname from pg_extension where extname <> 'plpgsql'",
    );
    expect(hasil.rows.map((r) => r.extname)).toEqual([]);
  });
});

describe("dua booking tidak boleh bertumpang tindih", () => {
  it("menerima booking pertama", async () => {
    await expect(pesan(idSepeda, JAM_09, 2)).resolves.toBeGreaterThan(0);
  });

  it("menolak yang mulai di tengah booking lain", async () => {
    await pesan(idSepeda, JAM_09, 2); // 09:00–11:00
    const galat = await coba(() => pesan(idSepeda, JAM_10, 2)); // 10:00–12:00

    expect(galat).not.toBeNull();
    expect(pelanggaranUnik(galat)).toBe(true);
  });

  it("menolak yang berakhir di tengah booking lain", async () => {
    await pesan(idSepeda, JAM_10, 2); // 10:00–12:00
    const galat = await coba(() => pesan(idSepeda, JAM_09, 2)); // 09:00–11:00

    expect(pelanggaranUnik(galat)).toBe(true);
  });

  it("menolak yang menelan booking lain seluruhnya", async () => {
    await pesan(idSepeda, JAM_10, 1); // 10:00–11:00
    const galat = await coba(() => pesan(idSepeda, JAM_08, 5)); // 08:00–13:00

    expect(pelanggaranUnik(galat)).toBe(true);
  });

  it("menolak yang persis sama", async () => {
    await pesan(idSepeda, JAM_09, 2);
    const galat = await coba(() => pesan(idSepeda, JAM_09, 2));

    expect(pelanggaranUnik(galat)).toBe(true);
  });

  it("menolak yang berada di dalam booking lain", async () => {
    await pesan(idSepeda, JAM_08, 5); // 08:00–13:00
    const galat = await coba(() => pesan(idSepeda, JAM_10, 1)); // 10:00–11:00

    expect(pelanggaranUnik(galat)).toBe(true);
  });
});

describe("yang justru harus diterima", () => {
  // Booking 09:00–11:00 lalu 11:00–13:00 tidak bertabrakan: jam 11:00 hanya
  // dimiliki booking kedua. Kalau ini ditolak, jadwal jadi berlubang sejam.
  it("menerima booking yang bersambung persis setelahnya", async () => {
    await pesan(idSepeda, JAM_09, 2); // 09:00, 10:00
    await expect(pesan(idSepeda, JAM_11, 2)).resolves.toBeGreaterThan(0); // 11:00, 12:00
  });

  it("menerima booking yang bersambung persis sebelumnya", async () => {
    await pesan(idSepeda, JAM_11, 2);
    await expect(pesan(idSepeda, JAM_09, 2)).resolves.toBeGreaterThan(0);
  });

  it("menerima sepeda lain pada jam yang sama", async () => {
    await pesan(idSepeda, JAM_09, 2);
    await expect(pesan(idSepedaLain, JAM_09, 2)).resolves.toBeGreaterThan(0);
  });

  it("menerima sepeda yang sama pada hari berbeda", async () => {
    await pesan(idSepeda, JAM_09, 2);
    await expect(
      pesan(idSepeda, "2026-08-21T02:00:00.000Z", 2),
    ).resolves.toBeGreaterThan(0);
  });
});

describe("booking yang dibatalkan melepaskan jamnya", () => {
  it("jam bekas booking batal bisa dipesan lagi", async () => {
    const id = await pesan(idSepeda, JAM_09, 2);

    // Pembatalan: slot dinonaktifkan, booking ditandai batal.
    await uji.db
      .update(bookingSlots)
      .set({ aktif: false })
      .where(eq(bookingSlots.bookingId, id));
    await uji.db.update(bookings).set({ status: "batal" }).where(eq(bookings.id, id));

    await expect(pesan(idSepeda, JAM_09, 2)).resolves.toBeGreaterThan(0);
  });

  it("slot yang dinonaktifkan boleh menumpuk tanpa saling menolak", async () => {
    for (let i = 0; i < 3; i += 1) {
      const id = await pesan(idSepeda, JAM_09, 1);
      await uji.db
        .update(bookingSlots)
        .set({ aktif: false })
        .where(eq(bookingSlots.bookingId, id));
      await uji.db.update(bookings).set({ status: "batal" }).where(eq(bookings.id, id));
    }

    const sisa = await uji.db.select().from(bookingSlots);
    expect(sisa).toHaveLength(3);
    expect(sisa.every((s) => !s.aktif)).toBe(true);
  });
});

describe("booking yang melewati tengah malam WIB", () => {
  it("menempati jam di dua tanggal dan tetap menolak yang bertumpang tindih", async () => {
    const malam = "2026-08-20T15:00:00.000Z"; // 22:00 WIB
    await pesan(idSepeda, malam, 4); // 22:00, 23:00, 00:00, 01:00

    const slot = await uji.db.select().from(bookingSlots);
    expect(slot.map((s) => formatJamWib(s.jam)).sort()).toEqual([
      "00:00",
      "01:00",
      "22:00",
      "23:00",
    ]);

    // Booking 00:00–02:00 keesokan harinya menabrak dua jam terakhir.
    const galat = await coba(() => pesan(idSepeda, "2026-08-20T17:00:00.000Z", 2));
    expect(pelanggaranUnik(galat)).toBe(true);
  });
});

describe("satu rental tidak boleh diklaim dua booking", () => {
  it("menolak booking kedua yang menunjuk ke rental yang sama", async () => {
    const a = await pesan(idSepeda, JAM_09, 1);
    const b = await pesan(idSepedaLain, JAM_09, 1);

    const [rental] = await uji.db
      .insert(rentals)
      .values({
        bikeId: idSepeda,
        renterId: idPenyewa,
        kasirId: idPetugas,
        ownerIdSnapshot: idPemilik,
        tarifPerJamSnapshot: TARIF,
        persentasePemilikSnapshot: 60,
        waktuMulai: new Date(JAM_09),
      })
      .returning({ id: rentals.id });

    await uji.db
      .update(bookings)
      .set({ rentalId: rental.id })
      .where(eq(bookings.id, a));

    const galat = await coba(() =>
      uji.db.update(bookings).set({ rentalId: rental.id }).where(eq(bookings.id, b)),
    );

    expect(galat).not.toBeNull();
    expect(pelanggaranUnik(galat)).toBe(true);

    await uji.db.delete(rentals);
  });

  // Indeks uniknya parsial, jadi banyak booking yang belum jadi rental
  // (rentalId masih null) harus tetap boleh berdampingan.
  it("mengizinkan banyak booking yang belum jadi rental", async () => {
    await pesan(idSepeda, JAM_09, 1);
    await pesan(idSepedaLain, JAM_09, 1);
    await pesan(idSepeda, JAM_11, 1);

    const semua = await uji.db.select().from(bookings);
    expect(semua).toHaveLength(3);
    expect(semua.every((b) => b.rentalId === null)).toBe(true);
  });
});

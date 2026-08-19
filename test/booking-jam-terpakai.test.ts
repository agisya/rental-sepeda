import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import {
  bikes,
  bookingSlots,
  bookings,
  owners,
  renters,
  users,
} from "@/lib/db/schema";
import { jamTerpakai } from "@/lib/queries/bookings";

/**
 * Jam yang sudah dipesan, untuk ditandai di formulir booking.
 *
 * Yang paling mudah salah di sini adalah zona waktu. Slot disimpan sebagai
 * timestamp UTC, sedangkan yang dipilih petugas adalah angka jam WIB. Kalau
 * penerjemahannya salah tujuh jam, formulir akan menandai jam yang salah —
 * dan kesalahan seperti itu tidak terlihat sebagai galat, hanya sebagai
 * "kadang jamnya aneh".
 */

let uji: DbUji;

let idSepeda = 0;
let idSepedaLain = 0;
let idBooking = 0;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(bookingSlots);
  await uji.db.delete(bookings);
  await uji.db.delete(bikes);
  await uji.db.delete(renters);
  await uji.db.delete(owners);
  await uji.db.delete(users);

  const [{ id: idPetugas }] = await uji.db
    .insert(users)
    .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });

  const [{ id: idPemilik }] = await uji.db
    .insert(owners)
    .values({ nama: "Pak Dedi", noHp: "0811", persentaseBagiHasil: 60 })
    .returning({ id: owners.id });

  [{ id: idSepeda }] = await uji.db
    .insert(bikes)
    .values({
      kode: "MTB-001",
      nama: "Polygon",
      jenis: "MTB",
      tarifPerJam: 15000,
      ownerId: idPemilik,
    })
    .returning({ id: bikes.id });

  [{ id: idSepedaLain }] = await uji.db
    .insert(bikes)
    .values({
      kode: "MTB-002",
      nama: "Thrill",
      jenis: "MTB",
      tarifPerJam: 15000,
      ownerId: idPemilik,
    })
    .returning({ id: bikes.id });

  const [{ id: idPenyewa }] = await uji.db
    .insert(renters)
    .values({ nama: "Andi", noHp: "0822" })
    .returning({ id: renters.id });

  [{ id: idBooking }] = await uji.db
    .insert(bookings)
    .values({
      bikeId: idSepeda,
      renterId: idPenyewa,
      dicatatOleh: idPetugas,
      waktuMulai: new Date("2026-08-20T02:00:00.000Z"), // 09:00 WIB
      durasiJam: 3,
      tarifPerJamSnapshot: 15000,
    })
    .returning({ id: bookings.id });
});

/** Rentang yang cukup lebar untuk memuat 20 Agustus 2026 WIB seluruhnya. */
const RENTANG = {
  mulai: new Date("2026-08-19T00:00:00.000Z"),
  selesai: new Date("2026-08-22T00:00:00.000Z"),
};

async function isiSlot(jamUtc: string[]) {
  await uji.db.insert(bookingSlots).values(
    jamUtc.map((j) => ({ bookingId: idBooking, bikeId: idSepeda, jam: new Date(j) })),
  );
}

describe("jam terpakai", () => {
  it("mengembalikan jam WIB, bukan jam UTC", async () => {
    // 02:00 UTC adalah 09:00 WIB. Kalau penerjemahannya terlewat, hasilnya 2.
    await isiSlot(["2026-08-20T02:00:00.000Z"]);

    const hasil = await jamTerpakai(RENTANG);

    expect(hasil).toEqual([{ bikeId: idSepeda, tanggal: "2026-08-20", jam: 9 }]);
  });

  it("menempatkan jam dini hari WIB pada tanggal WIB-nya, bukan tanggal UTC", async () => {
    // 20 Agustus 01:00 WIB = 19 Agustus 18:00 UTC. Memakai tanggal UTC akan
    // menaruhnya di hari sebelumnya, sehingga formulir menandai hari yang salah.
    await isiSlot(["2026-08-19T18:00:00.000Z"]);

    const [hasil] = await jamTerpakai(RENTANG);

    expect(hasil.tanggal).toBe("2026-08-20");
    expect(hasil.jam).toBe(1);
  });

  it("mengembalikan seluruh jam yang dipesan, bukan hanya jam mulainya", async () => {
    await isiSlot([
      "2026-08-20T02:00:00.000Z",
      "2026-08-20T03:00:00.000Z",
      "2026-08-20T04:00:00.000Z",
    ]);

    const jam = (await jamTerpakai(RENTANG)).map((h) => h.jam).sort((a, b) => a - b);

    expect(jam).toEqual([9, 10, 11]);
  });

  it("tidak mengembalikan slot booking yang sudah dibatalkan", async () => {
    // Pembatalan melepas jamnya supaya bisa dipesan lagi. Kalau slot mati masih
    // ikut, formulir akan menolak jam yang sebenarnya sudah bebas.
    await isiSlot(["2026-08-20T02:00:00.000Z"]);
    await uji.db.update(bookingSlots).set({ aktif: false });

    expect(await jamTerpakai(RENTANG)).toHaveLength(0);
  });

  it("memisahkan per sepeda", async () => {
    await isiSlot(["2026-08-20T02:00:00.000Z"]);
    await uji.db.insert(bookingSlots).values({
      bookingId: idBooking,
      bikeId: idSepedaLain,
      jam: new Date("2026-08-20T05:00:00.000Z"), // 12:00 WIB
    });

    const hasil = await jamTerpakai(RENTANG);

    expect(hasil.find((h) => h.bikeId === idSepeda)?.jam).toBe(9);
    expect(hasil.find((h) => h.bikeId === idSepedaLain)?.jam).toBe(12);
  });

  it("tidak mengembalikan slot di luar rentang", async () => {
    await isiSlot(["2026-09-01T02:00:00.000Z"]);

    expect(await jamTerpakai(RENTANG)).toHaveLength(0);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDbUji, type DbUji } from "./db-uji";
import {
  bikes,
  cashDeposits,
  expenses,
  owners,
  ownerPayments,
  renters,
  rentals,
  users,
} from "@/lib/db/schema";
import { awalHariWib } from "@/lib/waktu";
import {
  SetoranTidakAda,
  SudahDiterima,
  SudahDitutup,
  buatSetoran,
  daftarSetoran,
  rekapKasHarian,
  setoranHari,
  terimaSetoran,
} from "@/lib/kas/kelola";

/**
 * Uji penutupan kas harian.
 *
 * Yang dijaga di sini adalah pertanyaan "berapa uang tunai yang seharusnya ada
 * di tangan kasir ini, hari ini". Salah sedikit saja pada penyaringnya — ikut
 * menghitung QRIS, ikut menghitung kasir lain, atau lupa mengurangi pengeluaran
 * dari laci — membuat angkanya meleset tiap hari, dan fitur yang angkanya tidak
 * dipercaya lebih buruk daripada tidak ada fitur sama sekali.
 */

let uji: DbUji;

// Hari yang dipakai seluruh uji. Dipatok, bukan "hari ini", supaya hasilnya
// tidak berubah tergantung kapan uji dijalankan.
const HARI = new Date("2026-08-14T05:00:00.000Z"); // 12:00 WIB
const HARI_WIB = awalHariWib(HARI);
const HARI_LAIN = new Date("2026-08-15T05:00:00.000Z");

let idRina = 0;
let idBudi = 0;
let idAdmin = 0;
let idSepeda = 0;
let idPenyewa = 0;
let idPemilik = 0;

beforeAll(async () => {
  uji = await buatDbUji();
});

afterAll(async () => {
  await uji.tutup();
});

beforeEach(async () => {
  await uji.db.delete(cashDeposits);
  await uji.db.delete(ownerPayments);
  await uji.db.delete(expenses);
  await uji.db.delete(rentals);
  await uji.db.delete(bikes);
  await uji.db.delete(renters);
  await uji.db.delete(owners);
  await uji.db.delete(users);

  [{ id: idRina }] = await uji.db
    .insert(users)
    .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });

  [{ id: idBudi }] = await uji.db
    .insert(users)
    .values({ username: "budi", nama: "Budi", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });

  [{ id: idAdmin }] = await uji.db
    .insert(users)
    .values({ username: "admin", nama: "Admin", peran: "admin", passwordHash: "x" })
    .returning({ id: users.id });

  [{ id: idPemilik }] = await uji.db
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

  [{ id: idPenyewa }] = await uji.db
    .insert(renters)
    .values({ nama: "Andi", noHp: "0822" })
    .returning({ id: renters.id });
});

/** Rental yang sudah selesai dan menghasilkan uang. */
async function rentalSelesai(opsi: {
  total: number;
  metode: "tunai" | "qris" | "transfer";
  diselesaikanOleh: number | null;
  kasirId?: number;
  waktuSelesai?: Date;
  status?: "selesai" | "batal";
}) {
  await uji.db.insert(rentals).values({
    bikeId: idSepeda,
    renterId: idPenyewa,
    kasirId: opsi.kasirId ?? idRina,
    diselesaikanOleh: opsi.diselesaikanOleh,
    ownerIdSnapshot: idPemilik,
    tarifPerJamSnapshot: 15000,
    persentasePemilikSnapshot: 60,
    waktuMulai: new Date(HARI.getTime() - 3600_000),
    waktuSelesai: opsi.waktuSelesai ?? HARI,
    totalBiaya: opsi.total,
    bagianPemilik: Math.round(opsi.total * 0.6),
    bagianRental: opsi.total - Math.round(opsi.total * 0.6),
    metodeBayar: opsi.metode,
    status: opsi.status ?? "selesai",
  });
}

describe("rekap kas harian", () => {
  it("menjumlahkan rental tunai milik kasir itu pada hari itu", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai", diselesaikanOleh: idRina });
    await rentalSelesai({ total: 30000, metode: "tunai", diselesaikanOleh: idRina });

    const rekap = await rekapKasHarian(idRina, HARI);

    expect(rekap.penerimaanTunai).toBe(75000);
    expect(rekap.jumlahSeharusnya).toBe(75000);
  });

  it("tidak menghitung QRIS dan transfer, karena uangnya tidak masuk laci", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai", diselesaikanOleh: idRina });
    await rentalSelesai({ total: 90000, metode: "qris", diselesaikanOleh: idRina });
    await rentalSelesai({ total: 60000, metode: "transfer", diselesaikanOleh: idRina });

    const rekap = await rekapKasHarian(idRina, HARI);

    expect(rekap.penerimaanTunai).toBe(45000);
  });

  it("tidak menghitung uang yang diterima kasir lain", async () => {
    await rentalSelesai({ total: 45000, metode: "tunai", diselesaikanOleh: idRina });
    await rentalSelesai({ total: 80000, metode: "tunai", diselesaikanOleh: idBudi });

    expect((await rekapKasHarian(idRina, HARI)).penerimaanTunai).toBe(45000);
    expect((await rekapKasHarian(idBudi, HARI)).penerimaanTunai).toBe(80000);
  });

  it("mengikuti yang menyelesaikan rental, bukan yang memulainya", async () => {
    // Rina membuka rental pagi, Budi yang menerima uangnya saat sepeda kembali
    // setelah pergantian shift. Uang ada di tangan Budi.
    await rentalSelesai({
      total: 45000,
      metode: "tunai",
      kasirId: idRina,
      diselesaikanOleh: idBudi,
    });

    expect((await rekapKasHarian(idRina, HARI)).penerimaanTunai).toBe(0);
    expect((await rekapKasHarian(idBudi, HARI)).penerimaanTunai).toBe(45000);
  });

  it("jatuh kembali ke kasir pembuka untuk baris lama yang belum punya penyelesai", async () => {
    await rentalSelesai({
      total: 45000,
      metode: "tunai",
      kasirId: idRina,
      diselesaikanOleh: null,
    });

    expect((await rekapKasHarian(idRina, HARI)).penerimaanTunai).toBe(45000);
  });

  it("tidak menghitung hari lain", async () => {
    await rentalSelesai({
      total: 45000,
      metode: "tunai",
      diselesaikanOleh: idRina,
      waktuSelesai: HARI_LAIN,
    });

    expect((await rekapKasHarian(idRina, HARI)).penerimaanTunai).toBe(0);
  });

  it("tidak menghitung rental yang dibatalkan", async () => {
    await rentalSelesai({
      total: 45000,
      metode: "tunai",
      diselesaikanOleh: idRina,
      status: "batal",
    });

    expect((await rekapKasHarian(idRina, HARI)).penerimaanTunai).toBe(0);
  });

  it("mengurangi pengeluaran yang dibayar tunai dari laci", async () => {
    await rentalSelesai({ total: 100000, metode: "tunai", diselesaikanOleh: idRina });

    await uji.db.insert(expenses).values({
      tanggal: HARI,
      kategori: "sparepart",
      keterangan: "Ban dalam",
      jumlah: 25000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    const rekap = await rekapKasHarian(idRina, HARI);

    expect(rekap.pengeluaranTunai).toBe(25000);
    expect(rekap.jumlahSeharusnya).toBe(75000);
  });

  it("tidak mengurangi pengeluaran yang dibayar transfer", async () => {
    await rentalSelesai({ total: 100000, metode: "tunai", diselesaikanOleh: idRina });

    await uji.db.insert(expenses).values({
      tanggal: HARI,
      kategori: "listrik",
      keterangan: "Token listrik",
      jumlah: 50000,
      metode: "transfer",
      dicatatOleh: idRina,
    });

    const rekap = await rekapKasHarian(idRina, HARI);

    expect(rekap.pengeluaranTunai).toBe(0);
    expect(rekap.jumlahSeharusnya).toBe(100000);
  });

  it("mengurangi setoran tunai kepada pemilik sepeda", async () => {
    await rentalSelesai({ total: 100000, metode: "tunai", diselesaikanOleh: idRina });

    await uji.db.insert(ownerPayments).values({
      ownerId: idPemilik,
      tanggal: HARI,
      jumlah: 40000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    const rekap = await rekapKasHarian(idRina, HARI);

    expect(rekap.setoranPemilikTunai).toBe(40000);
    expect(rekap.jumlahSeharusnya).toBe(60000);
  });

  it("membiarkan angka seharusnya menjadi negatif kalau laci terpakai lebih besar", async () => {
    // Bukan dijepit ke nol: kalau kasir memakai uang kemarin untuk belanja hari
    // ini, angka negatif itulah yang benar dan harus terlihat.
    await uji.db.insert(expenses).values({
      tanggal: HARI,
      kategori: "operasional",
      keterangan: "Bensin",
      jumlah: 30000,
      metode: "tunai",
      dicatatOleh: idRina,
    });

    expect((await rekapKasHarian(idRina, HARI)).jumlahSeharusnya).toBe(-30000);
  });
});

describe("membuat setoran", () => {
  it("menyimpan selisih negatif saat uang yang diserahkan kurang", async () => {
    await rentalSelesai({ total: 100000, metode: "tunai", diselesaikanOleh: idRina });

    const { id } = await buatSetoran({
      kasirId: idRina,
      hari: HARI,
      jumlahDiserahkan: 90000,
      catatan: "Kurang, dipakai beli ban",
    });

    const [baris] = await uji.db.select().from(cashDeposits).where(eq(cashDeposits.id, id));

    expect(baris.jumlahSeharusnya).toBe(100000);
    expect(baris.jumlahDiserahkan).toBe(90000);
    expect(baris.selisih).toBe(-10000);
    expect(baris.status).toBe("menunggu");
    expect(baris.diterimaOleh).toBeNull();
  });

  it("membekukan angka sistem, sehingga perubahan data setelahnya tidak menggeser penutupan", async () => {
    await rentalSelesai({ total: 100000, metode: "tunai", diselesaikanOleh: idRina });

    const { id } = await buatSetoran({
      kasirId: idRina,
      hari: HARI,
      jumlahDiserahkan: 100000,
    });

    // Transaksi susulan pada hari yang sama, dicatat setelah kas ditutup.
    await rentalSelesai({ total: 55000, metode: "tunai", diselesaikanOleh: idRina });

    const [baris] = await uji.db.select().from(cashDeposits).where(eq(cashDeposits.id, id));

    expect(baris.jumlahSeharusnya).toBe(100000);
    expect(baris.selisih).toBe(0);
  });

  it("menolak penutupan kedua untuk kasir dan hari yang sama", async () => {
    await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });

    await expect(
      buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 }),
    ).rejects.toThrow(SudahDitutup);

    expect(await uji.db.select().from(cashDeposits)).toHaveLength(1);
  });

  it("menganggap jam berapa pun pada hari yang sama sebagai satu hari", async () => {
    await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });

    const malamHariYangSama = new Date("2026-08-14T14:30:00.000Z"); // 21:30 WIB

    await expect(
      buatSetoran({ kasirId: idRina, hari: malamHariYangSama, jumlahDiserahkan: 0 }),
    ).rejects.toThrow(SudahDitutup);
  });

  it("membiarkan kasir berbeda menutup pada hari yang sama", async () => {
    await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });
    await buatSetoran({ kasirId: idBudi, hari: HARI, jumlahDiserahkan: 0 });

    expect(await uji.db.select().from(cashDeposits)).toHaveLength(2);
  });

  it("menyimpan tanggal sebagai awal hari WIB", async () => {
    const { id } = await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });

    const [baris] = await uji.db.select().from(cashDeposits).where(eq(cashDeposits.id, id));

    expect(baris.tanggal.getTime()).toBe(HARI_WIB.getTime());
  });
});

describe("menerima setoran", () => {
  it("mencatat siapa yang menerima dan kapan", async () => {
    const { id } = await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });

    await terimaSetoran(id, idAdmin);

    const [baris] = await uji.db.select().from(cashDeposits).where(eq(cashDeposits.id, id));

    expect(baris.status).toBe("diterima");
    expect(baris.diterimaOleh).toBe(idAdmin);
    expect(baris.diterimaPada).not.toBeNull();
  });

  it("menolak setoran yang sudah diterima, supaya penerimanya tidak tertimpa", async () => {
    const { id } = await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });
    await terimaSetoran(id, idAdmin);

    await expect(terimaSetoran(id, idBudi)).rejects.toThrow(SudahDiterima);

    const [baris] = await uji.db.select().from(cashDeposits).where(eq(cashDeposits.id, id));
    expect(baris.diterimaOleh).toBe(idAdmin);
  });

  it("menolak id yang tidak ada", async () => {
    await expect(terimaSetoran(9999, idAdmin)).rejects.toThrow(SetoranTidakAda);
  });
});

describe("membaca setoran", () => {
  it("mengembalikan penutupan milik kasir pada hari itu, atau null kalau belum ada", async () => {
    expect(await setoranHari(idRina, HARI)).toBeNull();

    await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });

    expect(await setoranHari(idRina, HARI)).not.toBeNull();
  });

  it("mendaftar setoran beserta nama kasirnya, terbaru dulu", async () => {
    await buatSetoran({ kasirId: idRina, hari: HARI, jumlahDiserahkan: 0 });
    await buatSetoran({ kasirId: idBudi, hari: HARI_LAIN, jumlahDiserahkan: 0 });

    const daftar = await daftarSetoran({
      mulai: awalHariWib(HARI),
      selesai: new Date(awalHariWib(HARI_LAIN).getTime() + 86_400_000),
    });

    expect(daftar).toHaveLength(2);
    expect(daftar[0].namaKasir).toBe("Budi");
    expect(daftar[1].namaKasir).toBe("Rina");
  });
});

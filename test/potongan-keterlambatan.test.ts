import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buatDbUji, type DbUji } from "./db-uji";
import { bikes, owners, renters, rentals, users } from "@/lib/db/schema";
import { potonganPerKasir, rincianPotongan } from "@/lib/queries/laporan";
import { rentangHariWib } from "@/lib/waktu";

/**
 * Laporan keringanan denda keterlambatan.
 *
 * Yang diuji di sini bukan tampilannya, melainkan satu hal yang menentukan
 * apakah laporan ini ada gunanya sebagai pertanggungjawaban: keringanan harus
 * dibebankan kepada petugas yang MENYELESAIKAN rental — dialah yang memutuskan
 * angkanya dan menerima uangnya — bukan kepada petugas yang mencatat
 * keberangkatannya berjam-jam sebelumnya.
 */

let uji: DbUji;
let idSepeda: number;
let idPenyewa: number;
let idRina: number;
let idBudi: number;

const TARIF = 15_000;
const HARI = new Date("2026-08-14T05:00:00.000Z"); // 12:00 WIB

/** Rental selesai dengan denda yang disarankan dan yang benar-benar ditagih. */
async function rentalSelesai(opsi: {
  diselesaikanOleh: number;
  dicatatOleh?: number;
  saran: number;
  ditagih: number;
  alasan?: string;
  menitKe?: number;
}) {
  const waktuMulai = new Date(HARI.getTime() + (opsi.menitKe ?? 0) * 60_000);
  const waktuSelesai = new Date(waktuMulai.getTime() + 90 * 60_000);
  const total = TARIF + opsi.ditagih;

  const [baris] = await uji.db
    .insert(rentals)
    .values({
      bikeId: idSepeda,
      renterId: idPenyewa,
      kasirId: opsi.dicatatOleh ?? opsi.diselesaikanOleh,
      diselesaikanOleh: opsi.diselesaikanOleh,
      ownerIdSnapshot: 1,
      tarifPerJamSnapshot: TARIF,
      persentasePemilikSnapshot: 60,
      waktuMulai,
      waktuSelesai,
      status: "selesai",
      durasiMenit: 90,
      durasiJamDitagih: 1,
      tambahanSaran: opsi.saran,
      tambahanDitagih: opsi.ditagih,
      alasanPotongan: opsi.alasan ?? null,
      totalBiaya: total,
      bagianPemilik: Math.floor((total * 60) / 100),
      bagianRental: total - Math.floor((total * 60) / 100),
      metodeBayar: "tunai",
    })
    .returning({ id: rentals.id });

  return baris.id;
}

beforeAll(async () => {
  uji = await buatDbUji();

  await uji.db
    .insert(owners)
    .values({ nama: "Pemilik", noHp: "081200000000", persentaseBagiHasil: 60 });

  const [s] = await uji.db
    .insert(bikes)
    .values({
      kode: "MTB-001",
      nama: "Xtrada",
      jenis: "MTB",
      tarifPerJam: TARIF,
      ownerId: 1,
    })
    .returning({ id: bikes.id });
  idSepeda = s.id;

  const [p] = await uji.db
    .insert(renters)
    .values({ nama: "Asep", noHp: "081200000001" })
    .returning({ id: renters.id });
  idPenyewa = p.id;

  const [rina] = await uji.db
    .insert(users)
    .values({ username: "rina", nama: "Rina", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });
  idRina = rina.id;

  const [budi] = await uji.db
    .insert(users)
    .values({ username: "budi", nama: "Budi", peran: "kasir", passwordHash: "x" })
    .returning({ id: users.id });
  idBudi = budi.id;

  // Rina membebaskan hampir semua denda, Budi menagih penuh. Justru pola
  // seperti inilah yang laporan ini ada untuk memperlihatkan.
  await rentalSelesai({
    diselesaikanOleh: idRina,
    saran: 7_500,
    ditagih: 0,
    alasan: "penyewa langganan",
    menitKe: 0,
  });
  await rentalSelesai({
    diselesaikanOleh: idRina,
    saran: 7_500,
    ditagih: 2_500,
    alasan: "ban bocor di jalan",
    menitKe: 200,
  });
  await rentalSelesai({
    diselesaikanOleh: idRina,
    saran: 7_500,
    ditagih: 7_500,
    menitKe: 400,
  });

  // Rental Budi dimulai oleh Rina — pergantian shift. Keringanannya harus
  // tercatat atas nama Budi, bukan Rina.
  await rentalSelesai({
    diselesaikanOleh: idBudi,
    dicatatOleh: idRina,
    saran: 7_500,
    ditagih: 5_000,
    alasan: "hujan deras",
    menitKe: 600,
  });

  // Tidak telat sama sekali: tidak boleh muncul di laporan mana pun.
  await rentalSelesai({
    diselesaikanOleh: idBudi,
    saran: 0,
    ditagih: 0,
    menitKe: 700,
  });
});

afterAll(async () => {
  await uji.tutup();
});

describe("potonganPerKasir", () => {
  it("membebankan keringanan ke petugas yang menyelesaikan, bukan yang mencatat", async () => {
    const hasil = await potonganPerKasir(rentangHariWib(HARI));
    const budi = hasil.find((k) => k.namaKasir === "Budi");
    const rina = hasil.find((k) => k.namaKasir === "Rina");

    expect(budi?.totalPotongan).toBe(2_500); // 7.500 − 5.000
    expect(rina?.totalPotongan).toBe(12_500); // 7.500 + 5.000 + 0
  });

  it("tidak menghitung rental yang pulang tepat waktu", async () => {
    const hasil = await potonganPerKasir(rentangHariWib(HARI));
    const budi = hasil.find((k) => k.namaKasir === "Budi");

    // Budi menyelesaikan dua rental, tapi hanya satu yang telat.
    expect(budi?.jumlahTelat).toBe(1);
  });

  it("memisahkan banyaknya rental telat dari banyaknya yang diberi keringanan", async () => {
    const hasil = await potonganPerKasir(rentangHariWib(HARI));
    const rina = hasil.find((k) => k.namaKasir === "Rina");

    // Angka "2 keringanan" tidak berarti apa-apa tanpa tahu itu dari berapa.
    expect(rina?.jumlahTelat).toBe(3);
    expect(rina?.jumlahDiberiPotongan).toBe(2);
  });

  it("mengurutkan dari keringanan terbesar supaya polanya langsung terlihat", async () => {
    const hasil = await potonganPerKasir(rentangHariWib(HARI));
    expect(hasil.map((k) => k.namaKasir)).toEqual(["Rina", "Budi"]);
  });

  it("mengabaikan periode lain", async () => {
    const besok = new Date(HARI.getTime() + 24 * 60 * 60 * 1000);
    expect(await potonganPerKasir(rentangHariWib(besok))).toEqual([]);
  });
});

describe("rincianPotongan", () => {
  it("hanya memuat rental yang benar-benar diberi keringanan", async () => {
    const hasil = await rincianPotongan(rentangHariWib(HARI));
    expect(hasil).toHaveLength(3);
    expect(hasil.every((r) => r.saran > r.ditagih)).toBe(true);
  });

  it("membawa alasan dan nama petugas yang menuliskannya", async () => {
    const hasil = await rincianPotongan(rentangHariWib(HARI));
    const hujan = hasil.find((r) => r.alasan === "hujan deras");

    expect(hujan?.namaKasir).toBe("Budi");
    expect(hujan?.saran).toBe(7_500);
    expect(hujan?.ditagih).toBe(5_000);
  });

  it("menghitung menit keterlambatan dari durasi yang tersimpan", async () => {
    const hasil = await rincianPotongan(rentangHariWib(HARI));
    // 90 menit durasi, 1 jam pokok → 30 menit di luar jam pokok.
    expect(hasil.every((r) => r.sisaMenit === 30)).toBe(true);
  });
});

import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, ownerPayments, owners, rentals, users } from "@/lib/db/schema";
import type { KategoriPengeluaran } from "@/lib/db/schema";
import { ringkasanPeriode } from "./rentals";
import type { Rentang } from "./laporan";

export const LABEL_KATEGORI: Record<KategoriPengeluaran, string> = {
  gaji: "Gaji",
  listrik: "Listrik",
  pdam: "PDAM",
  maintenance: "Maintenance",
  sparepart: "Sparepart",
  operasional: "Operasional",
  lainnya: "Lain-lain",
};

export async function daftarPengeluaran(filter: {
  rentang?: Rentang;
  kategori?: KategoriPengeluaran;
  batas?: number;
}) {
  const syarat = [];
  if (filter.kategori) syarat.push(eq(expenses.kategori, filter.kategori));
  if (filter.rentang) {
    syarat.push(gte(expenses.tanggal, filter.rentang.mulai));
    syarat.push(lt(expenses.tanggal, filter.rentang.selesai));
  }

  return db
    .select({
      id: expenses.id,
      tanggal: expenses.tanggal,
      kategori: expenses.kategori,
      keterangan: expenses.keterangan,
      jumlah: expenses.jumlah,
      maintenanceId: expenses.maintenanceId,
      namaPetugas: users.nama,
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.dicatatOleh, users.id))
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(desc(expenses.tanggal), desc(expenses.id))
    .limit(filter.batas ?? 200);
}

export async function totalPengeluaran(rentang: Rentang): Promise<number> {
  const [hasil] = await db
    .select({ total: sql<number>`coalesce(sum(${expenses.jumlah}), 0)::int` })
    .from(expenses)
    .where(and(gte(expenses.tanggal, rentang.mulai), lt(expenses.tanggal, rentang.selesai)));

  return hasil?.total ?? 0;
}

export async function pengeluaranPerKategori(rentang: Rentang) {
  return db
    .select({
      kategori: expenses.kategori,
      jumlah: sql<number>`coalesce(sum(${expenses.jumlah}), 0)::int`,
      banyak: sql<number>`count(*)::int`,
    })
    .from(expenses)
    .where(and(gte(expenses.tanggal, rentang.mulai), lt(expenses.tanggal, rentang.selesai)))
    .groupBy(expenses.kategori)
    .orderBy(desc(sql`sum(${expenses.jumlah})`));
}

export type LabaRugi = {
  omzetKotor: number;
  bagianPemilik: number;
  pendapatanRental: number;
  pengeluaran: number;
  labaBersih: number;
  jumlahTransaksi: number;
};

/**
 * Laba rugi satu periode.
 *
 * Laba dihitung dari BAGIAN RENTAL, bukan dari omzet kotor. Omzet kotor memuat
 * bagian pemilik sepeda — uang yang hanya numpang lewat dan wajib disetorkan,
 * bukan pendapatan rental. Mengurangkan pengeluaran langsung dari omzet kotor
 * akan membuat laba terbaca jauh lebih besar daripada yang sebenarnya.
 *
 * Omzet kotor dan bagian pemilik tetap dikembalikan supaya keduanya bisa
 * ditampilkan berdampingan dan angkanya bisa ditelusuri.
 */
export async function labaRugi(rentang: Rentang): Promise<LabaRugi> {
  const [ringkasan, pengeluaran] = await Promise.all([
    ringkasanPeriode(rentang),
    totalPengeluaran(rentang),
  ]);

  return {
    omzetKotor: ringkasan.totalOmzet,
    bagianPemilik: ringkasan.totalBagianPemilik,
    pendapatanRental: ringkasan.totalBagianRental,
    pengeluaran,
    labaBersih: ringkasan.totalBagianRental - pengeluaran,
    jumlahTransaksi: ringkasan.jumlahTransaksi,
  };
}

// --- Pembayaran bagi hasil ke pemilik ---------------------------------------

export async function daftarPembayaranPemilik(ownerId?: number, batas = 100) {
  return db
    .select({
      id: ownerPayments.id,
      ownerId: ownerPayments.ownerId,
      namaPemilik: owners.nama,
      tanggal: ownerPayments.tanggal,
      jumlah: ownerPayments.jumlah,
      metode: ownerPayments.metode,
      catatan: ownerPayments.catatan,
      namaPetugas: users.nama,
    })
    .from(ownerPayments)
    .innerJoin(owners, eq(ownerPayments.ownerId, owners.id))
    .innerJoin(users, eq(ownerPayments.dicatatOleh, users.id))
    .where(ownerId ? eq(ownerPayments.ownerId, ownerId) : undefined)
    .orderBy(desc(ownerPayments.tanggal), desc(ownerPayments.id))
    .limit(batas);
}

export type SaldoPemilik = {
  ownerId: number;
  nama: string;
  noHp: string;
  persentaseBagiHasil: number;
  /**
   * Benar kalau baris ini mewakili rental itu sendiri, bukan pihak yang
   * menitipkan sepeda. Haknya selalu nol, jadi ia tidak pernah menjadi utang —
   * tapi tetap dibawa supaya tampilan bisa memisahkannya dari total yang harus
   * disetorkan, bukan menyembunyikannya begitu saja.
   */
  milikSendiri: boolean;
  /** Total bagian pemilik dari seluruh rental yang pernah selesai. */
  totalHak: number;
  /** Total yang sudah benar-benar disetorkan. */
  sudahDibayar: number;
  /** Sisa yang masih harus disetorkan. */
  sisa: number;
};

/**
 * Saldo bagi hasil tiap pemilik, dihitung sepanjang masa, bukan per periode.
 *
 * Inilah angka yang dipakai saat menyerahkan uang: yang penting bukan "bulan ini
 * berapa", melainkan "sampai hari ini masih kurang berapa". Menghitungnya per
 * periode akan menyembunyikan kekurangan bayar dari bulan-bulan sebelumnya.
 *
 * Dua penjumlahan sengaja dikerjakan sebagai subkueri terpisah lalu digabung di
 * aplikasi. Menggabungkan dua tabel bercabang dalam satu query akan menggandakan
 * baris dan membuat kedua jumlahnya salah.
 */
export async function saldoSemuaPemilik(): Promise<SaldoPemilik[]> {
  const [daftar, hak, bayar] = await Promise.all([
    db
      .select({
        ownerId: owners.id,
        nama: owners.nama,
        noHp: owners.noHp,
        persentaseBagiHasil: owners.persentaseBagiHasil,
        milikSendiri: owners.milikSendiri,
      })
      .from(owners)
      // Milik sendiri didahulukan: itulah baris yang paling sering dilihat, dan
      // menaruhnya di antara nama-nama pemilik lain membuatnya mudah terlewat.
      .orderBy(desc(owners.milikSendiri), owners.nama),

    db
      .select({
        ownerId: rentals.ownerIdSnapshot,
        total: sql<number>`coalesce(sum(${rentals.bagianPemilik}), 0)::int`,
      })
      .from(rentals)
      .where(eq(rentals.status, "selesai"))
      .groupBy(rentals.ownerIdSnapshot),

    db
      .select({
        ownerId: ownerPayments.ownerId,
        total: sql<number>`coalesce(sum(${ownerPayments.jumlah}), 0)::int`,
      })
      .from(ownerPayments)
      .groupBy(ownerPayments.ownerId),
  ]);

  const petaHak = new Map(hak.map((h) => [h.ownerId, h.total]));
  const petaBayar = new Map(bayar.map((b) => [b.ownerId, b.total]));

  return daftar.map((p) => {
    const totalHak = petaHak.get(p.ownerId) ?? 0;
    const sudahDibayar = petaBayar.get(p.ownerId) ?? 0;
    return { ...p, totalHak, sudahDibayar, sisa: totalHak - sudahDibayar };
  });
}

export async function saldoPemilik(ownerId: number): Promise<SaldoPemilik | null> {
  const semua = await saldoSemuaPemilik();
  return semua.find((s) => s.ownerId === ownerId) ?? null;
}

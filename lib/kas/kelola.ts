import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cashDeposits,
  expenses,
  ownerPayments,
  rentals,
  users,
} from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { awalHariWib, rentangHariWib } from "@/lib/waktu";

/**
 * Penutupan kas harian.
 *
 * Dipisah dari lib/actions/kas.ts karena aturan di sini yang paling mahal kalau
 * salah: satu penyaring yang meleset membuat angka "seharusnya" salah setiap
 * hari, dan fitur yang angkanya tidak dipercaya lebih buruk daripada tidak ada.
 * Di berkas ini semuanya bisa dijalankan di atas Postgres sungguhan lewat uji.
 */

/** Kasir ini sudah menutup kas untuk hari tersebut. */
export class SudahDitutup extends Error {}

export class SetoranTidakAda extends Error {}

/** Setoran sudah ditandai diterima; penerimanya tidak boleh tertimpa. */
export class SudahDiterima extends Error {}

export type RekapKas = {
  /** Rental selesai yang dibayar tunai dan diterima kasir ini. */
  penerimaanTunai: number;
  /** Pengeluaran yang dibayar dari laci. */
  pengeluaranTunai: number;
  /** Setoran bagi hasil kepada pemilik sepeda yang dibayar tunai. */
  setoranPemilikTunai: number;
  /** Penerimaan dikurangi keduanya. Boleh negatif. */
  jumlahSeharusnya: number;
};

export type SetoranLengkap = {
  id: number;
  tanggal: Date;
  kasirId: number;
  namaKasir: string;
  penerimaanTunai: number;
  pengeluaranTunai: number;
  setoranPemilikTunai: number;
  jumlahSeharusnya: number;
  jumlahDiserahkan: number;
  selisih: number;
  catatan: string | null;
  status: "menunggu" | "diterima";
  namaPenerima: string | null;
  diterimaPada: Date | null;
};

function angka(nilai: unknown): number {
  return Number(nilai ?? 0);
}

/**
 * Menghitung berapa uang tunai yang seharusnya ada di tangan seorang kasir pada
 * satu hari WIB.
 *
 * Penerimaan mengikuti waktu rental **diselesaikan**, bukan waktu dimulai:
 * uangnya berpindah tangan saat sepeda kembali. Karena alasan yang sama,
 * penanggung jawabnya adalah petugas yang menyelesaikan — dengan jatuh kembali
 * ke kasir pembuka untuk baris lama yang belum punya kolom itu.
 */
export async function rekapKasHarian(kasirId: number, hari: Date): Promise<RekapKas> {
  const { mulai, selesai } = rentangHariWib(hari);

  const penanggungJawab = sql`coalesce(${rentals.diselesaikanOleh}, ${rentals.kasirId})`;

  const [masuk] = await db
    .select({ jumlah: sql<number>`coalesce(sum(${rentals.totalBiaya}), 0)` })
    .from(rentals)
    .where(
      and(
        eq(rentals.status, "selesai"),
        eq(rentals.metodeBayar, "tunai"),
        sql`${penanggungJawab} = ${kasirId}`,
        gte(rentals.waktuSelesai, mulai),
        lt(rentals.waktuSelesai, selesai),
      ),
    );

  const [keluar] = await db
    .select({ jumlah: sql<number>`coalesce(sum(${expenses.jumlah}), 0)` })
    .from(expenses)
    .where(
      and(
        eq(expenses.metode, "tunai"),
        eq(expenses.dicatatOleh, kasirId),
        gte(expenses.tanggal, mulai),
        lt(expenses.tanggal, selesai),
      ),
    );

  const [kePemilik] = await db
    .select({ jumlah: sql<number>`coalesce(sum(${ownerPayments.jumlah}), 0)` })
    .from(ownerPayments)
    .where(
      and(
        eq(ownerPayments.metode, "tunai"),
        eq(ownerPayments.dicatatOleh, kasirId),
        gte(ownerPayments.tanggal, mulai),
        lt(ownerPayments.tanggal, selesai),
      ),
    );

  const penerimaanTunai = angka(masuk?.jumlah);
  const pengeluaranTunai = angka(keluar?.jumlah);
  const setoranPemilikTunai = angka(kePemilik?.jumlah);

  return {
    penerimaanTunai,
    pengeluaranTunai,
    setoranPemilikTunai,
    // Tidak dijepit ke nol. Kalau laci terpakai lebih besar daripada yang masuk
    // hari itu, angka negatif adalah keadaan yang sebenarnya dan justru itu yang
    // perlu terlihat.
    jumlahSeharusnya: penerimaanTunai - pengeluaranTunai - setoranPemilikTunai,
  };
}

/**
 * Menutup kas seorang kasir untuk satu hari.
 *
 * Angka sistem dibekukan ke dalam baris, bukan dihitung ulang setiap kali
 * dibaca. Kalau besok ada rental yang dibatalkan atau pengeluaran yang
 * diperbaiki, penutupan yang sudah disepakati tidak boleh ikut bergeser —
 * selisih yang dulu ditandatangani harus tetap bisa dipertanggungjawabkan.
 */
export async function buatSetoran(input: {
  kasirId: number;
  hari: Date;
  jumlahDiserahkan: number;
  catatan?: string | null;
}): Promise<{ id: number }> {
  const rekap = await rekapKasHarian(input.kasirId, input.hari);

  try {
    const [baris] = await db
      .insert(cashDeposits)
      .values({
        tanggal: awalHariWib(input.hari),
        kasirId: input.kasirId,
        penerimaanTunai: rekap.penerimaanTunai,
        pengeluaranTunai: rekap.pengeluaranTunai,
        setoranPemilikTunai: rekap.setoranPemilikTunai,
        jumlahSeharusnya: rekap.jumlahSeharusnya,
        jumlahDiserahkan: input.jumlahDiserahkan,
        selisih: input.jumlahDiserahkan - rekap.jumlahSeharusnya,
        catatan: input.catatan?.trim() || null,
      })
      .returning({ id: cashDeposits.id });

    return baris;
  } catch (galat) {
    // Indeks unik (kasir, tanggal) yang memutuskan, bukan pemeriksaan terpisah
    // sebelumnya — dua kali tekan tidak boleh menghasilkan dua penutupan.
    if (pelanggaranUnik(galat)) {
      throw new SudahDitutup("Kas hari ini sudah ditutup oleh kasir tersebut.");
    }
    throw galat;
  }
}

/** Menandai setoran sudah diterima. Dipanggil admin atau owner. */
export async function terimaSetoran(id: number, diterimaOlehId: number): Promise<void> {
  const hasil = await db
    .update(cashDeposits)
    .set({
      status: "diterima",
      diterimaOleh: diterimaOlehId,
      diterimaPada: new Date(),
    })
    // Syarat status di dalam WHERE, bukan diperiksa lebih dulu: dua admin yang
    // menekan Terima bersamaan hanya membuat satu di antaranya berhasil.
    .where(and(eq(cashDeposits.id, id), eq(cashDeposits.status, "menunggu")))
    .returning({ id: cashDeposits.id });

  if (hasil.length > 0) return;

  const [ada] = await db
    .select({ id: cashDeposits.id })
    .from(cashDeposits)
    .where(eq(cashDeposits.id, id))
    .limit(1);

  if (!ada) throw new SetoranTidakAda("Setoran tidak ditemukan.");
  throw new SudahDiterima("Setoran ini sudah ditandai diterima.");
}

const kolomSetoran = {
  id: cashDeposits.id,
  tanggal: cashDeposits.tanggal,
  kasirId: cashDeposits.kasirId,
  penerimaanTunai: cashDeposits.penerimaanTunai,
  pengeluaranTunai: cashDeposits.pengeluaranTunai,
  setoranPemilikTunai: cashDeposits.setoranPemilikTunai,
  jumlahSeharusnya: cashDeposits.jumlahSeharusnya,
  jumlahDiserahkan: cashDeposits.jumlahDiserahkan,
  selisih: cashDeposits.selisih,
  catatan: cashDeposits.catatan,
  status: cashDeposits.status,
  diterimaPada: cashDeposits.diterimaPada,
};

const penerima = sql<string | null>`(
  select ${users.nama} from ${users} where ${users.id} = ${cashDeposits.diterimaOleh}
)`;

/** Penutupan milik satu kasir pada satu hari, atau null kalau belum ada. */
export async function setoranHari(
  kasirId: number,
  hari: Date,
): Promise<SetoranLengkap | null> {
  const [baris] = await db
    .select({ ...kolomSetoran, namaKasir: users.nama, namaPenerima: penerima })
    .from(cashDeposits)
    .innerJoin(users, eq(users.id, cashDeposits.kasirId))
    .where(
      and(eq(cashDeposits.kasirId, kasirId), eq(cashDeposits.tanggal, awalHariWib(hari))),
    )
    .limit(1);

  return baris ?? null;
}

export async function daftarSetoran(rentang: {
  mulai: Date;
  selesai: Date;
}): Promise<SetoranLengkap[]> {
  return db
    .select({ ...kolomSetoran, namaKasir: users.nama, namaPenerima: penerima })
    .from(cashDeposits)
    .innerJoin(users, eq(users.id, cashDeposits.kasirId))
    .where(
      and(
        gte(cashDeposits.tanggal, rentang.mulai),
        lt(cashDeposits.tanggal, rentang.selesai),
      ),
    )
    .orderBy(desc(cashDeposits.tanggal), desc(cashDeposits.id));
}

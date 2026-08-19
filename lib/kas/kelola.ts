import "server-only";

import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bikes,
  cashDeposits,
  expenses,
  owners,
  ownerPayments,
  renters,
  rentals,
  users,
  type KategoriPengeluaran,
  type MetodeBayar,
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

/** Setoran sudah dibatalkan sebelumnya. */
export class SudahDibatalkan extends Error {}

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
  status: "menunggu" | "diterima" | "dibatalkan";
  namaPenerima: string | null;
  diterimaPada: Date | null;
  namaPembatal: string | null;
  dibatalkanPada: Date | null;
  alasanBatal: string | null;
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
    .select({ status: cashDeposits.status })
    .from(cashDeposits)
    .where(eq(cashDeposits.id, id))
    .limit(1);

  if (!ada) throw new SetoranTidakAda("Setoran tidak ditemukan.");
  if (ada.status === "dibatalkan") {
    throw new SudahDibatalkan(
      "Setoran ini sudah dibatalkan, jadi tidak bisa ditandai diterima.",
    );
  }
  throw new SudahDiterima("Setoran ini sudah ditandai diterima.");
}

/**
 * Membatalkan penutupan yang salah ketik.
 *
 * Barisnya dibatalkan, tidak dihapus. Penutupan kas adalah tempat selisih uang
 * dipersoalkan; baris yang bisa lenyap tanpa jejak membuat seluruh catatan itu
 * tidak ada gunanya sebagai pertanggungjawaban. Yang berubah hanya statusnya,
 * dan indeks unik sengaja mengecualikan yang sudah dibatalkan sehingga hari itu
 * bisa ditutup ulang.
 *
 * Yang sudah ditandai diterima tidak bisa dibatalkan: dua pihak sudah
 * menyepakatinya, dan membatalkannya berarti membubarkan kesepakatan itu
 * sepihak. Kalau memang perlu, koreksinya lewat catatan penutupan berikutnya.
 */
export async function batalkanSetoran(
  id: number,
  olehId: number,
  alasan: string,
): Promise<void> {
  const hasil = await db
    .update(cashDeposits)
    .set({
      status: "dibatalkan",
      dibatalkanOleh: olehId,
      dibatalkanPada: new Date(),
      alasanBatal: alasan.trim(),
    })
    // Syarat status di dalam WHERE, bukan diperiksa lebih dulu: dua admin yang
    // menekan bersamaan hanya membuat satu di antaranya berhasil.
    .where(and(eq(cashDeposits.id, id), eq(cashDeposits.status, "menunggu")))
    .returning({ id: cashDeposits.id });

  if (hasil.length > 0) return;

  const [ada] = await db
    .select({ status: cashDeposits.status })
    .from(cashDeposits)
    .where(eq(cashDeposits.id, id))
    .limit(1);

  if (!ada) throw new SetoranTidakAda("Setoran tidak ditemukan.");
  if (ada.status === "dibatalkan") {
    throw new SudahDibatalkan("Setoran ini sudah dibatalkan sebelumnya.");
  }
  throw new SudahDiterima(
    "Setoran ini sudah ditandai diterima, jadi tidak bisa dibatalkan lagi.",
  );
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
  dibatalkanPada: cashDeposits.dibatalkanPada,
  alasanBatal: cashDeposits.alasanBatal,
};

const penerima = sql<string | null>`(
  select ${users.nama} from ${users} where ${users.id} = ${cashDeposits.diterimaOleh}
)`;

const pembatal = sql<string | null>`(
  select ${users.nama} from ${users} where ${users.id} = ${cashDeposits.dibatalkanOleh}
)`;

/**
 * Penutupan yang berlaku bagi satu kasir pada satu hari, atau null kalau belum
 * ada.
 *
 * Yang sudah dibatalkan tidak ikut, sama seperti indeks uniknya. Inilah yang
 * membuat formulir tutup kas muncul lagi setelah pembatalan — dan yang membuat
 * kasir boleh menghapus lagi pengeluaran lacinya untuk hari itu.
 */
export async function setoranHari(
  kasirId: number,
  hari: Date,
): Promise<SetoranLengkap | null> {
  const [baris] = await db
    .select({
      ...kolomSetoran,
      namaKasir: users.nama,
      namaPenerima: penerima,
      namaPembatal: pembatal,
    })
    .from(cashDeposits)
    .innerJoin(users, eq(users.id, cashDeposits.kasirId))
    .where(
      and(
        eq(cashDeposits.kasirId, kasirId),
        eq(cashDeposits.tanggal, awalHariWib(hari)),
        isNull(cashDeposits.dibatalkanPada),
      ),
    )
    .limit(1);

  return baris ?? null;
}

/** Pengeluaran ini bukan milik orang yang mencoba menghapusnya. */
export class BukanMilikAnda extends Error {}

/** Kas hari itu sudah ditutup; dasarnya tidak boleh diubah lagi. */
export class KasSudahDitutup extends Error {}

/**
 * Mencatat uang yang diambil kasir dari laci.
 *
 * Menu Pengeluaran yang penuh sengaja tetap tertutup bagi kasir — di sana ada
 * gaji dan seluruh pengeluaran usaha. Yang dibuka hanya ini: uang dari lacinya
 * sendiri, hari ini, atas namanya sendiri.
 *
 * Metode tidak bisa dipilih. Uang yang diambil dari laci menurut definisinya
 * tunai; membiarkannya dipilih hanya membuka jalan mencatat pengeluaran yang
 * tidak pernah mengurangi laci.
 */
export async function catatPengeluaranLaci(input: {
  kasirId: number;
  hari: Date;
  kategori: KategoriPengeluaran;
  keterangan: string;
  jumlah: number;
}): Promise<{ id: number }> {
  const [baris] = await db
    .insert(expenses)
    .values({
      tanggal: input.hari,
      kategori: input.kategori,
      keterangan: input.keterangan.trim(),
      jumlah: input.jumlah,
      metode: "tunai",
      dicatatOleh: input.kasirId,
    })
    .returning({ id: expenses.id });

  return baris;
}

/**
 * Membatalkan pengeluaran yang salah catat.
 *
 * Tanpa ini, satu salah ketik terkunci selamanya dan angka setorannya ikut
 * salah — jebakan yang justru diciptakan oleh fitur pencatatannya sendiri.
 *
 * Dua batas yang dijaga: hanya catatan sendiri, dan hanya selama kas hari itu
 * belum ditutup. Penutupan membekukan angkanya dan sudah disepakati dua pihak;
 * menghapus dasarnya membuat rincian tidak lagi menjumlah ke angka yang
 * ditandatangani.
 */
export async function hapusPengeluaranLaci(id: number, kasirId: number): Promise<void> {
  const [baris] = await db
    .select({ tanggal: expenses.tanggal, dicatatOleh: expenses.dicatatOleh })
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.metode, "tunai")))
    .limit(1);

  // Baris yang tidak ada dan baris milik orang lain sengaja dibalas sama.
  // Membedakannya akan memberi tahu penebak bahwa suatu id itu ada.
  if (!baris || baris.dicatatOleh !== kasirId) {
    throw new BukanMilikAnda("Pengeluaran itu bukan catatan Anda.");
  }

  const sudah = await setoranHari(kasirId, baris.tanggal);
  if (sudah) {
    throw new KasSudahDitutup(
      "Kas hari itu sudah ditutup, jadi catatannya tidak bisa diubah lagi. Minta admin memperbaikinya.",
    );
  }

  await db.delete(expenses).where(eq(expenses.id, id));
}

export type BarisRental = {
  id: number;
  waktu: Date;
  kodeSepeda: string;
  namaPenyewa: string;
  metode: MetodeBayar | null;
  jumlah: number;
};

export type BarisPengeluaran = {
  id: number;
  waktu: Date;
  keterangan: string;
  jumlah: number;
};

export type BarisSetoranPemilik = {
  id: number;
  waktu: Date;
  namaPemilik: string;
  jumlah: number;
};

export type RincianKas = {
  rentalTunai: BarisRental[];
  /** QRIS dan transfer. Uangnya tidak masuk laci, tapi tetap perlu terlihat
   *  supaya penutupan menggambarkan seluruh hari, bukan hanya isi laci. */
  rentalNonTunai: BarisRental[];
  pengeluaranTunai: BarisPengeluaran[];
  setoranPemilikTunai: BarisSetoranPemilik[];
};

/**
 * Transaksi yang membentuk angka penutupan kas.
 *
 * Rekapnya menjawab "berapa"; ini menjawab "dari mana". Ketika uang di laci
 * tidak cocok dengan catatan, tanpa rincian tidak ada apa pun yang bisa
 * diperiksa — dan selisih yang tidak bisa ditelusuri akhirnya cuma
 * ditandatangani saja.
 *
 * Penyaringnya sengaja disamakan persis dengan rekapKasHarian. Rincian yang
 * isinya berbeda dari angkanya lebih berbahaya daripada tidak ada rincian sama
 * sekali, karena ia membuat orang percaya pada pemeriksaan yang sebenarnya
 * salah.
 */
export async function rincianKasHarian(
  kasirId: number,
  hari: Date,
): Promise<RincianKas> {
  const { mulai, selesai } = rentangHariWib(hari);

  const penanggungJawab = sql`coalesce(${rentals.diselesaikanOleh}, ${rentals.kasirId})`;

  const barisRental = await db
    .select({
      id: rentals.id,
      waktu: rentals.waktuSelesai,
      kodeSepeda: bikes.kode,
      namaPenyewa: renters.nama,
      metode: rentals.metodeBayar,
      jumlah: rentals.totalBiaya,
    })
    .from(rentals)
    .innerJoin(bikes, eq(rentals.bikeId, bikes.id))
    .innerJoin(renters, eq(rentals.renterId, renters.id))
    .where(
      and(
        eq(rentals.status, "selesai"),
        sql`${penanggungJawab} = ${kasirId}`,
        gte(rentals.waktuSelesai, mulai),
        lt(rentals.waktuSelesai, selesai),
      ),
    )
    .orderBy(asc(rentals.waktuSelesai));

  const rental: BarisRental[] = barisRental.map((baris) => ({
    id: baris.id,
    // Sudah dijamin ada oleh penyaring status "selesai" dan rentang waktunya.
    waktu: baris.waktu!,
    kodeSepeda: baris.kodeSepeda,
    namaPenyewa: baris.namaPenyewa,
    metode: baris.metode,
    jumlah: baris.jumlah ?? 0,
  }));

  const pengeluaranTunai = await db
    .select({
      id: expenses.id,
      waktu: expenses.tanggal,
      keterangan: expenses.keterangan,
      jumlah: expenses.jumlah,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.metode, "tunai"),
        eq(expenses.dicatatOleh, kasirId),
        gte(expenses.tanggal, mulai),
        lt(expenses.tanggal, selesai),
      ),
    )
    .orderBy(asc(expenses.tanggal));

  const setoranPemilikTunai = await db
    .select({
      id: ownerPayments.id,
      waktu: ownerPayments.tanggal,
      namaPemilik: owners.nama,
      jumlah: ownerPayments.jumlah,
    })
    .from(ownerPayments)
    .innerJoin(owners, eq(ownerPayments.ownerId, owners.id))
    .where(
      and(
        eq(ownerPayments.metode, "tunai"),
        eq(ownerPayments.dicatatOleh, kasirId),
        gte(ownerPayments.tanggal, mulai),
        lt(ownerPayments.tanggal, selesai),
      ),
    )
    .orderBy(asc(ownerPayments.tanggal));

  return {
    rentalTunai: rental.filter((r) => r.metode === "tunai"),
    rentalNonTunai: rental.filter((r) => r.metode !== "tunai"),
    pengeluaranTunai,
    setoranPemilikTunai,
  };
}

export async function daftarSetoran(rentang: {
  mulai: Date;
  selesai: Date;
}): Promise<SetoranLengkap[]> {
  return db
    .select({ ...kolomSetoran, namaKasir: users.nama, namaPenerima: penerima, namaPembatal: pembatal })
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

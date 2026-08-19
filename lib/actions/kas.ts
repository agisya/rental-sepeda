"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibPengguna, wajibPeran } from "@/lib/auth/dal";
import { dariKunciTanggalWib } from "@/lib/waktu";
import { kategoriPengeluaranEnum } from "@/lib/db/schema";
import {
  SetoranTidakAda,
  SudahDibatalkan,
  SudahDiterima,
  SudahDitutup,
  batalkanSetoran,
  buatSetoran,
  catatPengeluaranLaci,
  terimaSetoran,
} from "@/lib/kas/kelola";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

/**
 * Server Action untuk penutupan kas.
 *
 * Aturannya ada di lib/kas/kelola.ts; di sini hanya penjagaan peran dan
 * pemeriksaan masukan. Setiap action memanggil penjaganya sendiri karena Server
 * Action bisa dipanggil lewat POST tanpa melewati halaman yang sudah dijaga.
 */

const skemaTutup = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak dikenali"),
  jumlahDiserahkan: z.coerce
    .number({ error: "Jumlah harus berupa angka" })
    .int("Jumlah harus bilangan bulat rupiah")
    .min(0, "Jumlah tidak boleh negatif")
    .max(1_000_000_000, "Jumlah tidak masuk akal"),
  catatan: z.string().trim().max(300).optional(),
});

/**
 * Menutup kas milik sendiri untuk satu hari.
 *
 * Siapa pun yang memegang uang boleh menutup kasnya — kasir, admin, maupun
 * owner. Yang tidak boleh adalah menutup atas nama orang lain: setoran adalah
 * pernyataan "saya menyerahkan sekian", dan pernyataan itu harus keluar dari
 * orang yang memegang uangnya.
 */
export async function tutupKas(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaTutup.safeParse({
    tanggal: formData.get("tanggal"),
    jumlahDiserahkan: formData.get("jumlahDiserahkan"),
    catatan: formData.get("catatan") ?? undefined,
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const hari = dariKunciTanggalWib(hasil.data.tanggal);
  if (!hari) return { galat: "Tanggal tidak dikenali." };

  try {
    await buatSetoran({
      kasirId: pengguna.id,
      hari,
      jumlahDiserahkan: hasil.data.jumlahDiserahkan,
      catatan: hasil.data.catatan ?? null,
    });
  } catch (galat) {
    if (galat instanceof SudahDitutup) {
      return { galat: "Kas hari ini sudah Anda tutup. Satu penutupan per hari." };
    }
    console.error("Gagal menutup kas:", galat);
    return { galat: "Tidak bisa menyimpan penutupan kas. Coba lagi." };
  }

  revalidatePath("/kas");

  return { berhasil: "Kas ditutup. Menunggu admin menandainya diterima." };
}

const skemaPengeluaran = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak dikenali"),
  kategori: z.enum(kategoriPengeluaranEnum.enumValues, { error: "Pilih kategori" }),
  keterangan: z.string().trim().min(3, "Tulis untuk apa uangnya").max(300),
  jumlah: z.coerce
    .number({ error: "Jumlah harus berupa angka" })
    .int("Jumlah harus rupiah bulat")
    .min(1, "Jumlah harus lebih dari nol")
    .max(1_000_000_000, "Jumlah tidak masuk akal"),
});

/**
 * Mencatat uang yang diambil dari laci sendiri.
 *
 * Terbuka untuk semua peran, termasuk kasir — dan itu memang maksudnya. Menu
 * Pengeluaran yang penuh tetap tertutup bagi kasir karena di sana ada gaji dan
 * seluruh pengeluaran usaha; yang dibuka di sini hanya uang dari lacinya
 * sendiri, atas namanya sendiri.
 *
 * Tanpa jalan ini, ban yang dibeli kasir tidak pernah bisa dicatat olehnya dan
 * selalu muncul sebagai selisih — membuat angka "seharusnya" meleset hampir
 * tiap hari, dan angka yang tidak dipercaya sama saja dengan tidak ada.
 */
export async function catatPengeluaranDariLaci(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaPengeluaran.safeParse({
    tanggal: formData.get("tanggal"),
    kategori: formData.get("kategori"),
    keterangan: formData.get("keterangan"),
    jumlah: formData.get("jumlah"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const hari = dariKunciTanggalWib(hasil.data.tanggal);
  if (!hari) return { galat: "Tanggal tidak dikenali." };

  try {
    await catatPengeluaranLaci({
      kasirId: pengguna.id,
      hari,
      kategori: hasil.data.kategori,
      keterangan: hasil.data.keterangan,
      jumlah: hasil.data.jumlah,
    });
  } catch (galat) {
    console.error("Gagal mencatat pengeluaran dari laci:", galat);
    return { galat: "Tidak bisa menyimpan pengeluaran. Coba lagi." };
  }

  revalidatePath("/kas");
  revalidatePath("/pengeluaran");

  return { berhasil: "Pengeluaran dicatat dan sudah dikurangkan dari setoran Anda." };
}

const skemaBatal = z.object({
  id: z.coerce.number({ error: "Setoran tidak dikenali" }).int().positive(),
  alasan: z.string().trim().min(3, "Tulis alasan pembatalan").max(200),
});

/**
 * Membatalkan penutupan yang salah ketik. Hanya admin dan owner.
 *
 * Sebelum ini, kasir yang salah mengetik jumlah setoran terkunci: indeks unik
 * menolak penutupan kedua untuk hari yang sama, dan jalan keluarnya hanya SQL
 * langsung ke database produksi. Kuncinya sendiri benar dan tetap ada; yang
 * ditambahkan adalah jalan keluar yang sah dan berjejak.
 *
 * Alasan wajib diisi. Pembatalan tanpa alasan pada catatan uang sama saja
 * dengan menghapusnya.
 */
export async function batalkanSetoranKas(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPeran("admin", "owner");

  const hasil = skemaBatal.safeParse({
    id: formData.get("id"),
    alasan: formData.get("alasan"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  try {
    await batalkanSetoran(hasil.data.id, pengguna.id, hasil.data.alasan);
  } catch (galat) {
    if (galat instanceof SudahDiterima || galat instanceof SudahDibatalkan) {
      return { galat: galat.message };
    }
    if (galat instanceof SetoranTidakAda) {
      return { galat: "Setoran itu sudah tidak ada." };
    }
    console.error("Gagal membatalkan setoran:", galat);
    return { galat: "Tidak bisa membatalkan setoran. Coba lagi." };
  }

  revalidatePath("/kas");

  return { berhasil: "Penutupan dibatalkan. Kasir bisa menutup ulang hari itu." };
}

const skemaTerima = z.object({
  id: z.coerce.number({ error: "Setoran tidak dikenali" }).int().positive(),
});

/**
 * Menandai setoran sudah diterima. Hanya admin dan owner.
 *
 * Kasir sengaja tidak boleh: kalau yang menyerahkan sekaligus yang menyatakan
 * sudah diterima, penutupan dua langkah ini kehilangan seluruh gunanya.
 */
export async function terimaSetoranKas(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPeran("admin", "owner");

  const hasil = skemaTerima.safeParse({ id: formData.get("id") });
  if (!hasil.success) return { galat: "Setoran yang dimaksud tidak dikenali." };

  try {
    await terimaSetoran(hasil.data.id, pengguna.id);
  } catch (galat) {
    if (galat instanceof SudahDiterima) {
      return { galat: "Setoran ini sudah ditandai diterima oleh orang lain." };
    }
    if (galat instanceof SetoranTidakAda) {
      return { galat: "Setoran itu sudah tidak ada." };
    }
    console.error("Gagal menerima setoran:", galat);
    return { galat: "Tidak bisa menandai setoran. Coba lagi." };
  }

  revalidatePath("/kas");

  return { berhasil: "Setoran ditandai diterima." };
}

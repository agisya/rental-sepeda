"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wajibPengguna, wajibPeran } from "@/lib/auth/dal";
import { dariKunciTanggalWib } from "@/lib/waktu";
import {
  SetoranTidakAda,
  SudahDiterima,
  SudahDitutup,
  buatSetoran,
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

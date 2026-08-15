"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes } from "@/lib/db/schema";
import { wajibPengguna } from "@/lib/auth/dal";
import { periksaFoto } from "@/lib/foto";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

/**
 * Mengunggah atau mengganti foto sepeda.
 *
 * Dipisah dari simpanSepeda karena unggahan berkas punya batasan ukuran dan
 * kegagalannya berbeda sifat: kalau fotonya ditolak, data sepeda lain tidak
 * boleh ikut gagal tersimpan.
 */
export async function unggahFotoSepeda(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mengubah foto sepeda." };
  }

  const bikeId = Number(formData.get("bikeId"));
  if (!Number.isInteger(bikeId) || bikeId <= 0) {
    return { galat: "Sepeda tidak dikenali." };
  }

  const berkas = formData.get("foto");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { galatField: { foto: ["Pilih berkas foto lebih dulu."] } };
  }

  const isi = new Uint8Array(await berkas.arrayBuffer());
  const periksa = periksaFoto(berkas.type, berkas.size, isi);
  if (!periksa.ok) {
    return { galatField: { foto: [periksa.pesan] } };
  }

  await db
    .update(bikes)
    .set({
      fotoData: Buffer.from(isi),
      fotoTipe: periksa.tipe,
      // Versi naik tiap penggantian supaya alamat gambarnya berubah dan foto
      // lama yang tersimpan di cache browser tidak ikut tertampil.
      fotoVersi: sql`${bikes.fotoVersi} + 1`,
    })
    .where(eq(bikes.id, bikeId));

  revalidatePath(`/sepeda/${bikeId}`);
  revalidatePath("/sepeda");
  return { berhasil: "Foto berhasil diperbarui." };
}

export async function hapusFotoSepeda(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") return;

  const bikeId = Number(formData.get("bikeId"));
  if (!Number.isInteger(bikeId) || bikeId <= 0) return;

  await db
    .update(bikes)
    .set({
      fotoData: null,
      fotoTipe: null,
      fotoVersi: sql`${bikes.fotoVersi} + 1`,
    })
    .where(eq(bikes.id, bikeId));

  revalidatePath(`/sepeda/${bikeId}`);
  revalidatePath("/sepeda");
}

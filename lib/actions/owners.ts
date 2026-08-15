"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { owners } from "@/lib/db/schema";
import { wajibPengguna } from "@/lib/auth/dal";
import { pemilikPunyaSepeda } from "@/lib/queries/owners";
import { normalkanNoHp } from "@/lib/format";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

const skema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 huruf").max(100),
  noHp: z
    .string()
    .trim()
    .min(8, "Nomor HP minimal 8 angka")
    .max(20)
    .refine((v) => /^[\d+\s-]+$/.test(v), "Nomor HP hanya boleh berisi angka"),
  alamat: z.string().trim().max(200).optional(),
  persentaseBagiHasil: z.coerce
    .number({ error: "Persentase harus berupa angka" })
    .int("Persentase harus bilangan bulat")
    .min(0, "Persentase minimal 0")
    .max(100, "Persentase maksimal 100"),
  catatan: z.string().trim().max(500).optional(),
  aktif: z.coerce.boolean().optional(),
});

function bacaForm(formData: FormData) {
  const teks = (kunci: string) => {
    const nilai = formData.get(kunci);
    const bersih = typeof nilai === "string" ? nilai.trim() : "";
    return bersih === "" ? undefined : bersih;
  };

  return {
    nama: formData.get("nama"),
    noHp: formData.get("noHp"),
    alamat: teks("alamat"),
    persentaseBagiHasil: formData.get("persentaseBagiHasil"),
    catatan: teks("catatan"),
    aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
  };
}

/** Hanya admin dan owner yang boleh mengubah data induk; kasir hanya melihat. */
async function wajibBolehKelola(): Promise<StatusAksi | null> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mengubah data pemilik." };
  }
  return null;
}

export async function simpanPemilik(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const ditolak = await wajibBolehKelola();
  if (ditolak) return ditolak;

  const idMentah = formData.get("id");
  const id = idMentah ? Number(idMentah) : null;

  const hasil = skema.safeParse(bacaForm(formData));
  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = {
    nama: hasil.data.nama,
    noHp: normalkanNoHp(hasil.data.noHp),
    alamat: hasil.data.alamat ?? null,
    persentaseBagiHasil: hasil.data.persentaseBagiHasil,
    catatan: hasil.data.catatan ?? null,
    aktif: hasil.data.aktif ?? true,
  };

  if (id) {
    await db.update(owners).set(data).where(eq(owners.id, id));
  } else {
    await db.insert(owners).values(data);
  }

  revalidatePath("/pemilik");
  revalidatePath("/sepeda");
  redirect("/pemilik");
}

export async function hapusPemilik(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  // Pemilik yang masih punya sepeda tidak dihapus, karena riwayat transaksinya
  // mengacu ke sana. Nonaktifkan saja supaya laporan lama tetap utuh.
  if (await pemilikPunyaSepeda(id)) {
    await db.update(owners).set({ aktif: false }).where(eq(owners.id, id));
  } else {
    await db.delete(owners).where(eq(owners.id, id));
  }

  revalidatePath("/pemilik");
  redirect("/pemilik");
}

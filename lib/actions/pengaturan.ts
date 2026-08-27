"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { settings, users } from "@/lib/db/schema";
import { wajibPengguna } from "@/lib/auth/dal";
import { adalahAkunDemo } from "@/lib/auth/demo";
import { cocokkanKataSandi, hashKataSandi } from "@/lib/auth/password";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

function teks(formData: FormData, kunci: string): string | undefined {
  const nilai = formData.get(kunci);
  const bersih = typeof nilai === "string" ? nilai.trim() : "";
  return bersih === "" ? undefined : bersih;
}

const skema = z.object({
  namaUsaha: z.string().trim().min(2, "Nama usaha minimal 2 huruf").max(100),
  alamat: z.string().trim().max(200).optional(),
  noHp: z.string().trim().max(20).optional(),
  batasJamRental: z.coerce
    .number({ error: "Harus berupa angka" })
    .int()
    .min(1, "Minimal 1 jam")
    .max(72, "Maksimal 72 jam"),
  toleransiBookingMenit: z.coerce
    .number({ error: "Harus berupa angka" })
    .int()
    .min(0, "Tidak boleh negatif")
    .max(24 * 60, "Maksimal 1440 menit"),
  // Dibatasi 59 menit, bukan lebih. Toleransi 60 menit ke atas akan menelan
  // seluruh sisa menit yang mungkin ada, sehingga denda keterlambatan tidak
  // akan pernah disarankan sama sekali — pengaturan yang diam-diam mematikan
  // fiturnya lebih membingungkan daripada pengaturan yang menolak diisi.
  toleransiTelatMenit: z.coerce
    .number({ error: "Harus berupa angka" })
    .int()
    .min(0, "Tidak boleh negatif")
    .max(59, "Maksimal 59 menit"),
});

export async function simpanPengaturan(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mengubah pengaturan." };
  }

  const hasil = skema.safeParse({
    namaUsaha: formData.get("namaUsaha"),
    alamat: teks(formData, "alamat"),
    noHp: teks(formData, "noHp"),
    batasJamRental: formData.get("batasJamRental"),
    toleransiBookingMenit: formData.get("toleransiBookingMenit"),
    toleransiTelatMenit: formData.get("toleransiTelatMenit"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const nilai = {
    namaUsaha: hasil.data.namaUsaha,
    alamat: hasil.data.alamat ?? null,
    noHp: hasil.data.noHp ?? null,
    batasJamRental: hasil.data.batasJamRental,
    toleransiBookingMenit: hasil.data.toleransiBookingMenit,
    toleransiTelatMenit: hasil.data.toleransiTelatMenit,
    diperbaruiPada: new Date(),
  };

  // Tabel pengaturan selalu berisi tepat satu baris dengan id 1. onConflictDoUpdate
  // membuat baris itu tercipta pada penyimpanan pertama tanpa perlu seed lebih dulu.
  await db
    .insert(settings)
    .values({ id: 1, ...nilai })
    .onConflictDoUpdate({ target: settings.id, set: nilai });

  revalidatePath("/pengaturan");
  revalidatePath("/dashboard");
  redirect("/pengaturan?tersimpan=1");
}

const skemaSandi = z
  .object({
    kataSandiLama: z.string().min(1, "Masukkan kata sandi lama"),
    kataSandiBaru: z.string().min(8, "Kata sandi baru minimal 8 karakter").max(200),
    ulangi: z.string().min(1, "Ulangi kata sandi baru"),
  })
  .refine((d) => d.kataSandiBaru === d.ulangi, {
    path: ["ulangi"],
    error: "Ulangan kata sandi tidak sama",
  })
  .refine((d) => d.kataSandiBaru !== d.kataSandiLama, {
    path: ["kataSandiBaru"],
    error: "Kata sandi baru harus berbeda dari yang lama",
  });

/** Mengganti kata sandi milik pengguna yang sedang masuk. */
export async function gantiKataSandi(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  // Kata sandi akun demo tertulis terang-terangan di README supaya siapa pun bisa
  // mencoba aplikasinya. Pengunjung pertama yang menggantinya akan mengunci semua
  // pengunjung berikutnya di luar, dan pemiliknya baru sadar setelah ada yang
  // mengeluh. Peran kasir tidak menutup ini: mengganti sandi sendiri memang hak
  // setiap pengguna yang sah.
  if (adalahAkunDemo(pengguna.username)) {
    return { galat: "Kata sandi akun demo tidak bisa diganti." };
  }

  const hasil = skemaSandi.safeParse({
    kataSandiLama: formData.get("kataSandiLama"),
    kataSandiBaru: formData.get("kataSandiBaru"),
    ulangi: formData.get("ulangi"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const [baris] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, pengguna.id))
    .limit(1);

  if (!baris || !(await cocokkanKataSandi(hasil.data.kataSandiLama, baris.passwordHash))) {
    return { galatField: { kataSandiLama: ["Kata sandi lama salah"] } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashKataSandi(hasil.data.kataSandiBaru) })
    .where(eq(users.id, pengguna.id));

  redirect("/pengaturan/akun?sandi=1");
}

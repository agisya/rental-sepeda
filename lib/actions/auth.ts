"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { cocokkanKataSandi } from "@/lib/auth/password";
import { cariAkunDemo } from "@/lib/auth/demo";
import { buatCookieSesi, hapusCookieSesi } from "@/lib/auth/session";

const skemaMasuk = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  kataSandi: z.string().min(1, "Kata sandi wajib diisi"),
  lanjut: z.string().optional(),
});

export type StatusMasuk = {
  galat?: string;
  galatField?: { username?: string[]; kataSandi?: string[] };
};

// Hash bcrypt yang sah tapi tidak akan pernah cocok. Dipakai supaya waktu
// balasan untuk username yang tidak ada mirip dengan yang ada.
const HASH_UMPAN = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.iu6iuAnbFMSPRLGqzTeQ0cE7Zvzu";

export async function masuk(
  _sebelumnya: StatusMasuk,
  formData: FormData,
): Promise<StatusMasuk> {
  const hasil = skemaMasuk.safeParse({
    username: formData.get("username"),
    kataSandi: formData.get("kataSandi"),
    lanjut: formData.get("lanjut") ?? undefined,
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const { username, kataSandi, lanjut } = hasil.data;

  let pengguna: typeof users.$inferSelect | undefined;

  try {
    [pengguna] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);
  } catch (galat) {
    // Koneksi database bisa putus karena internet mati di lokasi rental.
    // Petugas harus melihat pesan yang bisa ditindaklanjuti, bukan layar galat.
    console.error("Gagal menghubungi database saat login:", galat);
    return {
      galat:
        "Tidak bisa terhubung ke database. Periksa koneksi internet lalu coba lagi.",
    };
  }

  // Pesan galat sengaja sama untuk username salah maupun kata sandi salah,
  // supaya halaman login tidak bisa dipakai menebak username yang terdaftar.
  const pesanGagal = "Username atau kata sandi salah.";

  if (!pengguna) {
    await cocokkanKataSandi(kataSandi, HASH_UMPAN);
    return { galat: pesanGagal };
  }

  if (!pengguna.aktif) {
    return { galat: "Akun ini sudah dinonaktifkan. Hubungi admin." };
  }

  const cocok = await cocokkanKataSandi(kataSandi, pengguna.passwordHash);
  if (!cocok) {
    return { galat: pesanGagal };
  }

  await buatCookieSesi({
    userId: pengguna.id,
    username: pengguna.username,
    nama: pengguna.nama,
    peran: pengguna.peran,
  });

  // Hanya izinkan pengalihan ke rute internal, supaya parameter ?lanjut tidak
  // bisa dipakai mengarahkan pengguna ke situs lain setelah login.
  const tujuan =
    lanjut && lanjut.startsWith("/") && !lanjut.startsWith("//") ? lanjut : "/dashboard";
  redirect(tujuan);
}

/**
 * Masuk sebagai akun demo tanpa mengetik apa pun.
 *
 * Sengaja tidak menerima satu pun argumen. Username-nya dibaca dari AKUN_DEMO oleh
 * cariAkunDemo(), bukan dari formulir, sehingga tidak ada nilai dari peramban yang
 * bisa mengarahkan action ini ke akun lain. Yang dibagikan ke publik cuma tombolnya,
 * bukan kemampuan memilih akun.
 *
 * Kelayakan akunnya — ada, aktif, dan berperan kasir — diperiksa di lib/auth/demo.ts
 * supaya bisa diuji dengan Postgres sungguhan.
 */
export async function masukDemo(
  _sebelumnya: StatusMasuk,
  // Bentuk argumennya mengikuti kontrak useActionState. Isinya sengaja tidak pernah
  // dibaca — itulah yang membuat action ini tidak bisa diarahkan ke akun lain.
  _formData: FormData,
): Promise<StatusMasuk> {
  let hasil: Awaited<ReturnType<typeof cariAkunDemo>>;

  try {
    hasil = await cariAkunDemo();
  } catch (galat) {
    console.error("Gagal menghubungi database saat masuk demo:", galat);
    return {
      galat:
        "Tidak bisa terhubung ke database. Periksa koneksi internet lalu coba lagi.",
    };
  }

  if (!hasil.ada) {
    // Alasannya untuk yang memegang deployment, bukan untuk pengunjung: kalau
    // AKUN_DEMO salah tunjuk, log inilah yang menjelaskannya. Pengunjung cukup tahu
    // demonya sedang tidak bisa dipakai.
    console.error(`Tombol demo ditekan tapi akunnya tidak bisa dipakai: ${hasil.alasan}`);
    return { galat: "Akun demo sedang tidak tersedia. Coba lagi nanti." };
  }

  await buatCookieSesi({
    userId: hasil.pengguna.id,
    username: hasil.pengguna.username,
    nama: hasil.pengguna.nama,
    peran: hasil.pengguna.peran,
  });

  redirect("/dashboard");
}

export async function keluar(): Promise<void> {
  await hapusCookieSesi();
  redirect("/login");
}

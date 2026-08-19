"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { wajibPeran } from "@/lib/auth/dal";
import { buatCookieSesi } from "@/lib/auth/session";
import { peranEnum } from "@/lib/db/schema";
import {
  AdminTerakhir,
  PenggunaTidakAda,
  SistemSudahTerisi,
  UsernameDipakai,
  buatAdminPertama,
  setAktifPengguna,
  setelUlangSandi,
  tambahPengguna,
} from "@/lib/pengguna/kelola";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

/**
 * Server Action untuk pengelolaan akun.
 *
 * Berkas ini hanya berisi penjagaan dan pemeriksaan masukan; aturan yang
 * sesungguhnya ada di lib/pengguna/kelola.ts supaya bisa diuji tanpa cookie.
 *
 * Setiap action memanggil penjaganya sendiri. Dokumentasi Next menegaskan Server
 * Action bisa dipanggil lewat POST tanpa melewati navigasi halaman, jadi
 * bersembunyi di balik halaman yang sudah dijaga tidak cukup.
 */

const SANDI_MINIMAL = 8;

const skemaUsername = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(
    /^[a-z0-9._-]+$/,
    "Username hanya boleh huruf, angka, titik, garis bawah, dan tanda hubung",
  );

const skemaNama = z.string().trim().min(2, "Nama minimal 2 huruf").max(100);

const skemaSandiBaru = z
  .string()
  .min(SANDI_MINIMAL, `Kata sandi minimal ${SANDI_MINIMAL} karakter`)
  .max(200);

const skemaAdminPertama = z
  .object({
    username: skemaUsername,
    nama: skemaNama,
    kataSandi: skemaSandiBaru,
    ulangi: z.string().min(1, "Ulangi kata sandi"),
  })
  .refine((d) => d.kataSandi === d.ulangi, {
    path: ["ulangi"],
    error: "Ulangan kata sandi tidak sama",
  });

/**
 * Membuat akun admin pertama dari peramban.
 *
 * Sengaja tanpa penjaga sesi — pada sistem yang masih kosong belum ada siapa pun
 * yang bisa login untuk memberi izin. Yang menjaganya adalah keadaan tabel
 * itu sendiri: begitu ada satu pengguna, action ini menolak selamanya.
 */
export async function daftarAdminPertama(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const hasil = skemaAdminPertama.safeParse({
    username: formData.get("username"),
    nama: formData.get("nama"),
    kataSandi: formData.get("kataSandi"),
    ulangi: formData.get("ulangi"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const { username, nama, kataSandi } = hasil.data;

  let akun: { id: number };

  try {
    akun = await buatAdminPertama({ username, nama, kataSandi });
  } catch (galat) {
    if (galat instanceof SistemSudahTerisi) {
      return {
        galat: "Akun pertama sudah pernah dibuat. Silakan masuk lewat halaman login.",
      };
    }
    if (galat instanceof UsernameDipakai) {
      return { galatField: { username: ["Username sudah dipakai"] } };
    }
    console.error("Gagal membuat akun pertama:", galat);
    return {
      galat: "Tidak bisa menyimpan akun. Periksa koneksi database lalu coba lagi.",
    };
  }

  // Langsung dibuatkan sesi supaya orangnya tidak perlu mengetik ulang apa yang
  // baru saja diisi di halaman sebelumnya.
  await buatCookieSesi({
    userId: akun.id,
    username,
    nama,
    peran: "admin",
  });

  // Di luar try: redirect() bekerja dengan melempar galat khusus, jadi kalau ia
  // dipanggil di dalam try, catch di atas akan menelannya dan pengalihannya batal.
  redirect("/dashboard");
}

const skemaAnggotaBaru = z.object({
  username: skemaUsername,
  nama: skemaNama,
  peran: z.enum(peranEnum.enumValues, { error: "Peran tidak dikenali" }),
  kataSandi: skemaSandiBaru,
});

/**
 * Menambah anggota tim. Owner dan admin.
 *
 * Owner adalah pemilik usahanya sendiri — jabatan tertinggi di aplikasi ini —
 * jadi ia justru yang paling berhak menambah orang. Membatasinya ke admin saja
 * membuat pemilik usaha harus meminta tolong pegawainya untuk membuat akun.
 * Kasir tetap tidak boleh: memberi kewenangan membuat akun kepada peran
 * operasional berarti siapa pun yang memegang satu akun kasir bisa membuat
 * akun admin untuk dirinya sendiri.
 */
export async function tambahAnggota(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  await wajibPeran("admin", "owner");

  const hasil = skemaAnggotaBaru.safeParse({
    username: formData.get("username"),
    nama: formData.get("nama"),
    peran: formData.get("peran"),
    kataSandi: formData.get("kataSandi"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  try {
    await tambahPengguna(hasil.data);
  } catch (galat) {
    if (galat instanceof UsernameDipakai) {
      return { galatField: { username: ["Username sudah dipakai"] } };
    }
    console.error("Gagal menambah anggota:", galat);
    return { galat: "Tidak bisa menyimpan akun. Coba lagi." };
  }

  revalidatePath("/pengaturan/tim");

  return {
    berhasil:
      `Akun ${hasil.data.username} dibuat. Serahkan kata sandinya, ` +
      "lalu minta yang bersangkutan menggantinya sendiri di menu Pengaturan.",
  };
}

const skemaStatus = z.object({
  id: z.coerce.number({ error: "Akun tidak dikenali" }).int().positive(),
  aktif: z.enum(["0", "1"]),
});

/** Mengaktifkan atau menonaktifkan akun orang lain. Owner dan admin. */
export async function ubahStatusAnggota(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengelola = await wajibPeran("admin", "owner");

  const hasil = skemaStatus.safeParse({
    id: formData.get("id"),
    aktif: formData.get("aktif"),
  });

  if (!hasil.success) {
    return { galat: "Akun yang dimaksud tidak dikenali." };
  }

  const { id, aktif } = hasil.data;
  const jadikanAktif = aktif === "1";

  // Menonaktifkan diri sendiri langsung mengunci orang itu keluar pada permintaan
  // berikutnya, karena lib/auth/dal.ts memeriksa kolom aktif setiap kali.
  if (!jadikanAktif && id === pengelola.id) {
    return { galat: "Anda tidak bisa menonaktifkan akun Anda sendiri." };
  }

  try {
    await setAktifPengguna(id, jadikanAktif);
  } catch (galat) {
    if (galat instanceof AdminTerakhir) {
      return {
        galat:
          "Ini admin aktif terakhir. Angkat admin lain lebih dulu, " +
          "supaya aplikasi tidak terkunci dari semua orang.",
      };
    }
    if (galat instanceof PenggunaTidakAda) {
      return { galat: "Akun itu sudah tidak ada." };
    }
    console.error("Gagal mengubah status anggota:", galat);
    return { galat: "Tidak bisa mengubah status akun. Coba lagi." };
  }

  revalidatePath("/pengaturan/tim");

  return {
    berhasil: jadikanAktif ? "Akun diaktifkan kembali." : "Akun dinonaktifkan.",
  };
}

const skemaSetelUlang = z.object({
  id: z.coerce.number({ error: "Akun tidak dikenali" }).int().positive(),
  kataSandi: skemaSandiBaru,
});

/** Menyetel ulang kata sandi anggota yang lupa. Owner dan admin. */
export async function setelUlangSandiAnggota(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  await wajibPeran("admin", "owner");

  const hasil = skemaSetelUlang.safeParse({
    id: formData.get("id"),
    kataSandi: formData.get("kataSandi"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  try {
    await setelUlangSandi(hasil.data.id, hasil.data.kataSandi);
  } catch (galat) {
    if (galat instanceof PenggunaTidakAda) {
      return { galat: "Akun itu sudah tidak ada." };
    }
    console.error("Gagal menyetel ulang kata sandi:", galat);
    return { galat: "Tidak bisa mengganti kata sandi. Coba lagi." };
  }

  revalidatePath("/pengaturan/tim");

  return { berhasil: "Kata sandi disetel ulang. Serahkan yang baru kepada pemilik akun." };
}

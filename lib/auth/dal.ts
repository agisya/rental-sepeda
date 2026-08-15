import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type Peran } from "@/lib/db/schema";
import { bacaSesi, type IsiSesi } from "./session";

/**
 * Lapisan otorisasi yang sesungguhnya.
 *
 * proxy.ts hanya melakukan pengalihan optimistik dari cookie. Dokumentasi Next
 * menegaskan Server Action bisa dipanggil langsung lewat POST tanpa melewati
 * navigasi halaman, jadi setiap halaman dan setiap action wajib memanggil
 * verifikasi di sini.
 *
 * Dibungkus React cache() supaya satu render hanya menghasilkan satu query,
 * berapa pun banyaknya komponen yang menanyakan pengguna aktif.
 */

export const ambilSesi = cache(async (): Promise<IsiSesi | null> => {
  return bacaSesi();
});

/** Wajib login. Mengalihkan ke /login kalau tidak ada sesi yang sah. */
export const wajibSesi = cache(async (): Promise<IsiSesi> => {
  const sesi = await ambilSesi();
  if (!sesi) redirect("/login");
  return sesi;
});

export type PenggunaAktif = {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
};

/**
 * Memuat pengguna dari database, bukan sekadar percaya isi cookie. Ini yang
 * membuat akun yang dinonaktifkan atau dihapus langsung kehilangan akses
 * walaupun cookie lamanya masih berlaku.
 */
export const wajibPengguna = cache(async (): Promise<PenggunaAktif> => {
  const sesi = await wajibSesi();

  const [pengguna] = await db
    .select({
      id: users.id,
      username: users.username,
      nama: users.nama,
      peran: users.peran,
      aktif: users.aktif,
    })
    .from(users)
    .where(eq(users.id, sesi.userId))
    .limit(1);

  if (!pengguna || !pengguna.aktif) redirect("/login");

  // Kolom "aktif" sengaja tidak ikut dikembalikan; ia hanya dipakai untuk
  // memutuskan akses, bukan untuk ditampilkan.
  return {
    id: pengguna.id,
    username: pengguna.username,
    nama: pengguna.nama,
    peran: pengguna.peran,
  };
});

/** Hanya peran tertentu yang boleh lewat. Dipakai untuk menu keuangan dan pengaturan. */
export async function wajibPeran(...peranDiizinkan: Peran[]): Promise<PenggunaAktif> {
  const pengguna = await wajibPengguna();
  if (!peranDiizinkan.includes(pengguna.peran)) redirect("/dashboard");
  return pengguna;
}

/** Kasir boleh operasional harian; admin dan owner juga boleh. */
export function bolehKelolaDataInduk(peran: Peran): boolean {
  return peran === "admin" || peran === "owner";
}

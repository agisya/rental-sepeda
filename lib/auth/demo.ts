import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type Peran } from "@/lib/db/schema";

/**
 * Akun demo untuk portofolio.
 *
 * Tombol "Coba demo" di halaman login memasukkan pengunjung tanpa mengetik apa pun.
 * Karena pintunya terbuka bagi siapa saja, akun yang dituju diperiksa di sini lebih
 * dulu — dan pemeriksaannya sengaja tidak menerima masukan apa pun dari peramban.
 * Namanya hanya boleh datang dari AKUN_DEMO, yang disetel orang yang memegang
 * deployment.
 *
 * Dipisah dari lib/actions/auth.ts dengan alasan yang sama seperti
 * lib/pengguna/kelola.ts: Server Action memanggil buatCookieSesi() yang membaca
 * next/headers, sehingga tidak bisa dijalankan di luar Next dan tidak bisa diuji
 * apa adanya. Aturan yang berbahaya kalau salah ditaruh di modul yang bisa diuji
 * dengan Postgres sungguhan.
 *
 * Fitur ini mati total selama AKUN_DEMO tidak disetel, jadi pengembangan lokal dan
 * deployment Dokploy tidak punya tombol demo dan tidak punya jalan masuk tambahan.
 */

export type PenggunaDemo = {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
};

export type HasilAkunDemo =
  | { ada: true; pengguna: PenggunaDemo }
  | {
      ada: false;
      /** Dipakai untuk mencatat di log kenapa tombol demo tidak berfungsi. */
      alasan: "tidak-disetel" | "tidak-ada" | "nonaktif" | "bukan-kasir";
    };

/**
 * Username akun demo, atau null kalau fiturnya tidak dinyalakan.
 *
 * Dikecilkan hurufnya karena login mencari username yang sudah dikecilkan; nilai
 * bertengger huruf besar di dashboard akan menghasilkan "akun tidak ada" yang
 * membingungkan. Variabel yang berisi spasi diperlakukan sama dengan tidak disetel,
 * supaya salah tempel tidak menyalakan tombol yang menunjuk ke akun kosong.
 */
export function namaAkunDemo(): string | null {
  const nilai = process.env.AKUN_DEMO?.trim().toLowerCase();
  return nilai ? nilai : null;
}

/** Benar hanya untuk akun yang disebut AKUN_DEMO. */
export function adalahAkunDemo(username: string): boolean {
  const demo = namaAkunDemo();
  return demo !== null && username.trim().toLowerCase() === demo;
}

/**
 * Mencari akun demo dan memastikan ia aman dipakai masuk tanpa kata sandi.
 *
 * Peran wajib kasir, dan itu bukan formalitas: peran kasir adalah satu-satunya hal
 * yang menghalangi pengunjung menghapus sepeda, mengubah pengaturan usaha, dan
 * membuka menu keuangan — pemeriksaannya sudah ada di setiap action terkait.
 * AKUN_DEMO yang salah tunjuk ke akun admin akan membagikan kendali penuh lewat
 * tombol publik, jadi peranlah yang diperiksa, bukan sekadar diasumsikan benar
 * saat akunnya dibuat.
 */
export async function cariAkunDemo(): Promise<HasilAkunDemo> {
  const nama = namaAkunDemo();
  if (!nama) return { ada: false, alasan: "tidak-disetel" };

  const [pengguna] = await db
    .select({
      id: users.id,
      username: users.username,
      nama: users.nama,
      peran: users.peran,
      aktif: users.aktif,
    })
    .from(users)
    .where(eq(users.username, nama))
    .limit(1);

  if (!pengguna) return { ada: false, alasan: "tidak-ada" };
  if (!pengguna.aktif) return { ada: false, alasan: "nonaktif" };
  if (pengguna.peran !== "kasir") return { ada: false, alasan: "bukan-kasir" };

  return {
    ada: true,
    pengguna: {
      id: pengguna.id,
      username: pengguna.username,
      nama: pengguna.nama,
      peran: pengguna.peran,
    },
  };
}

import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type Peran } from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { hashKataSandi } from "@/lib/auth/password";

/**
 * Pengelolaan akun aplikasi.
 *
 * Dipisah dari lib/actions/pengguna.ts dengan sengaja. Action harus memanggil
 * wajibPeran() yang membaca cookie, sehingga tidak bisa dijalankan di luar Next
 * dan tidak bisa diuji apa adanya. Aturan yang paling berbahaya kalau salah ada
 * di sini, jadi ia bisa diuji dengan Postgres sungguhan lewat test/db-uji.ts.
 */

/** Akun pertama sudah pernah dibuat; pintu bootstrap sudah tertutup. */
export class SistemSudahTerisi extends Error {}

/** Username sudah dipakai akun lain. */
export class UsernameDipakai extends Error {}

/** Menonaktifkan akun ini akan menyisakan nol admin aktif. */
export class AdminTerakhir extends Error {}

export class PenggunaTidakAda extends Error {}

export type PenggunaBaru = {
  username: string;
  nama: string;
  peran: Peran;
  kataSandi: string;
};

export type RingkasanPengguna = {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
  aktif: boolean;
  dibuatPada: Date;
};

/**
 * Login mencari username yang sudah dikecilkan huruf. Kalau baris tersimpan
 * dengan huruf besar, akunnya tidak akan pernah bisa dipakai masuk — dan
 * galatnya muncul sebagai "username atau kata sandi salah", yang menyesatkan.
 */
function normalkanUsername(nilai: string): string {
  return nilai.trim().toLowerCase();
}

export async function hitungPengguna(): Promise<number> {
  const [baris] = await db.select({ jumlah: count() }).from(users);
  return Number(baris?.jumlah ?? 0);
}

export async function sistemKosong(): Promise<boolean> {
  return (await hitungPengguna()) === 0;
}

export async function daftarPengguna(): Promise<RingkasanPengguna[]> {
  // Kolom passwordHash sengaja tidak ikut. Daftar ini berakhir di komponen yang
  // dirender untuk peramban, dan hash tidak punya alasan untuk sampai ke sana.
  return db
    .select({
      id: users.id,
      username: users.username,
      nama: users.nama,
      peran: users.peran,
      aktif: users.aktif,
      dibuatPada: users.dibuatPada,
    })
    .from(users)
    .orderBy(asc(users.username));
}

export async function tambahPengguna(baru: PenggunaBaru): Promise<{ id: number }> {
  const passwordHash = await hashKataSandi(baru.kataSandi);

  try {
    const [akun] = await db
      .insert(users)
      .values({
        username: normalkanUsername(baru.username),
        nama: baru.nama.trim(),
        peran: baru.peran,
        passwordHash,
      })
      .returning({ id: users.id });

    return akun;
  } catch (galat) {
    // Indeks unik pada username yang memutuskan, bukan pemeriksaan terpisah
    // sebelum menyisipkan. Pemeriksaan lebih dulu selalu punya celah waktu di
    // antara "sudah dicek" dan "sudah disisipkan".
    if (pelanggaranUnik(galat)) {
      throw new UsernameDipakai(`Username "${normalkanUsername(baru.username)}" sudah dipakai.`);
    }
    throw galat;
  }
}

/**
 * Membuat akun admin pertama, dan hanya kalau belum ada pengguna sama sekali.
 *
 * Ini yang menggantikan keharusan menjalankan `npm run db:seed` dari laptop atau
 * menyisipkan baris lewat terminal Postgres pada setiap deploy baru.
 *
 * Kata sandi di-hash sebelum transaksi dibuka: bcrypt sengaja lambat, dan
 * menahan kunci tabel selama itu akan memblokir permintaan lain tanpa alasan.
 */
export async function buatAdminPertama(baru: {
  username: string;
  nama: string;
  kataSandi: string;
}): Promise<{ id: number }> {
  const passwordHash = await hashKataSandi(baru.kataSandi);

  return db.transaction(async (tx) => {
    // Tanpa kunci ini, dua permintaan yang datang bersamaan bisa sama-sama
    // melihat tabel kosong dan sama-sama membuat admin. Pada isolasi bawaan
    // Postgres, membaca jumlah baris saja tidak menghalangi yang lain menyisip.
    await tx.execute(sql`lock table ${users} in exclusive mode`);

    const [baris] = await tx.select({ jumlah: count() }).from(users);
    if (Number(baris?.jumlah ?? 0) > 0) {
      throw new SistemSudahTerisi("Sudah ada akun di sistem ini.");
    }

    const [akun] = await tx
      .insert(users)
      .values({
        username: normalkanUsername(baru.username),
        nama: baru.nama.trim(),
        peran: "admin",
        passwordHash,
      })
      .returning({ id: users.id });

    return akun;
  });
}

/**
 * Mengaktifkan atau menonaktifkan akun.
 *
 * Menonaktifkan langsung mencabut akses walau cookie lamanya masih berlaku,
 * karena lib/auth/dal.ts memuat kolom aktif dari database pada setiap permintaan.
 */
export async function setAktifPengguna(id: number, aktif: boolean): Promise<void> {
  if (aktif) {
    const hasil = await db
      .update(users)
      .set({ aktif: true })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (hasil.length === 0) throw new PenggunaTidakAda("Pengguna tidak ditemukan.");
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${users} in exclusive mode`);

    const [target] = await tx
      .select({ peran: users.peran, aktif: users.aktif })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) throw new PenggunaTidakAda("Pengguna tidak ditemukan.");

    if (target.peran === "admin" && target.aktif) {
      const [sisa] = await tx
        .select({ jumlah: count() })
        .from(users)
        .where(and(eq(users.peran, "admin"), eq(users.aktif, true), ne(users.id, id)));

      // Nol admin aktif berarti tidak ada lagi yang bisa mengelola akun, dan
      // pemulihannya hanya lewat SQL langsung ke database produksi.
      if (Number(sisa?.jumlah ?? 0) === 0) {
        throw new AdminTerakhir("Ini admin aktif terakhir; harus ada minimal satu.");
      }
    }

    await tx.update(users).set({ aktif: false }).where(eq(users.id, id));
  });
}

/**
 * Menyetel ulang kata sandi orang lain. Dipakai admin ketika petugas lupa
 * sandinya — tanpa alamat email, tidak ada jalur pemulihan mandiri.
 */
export async function setelUlangSandi(id: number, kataSandiBaru: string): Promise<void> {
  const passwordHash = await hashKataSandi(kataSandiBaru);

  const hasil = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (hasil.length === 0) throw new PenggunaTidakAda("Pengguna tidak ditemukan.");
}

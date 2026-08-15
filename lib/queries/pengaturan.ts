import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, type Settings } from "@/lib/db/schema";

export const PENGATURAN_BAWAAN: Omit<Settings, "diperbaruiPada"> = {
  id: 1,
  namaUsaha: "Rental Sepeda Garut",
  alamat: null,
  noHp: null,
  batasJamRental: 12,
  toleransiBookingMenit: 60,
};

/**
 * Pengaturan aplikasi. Selalu satu baris dengan id 1.
 *
 * Kalau barisnya belum ada — misalnya database baru dibuat dan seed belum
 * dijalankan — nilai bawaan dikembalikan supaya aplikasi tetap bisa dipakai
 * dan tidak ada halaman yang gagal dimuat.
 *
 * Dibungkus React cache() supaya satu render hanya menghasilkan satu query,
 * berapa pun banyaknya bagian halaman yang membutuhkannya.
 */
export const ambilPengaturan = cache(async (): Promise<Settings> => {
  const [baris] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return baris ?? { ...PENGATURAN_BAWAAN, diperbaruiPada: new Date() };
});

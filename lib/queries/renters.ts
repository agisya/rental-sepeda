import "server-only";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { renters, rentals } from "@/lib/db/schema";
import { normalkanNoHp } from "@/lib/format";

export type PenyewaRingkas = {
  id: number;
  nama: string;
  noHp: string;
  catatan: string | null;
  jumlahRental: number;
  totalBelanja: number;
  terakhirRental: Date | null;
  sedangMenyewa: number;
};

export async function daftarPenyewa(cari?: string): Promise<PenyewaRingkas[]> {
  const syarat = [];

  if (cari?.trim()) {
    const pola = `%${cari.trim().toLowerCase()}%`;
    syarat.push(
      or(sql`lower(${renters.nama}) like ${pola}`, sql`${renters.noHp} like ${pola}`),
    );
  }

  return db
    .select({
      id: renters.id,
      nama: renters.nama,
      noHp: renters.noHp,
      catatan: renters.catatan,
      // Tanda kurung mengelilingi seluruh agregat sebelum ::int — tanpa itu
      // Postgres tidak menerima cast yang langsung menempel pada klausa FILTER.
      jumlahRental: sql<number>`(count(${rentals.id}) filter (where ${rentals.status} = 'selesai'))::int`,
      totalBelanja: sql<number>`coalesce((sum(${rentals.totalBiaya}) filter (where ${rentals.status} = 'selesai'))::int, 0)`,
      terakhirRental: sql<Date | null>`max(${rentals.waktuMulai})`,
      sedangMenyewa: sql<number>`(count(${rentals.id}) filter (where ${rentals.status} = 'berjalan'))::int`,
    })
    .from(renters)
    .leftJoin(rentals, eq(rentals.renterId, renters.id))
    .where(syarat.length ? and(...syarat) : undefined)
    .groupBy(renters.id)
    // DESC di Postgres menaruh NULL paling depan. Penyewa yang belum punya
    // riwayat harus di bawah, bukan di puncak daftar.
    .orderBy(sql`max(${rentals.waktuMulai}) desc nulls last`, desc(renters.dibuatPada))
    .limit(200);
}

export async function penyewaByNoHp(noHp: string) {
  const [hasil] = await db
    .select()
    .from(renters)
    .where(eq(renters.noHp, normalkanNoHp(noHp)))
    .limit(1);

  return hasil ?? null;
}

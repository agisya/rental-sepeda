import "server-only";

import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes, maintenances, owners, rentals, users } from "@/lib/db/schema";
import type { JenisMaintenance } from "@/lib/db/schema";
import type { Rentang } from "./laporan";

export const LABEL_JENIS: Record<JenisMaintenance, string> = {
  servis: "Servis",
  sparepart: "Ganti sparepart",
  lainnya: "Lainnya",
};

export async function daftarMaintenance(filter: {
  bikeId?: number;
  rentang?: Rentang;
  batas?: number;
}) {
  const syarat = [];
  if (filter.bikeId) syarat.push(eq(maintenances.bikeId, filter.bikeId));
  if (filter.rentang) {
    syarat.push(gte(maintenances.tanggal, filter.rentang.mulai));
    syarat.push(lt(maintenances.tanggal, filter.rentang.selesai));
  }

  return db
    .select({
      id: maintenances.id,
      bikeId: maintenances.bikeId,
      kodeSepeda: bikes.kode,
      namaSepeda: bikes.nama,
      namaPemilik: owners.nama,
      tanggal: maintenances.tanggal,
      jenis: maintenances.jenis,
      deskripsi: maintenances.deskripsi,
      biaya: maintenances.biaya,
      jamPakai: maintenances.jamPakai,
      tanggalServisBerikutnya: maintenances.tanggalServisBerikutnya,
      mekanik: maintenances.mekanik,
      catatan: maintenances.catatan,
      namaPetugas: users.nama,
    })
    .from(maintenances)
    .innerJoin(bikes, eq(maintenances.bikeId, bikes.id))
    .innerJoin(owners, eq(bikes.ownerId, owners.id))
    .innerJoin(users, eq(maintenances.dicatatOleh, users.id))
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(desc(maintenances.tanggal), desc(maintenances.id))
    .limit(filter.batas ?? 200);
}

export async function maintenanceById(id: number) {
  const [hasil] = await daftarMaintenance({ batas: 1 }).then((semua) =>
    semua.filter((m) => m.id === id),
  );
  return hasil ?? null;
}

/**
 * Total jam pakai sebuah sepeda sepanjang masa.
 *
 * Dipakai sebagai pengganti kilometer pada catatan servis: sepeda rental tidak
 * punya odometer, tapi jam pakainya tercatat rapi di setiap transaksi.
 */
export async function totalJamPakaiSepeda(bikeId: number): Promise<number> {
  const [hasil] = await db
    .select({ jam: sql<number>`coalesce(sum(${rentals.durasiJamDitagih}), 0)::int` })
    .from(rentals)
    .where(and(eq(rentals.bikeId, bikeId), eq(rentals.status, "selesai")));

  return hasil?.jam ?? 0;
}

/**
 * Sepeda yang jadwal servis berikutnya sudah tiba atau terlewat.
 *
 * Hanya catatan servis terakhir tiap sepeda yang diperhitungkan; jadwal dari
 * catatan lama sudah digantikan oleh yang lebih baru.
 */
export async function servisJatuhTempo(sekarang: Date = new Date()) {
  const hariIni = sekarang.toISOString().slice(0, 10);

  return db
    .select({
      bikeId: bikes.id,
      kodeSepeda: bikes.kode,
      namaSepeda: bikes.nama,
      statusSepeda: bikes.status,
      tanggalServisBerikutnya: maintenances.tanggalServisBerikutnya,
      deskripsiTerakhir: maintenances.deskripsi,
    })
    .from(maintenances)
    .innerJoin(bikes, eq(maintenances.bikeId, bikes.id))
    .where(
      and(
        sql`${maintenances.tanggalServisBerikutnya} is not null`,
        sql`${maintenances.tanggalServisBerikutnya} <= ${hariIni}`,
        // Hanya catatan terbaru per sepeda.
        sql`${maintenances.id} = (
          select m2.id from maintenances m2
          where m2.bike_id = ${maintenances.bikeId}
          order by m2.tanggal desc, m2.id desc
          limit 1
        )`,
      ),
    )
    .orderBy(asc(maintenances.tanggalServisBerikutnya));
}

export async function ringkasanMaintenance(rentang: Rentang) {
  const [hasil] = await db
    .select({
      jumlah: sql<number>`count(*)::int`,
      totalBiaya: sql<number>`coalesce(sum(${maintenances.biaya}), 0)::int`,
      sepedaDiservis: sql<number>`count(distinct ${maintenances.bikeId})::int`,
    })
    .from(maintenances)
    .where(
      and(gte(maintenances.tanggal, rentang.mulai), lt(maintenances.tanggal, rentang.selesai)),
    );

  return hasil ?? { jumlah: 0, totalBiaya: 0, sepedaDiservis: 0 };
}

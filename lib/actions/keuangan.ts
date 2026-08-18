"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { expenses, ownerPayments } from "@/lib/db/schema";
import { wajibPengguna } from "@/lib/auth/dal";
import { dariKunciTanggalWib } from "@/lib/waktu";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

function segarkan() {
  revalidatePath("/pengeluaran");
  revalidatePath("/laba-rugi");
  revalidatePath("/laporan/pemilik");
  revalidatePath("/pemilik");
  revalidatePath("/dashboard");
}

function teks(formData: FormData, kunci: string): string | undefined {
  const nilai = formData.get(kunci);
  const bersih = typeof nilai === "string" ? nilai.trim() : "";
  return bersih === "" ? undefined : bersih;
}

// --- Pengeluaran ------------------------------------------------------------

const skemaPengeluaran = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  kategori: z.enum([
    "gaji",
    "listrik",
    "pdam",
    "maintenance",
    "sparepart",
    "operasional",
    "lainnya",
  ]),
  keterangan: z.string().trim().min(3, "Tulis keterangan pengeluaran").max(300),
  jumlah: z.coerce
    .number({ error: "Jumlah harus berupa angka" })
    .int("Jumlah harus rupiah bulat")
    .min(1, "Jumlah harus lebih dari nol")
    .max(1_000_000_000),
  // Laba/rugi tidak peduli caranya dibayar, tapi penutupan kas peduli sekali:
  // hanya yang tunai yang mengurangi uang di laci.
  metode: z.enum(["tunai", "qris", "transfer"], { error: "Pilih metode pembayaran" }),
});

export async function simpanPengeluaran(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mencatat pengeluaran." };
  }

  const hasil = skemaPengeluaran.safeParse({
    tanggal: formData.get("tanggal"),
    kategori: formData.get("kategori"),
    keterangan: formData.get("keterangan"),
    jumlah: formData.get("jumlah"),
    metode: formData.get("metode"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const tanggal = dariKunciTanggalWib(hasil.data.tanggal);
  if (!tanggal) return { galatField: { tanggal: ["Tanggal tidak valid"] } };

  await db.insert(expenses).values({
    tanggal,
    kategori: hasil.data.kategori,
    keterangan: hasil.data.keterangan,
    jumlah: hasil.data.jumlah,
    metode: hasil.data.metode,
    dicatatOleh: pengguna.id,
  });

  segarkan();
  redirect("/pengeluaran");
}

export async function hapusPengeluaran(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [baris] = await db
    .select({ maintenanceId: expenses.maintenanceId })
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);

  // Pengeluaran yang lahir dari catatan maintenance hanya boleh dihapus lewat
  // catatan maintenance-nya, supaya keduanya tidak pernah berbeda isi.
  if (baris?.maintenanceId) {
    redirect("/maintenance");
  }

  await db.delete(expenses).where(eq(expenses.id, id));

  segarkan();
  redirect("/pengeluaran");
}

// --- Pembayaran bagi hasil ke pemilik ---------------------------------------

const skemaPembayaran = z.object({
  ownerId: z.coerce.number().int().positive("Pilih pemilik"),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  jumlah: z.coerce
    .number({ error: "Jumlah harus berupa angka" })
    .int("Jumlah harus rupiah bulat")
    .min(1, "Jumlah harus lebih dari nol")
    .max(1_000_000_000),
  metode: z.enum(["tunai", "qris", "transfer"]),
  catatan: z.string().trim().max(300).optional(),
});

export async function catatPembayaranPemilik(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mencatat pembayaran ke pemilik." };
  }

  const hasil = skemaPembayaran.safeParse({
    ownerId: formData.get("ownerId"),
    tanggal: formData.get("tanggal"),
    jumlah: formData.get("jumlah"),
    metode: formData.get("metode"),
    catatan: teks(formData, "catatan"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;
  const tanggal = dariKunciTanggalWib(data.tanggal);
  if (!tanggal) return { galatField: { tanggal: ["Tanggal tidak valid"] } };

  // Setoran tidak boleh melebihi hak pemilik, karena saldo negatif berarti
  // rental menuntut uang kembali dan itu tidak punya arti di laporan.
  const [hak] = await db
    .select({
      totalHak: sql<number>`coalesce((
        select sum(r.bagian_pemilik) from rentals r
        where r.owner_id_snapshot = ${data.ownerId} and r.status = 'selesai'
      ), 0)::int`,
      sudahDibayar: sql<number>`coalesce((
        select sum(p.jumlah) from owner_payments p where p.owner_id = ${data.ownerId}
      ), 0)::int`,
    })
    .from(sql`(select 1) as x`);

  const sisa = (hak?.totalHak ?? 0) - (hak?.sudahDibayar ?? 0);
  if (data.jumlah > sisa) {
    return {
      galatField: {
        jumlah: [
          `Melebihi sisa yang harus dibayar. Sisa saat ini Rp${sisa.toLocaleString("id-ID")}.`,
        ],
      },
    };
  }

  await db.insert(ownerPayments).values({
    ownerId: data.ownerId,
    tanggal,
    jumlah: data.jumlah,
    metode: data.metode,
    catatan: data.catatan ?? null,
    dicatatOleh: pengguna.id,
  });

  segarkan();
  redirect(`/laporan/pemilik?pemilik=${data.ownerId}&tersimpan=1`);
}

export async function hapusPembayaranPemilik(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran !== "admin" && pengguna.peran !== "owner") return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(ownerPayments).where(eq(ownerPayments.id, id));

  segarkan();
  redirect("/laporan/pemilik");
}

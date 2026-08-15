"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bikes, expenses, maintenances } from "@/lib/db/schema";
import { wajibPengguna } from "@/lib/auth/dal";
import { dariKunciTanggalWib } from "@/lib/waktu";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

function segarkan() {
  revalidatePath("/maintenance");
  revalidatePath("/sepeda");
  revalidatePath("/pengeluaran");
  revalidatePath("/laba-rugi");
  revalidatePath("/dashboard");
}

function teks(formData: FormData, kunci: string): string | undefined {
  const nilai = formData.get(kunci);
  const bersih = typeof nilai === "string" ? nilai.trim() : "";
  return bersih === "" ? undefined : bersih;
}

const skema = z.object({
  bikeId: z.coerce.number().int().positive("Pilih sepeda"),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  jenis: z.enum(["servis", "sparepart", "lainnya"]),
  deskripsi: z.string().trim().min(3, "Tulis pekerjaan yang dilakukan").max(300),
  biaya: z.coerce
    .number({ error: "Biaya harus berupa angka" })
    .int("Biaya harus rupiah bulat")
    .min(0, "Biaya tidak boleh negatif")
    .max(1_000_000_000),
  jamPakai: z.coerce.number().int().min(0).max(1_000_000).optional(),
  tanggalServisBerikutnya: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
    .optional(),
  mekanik: z.string().trim().max(100).optional(),
  catatan: z.string().trim().max(500).optional(),
  tandaiServis: z.boolean().optional(),
  catatKePengeluaran: z.boolean().optional(),
});

export async function simpanMaintenance(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mencatat maintenance." };
  }

  const hasil = skema.safeParse({
    bikeId: formData.get("bikeId"),
    tanggal: formData.get("tanggal"),
    jenis: formData.get("jenis"),
    deskripsi: formData.get("deskripsi"),
    biaya: formData.get("biaya"),
    jamPakai: teks(formData, "jamPakai"),
    tanggalServisBerikutnya: teks(formData, "tanggalServisBerikutnya"),
    mekanik: teks(formData, "mekanik"),
    catatan: teks(formData, "catatan"),
    tandaiServis: formData.get("tandaiServis") === "on",
    catatKePengeluaran: formData.get("catatKePengeluaran") === "on",
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;
  const tanggal = dariKunciTanggalWib(data.tanggal);
  if (!tanggal) return { galatField: { tanggal: ["Tanggal tidak valid"] } };

  await db.transaction(async (tx) => {
    const [baru] = await tx
      .insert(maintenances)
      .values({
        bikeId: data.bikeId,
        tanggal,
        jenis: data.jenis,
        deskripsi: data.deskripsi,
        biaya: data.biaya,
        jamPakai: data.jamPakai ?? null,
        tanggalServisBerikutnya: data.tanggalServisBerikutnya ?? null,
        mekanik: data.mekanik ?? null,
        catatan: data.catatan ?? null,
        dicatatOleh: pengguna.id,
      })
      .returning({ id: maintenances.id });

    // Biaya servis hanya boleh muncul sekali di laba/rugi. Tabel pengeluaran
    // adalah satu-satunya sumber angka pengeluaran; biaya di tabel maintenance
    // tidak pernah ikut dijumlah, hanya ditampilkan sebagai riwayat.
    if (data.catatKePengeluaran && data.biaya > 0) {
      await tx.insert(expenses).values({
        tanggal,
        kategori: data.jenis === "sparepart" ? "sparepart" : "maintenance",
        keterangan: data.deskripsi,
        jumlah: data.biaya,
        maintenanceId: baru.id,
        dicatatOleh: pengguna.id,
      });
    }

    // Sepeda yang sedang disewa tidak boleh dipindah ke status servis, karena
    // rental yang berjalan akan menggantung tanpa jalan keluar.
    if (data.tandaiServis) {
      const [sepeda] = await tx
        .select({ status: bikes.status })
        .from(bikes)
        .where(eq(bikes.id, data.bikeId))
        .limit(1);

      if (sepeda && sepeda.status !== "disewa") {
        await tx.update(bikes).set({ status: "servis" }).where(eq(bikes.id, data.bikeId));
      }
    }
  });

  segarkan();
  redirect("/maintenance");
}

export async function hapusMaintenance(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  // Pengeluaran yang lahir dari catatan ini ikut terhapus lewat ON DELETE CASCADE,
  // sehingga laba/rugi tidak menyimpan biaya untuk servis yang sudah dibatalkan.
  await db.delete(maintenances).where(eq(maintenances.id, id));

  segarkan();
  redirect("/maintenance");
}

/** Mengembalikan sepeda dari status servis menjadi tersedia. */
export async function selesaikanServis(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") return;

  const bikeId = Number(formData.get("bikeId"));
  if (!Number.isInteger(bikeId) || bikeId <= 0) return;

  await db
    .update(bikes)
    .set({ status: "tersedia" })
    .where(eq(bikes.id, bikeId));

  segarkan();
  redirect("/maintenance");
}

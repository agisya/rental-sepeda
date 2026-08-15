"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bikes, owners, renters, rentals } from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { wajibPengguna } from "@/lib/auth/dal";
import { hitungBiaya } from "@/lib/rental/pricing";
import { normalkanNoHp } from "@/lib/format";

export type StatusAksi = {
  galat?: string;
  berhasil?: string;
  galatField?: Record<string, string[] | undefined>;
};

function segarkanHalamanTerkait() {
  revalidatePath("/dashboard");
  revalidatePath("/scan");
  revalidatePath("/transaksi");
  revalidatePath("/sepeda");
  revalidatePath("/laporan/harian");
}

// --- Mulai rental -----------------------------------------------------------

const skemaMulai = z.object({
  bikeId: z.coerce.number().int().positive("Sepeda tidak dikenali"),
  namaPenyewa: z.string().trim().min(2, "Nama penyewa minimal 2 huruf").max(100),
  noHp: z
    .string()
    .trim()
    .min(8, "Nomor HP minimal 8 angka")
    .max(20)
    .refine((v) => /^[\d+\s-]+$/.test(v), "Nomor HP hanya boleh berisi angka"),
  estimasiJam: z.coerce.number().int().min(1).max(72).optional(),
  metodeBayar: z.enum(["tunai", "qris", "transfer"]).optional(),
  jaminan: z.string().trim().max(200).optional(),
  catatan: z.string().trim().max(500).optional(),
});

function kosongJadiUndefined(nilai: FormDataEntryValue | null): string | undefined {
  const teks = typeof nilai === "string" ? nilai.trim() : "";
  return teks === "" ? undefined : teks;
}

export async function mulaiRental(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaMulai.safeParse({
    bikeId: formData.get("bikeId"),
    namaPenyewa: formData.get("namaPenyewa"),
    noHp: formData.get("noHp"),
    estimasiJam: kosongJadiUndefined(formData.get("estimasiJam")),
    metodeBayar: kosongJadiUndefined(formData.get("metodeBayar")),
    jaminan: kosongJadiUndefined(formData.get("jaminan")),
    catatan: kosongJadiUndefined(formData.get("catatan")),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;
  const noHp = normalkanNoHp(data.noHp);
  let kodeSepeda: string;

  try {
    kodeSepeda = await db.transaction(async (tx) => {
      const [sepeda] = await tx
        .select({
          id: bikes.id,
          kode: bikes.kode,
          nama: bikes.nama,
          status: bikes.status,
          tarifPerJam: bikes.tarifPerJam,
          ownerId: bikes.ownerId,
          persentasePemilik: owners.persentaseBagiHasil,
        })
        .from(bikes)
        .innerJoin(owners, eq(bikes.ownerId, owners.id))
        .where(eq(bikes.id, data.bikeId))
        // Kunci hanya baris sepedanya. Tanpa "of", Postgres ikut mengunci baris
        // pemilik sehingga dua sepeda milik orang yang sama tidak bisa dimulai
        // bersamaan.
        .for("update", { of: bikes })
        .limit(1);

      if (!sepeda) throw new GagalRental("Sepeda tidak ditemukan.");

      if (sepeda.status !== "tersedia") {
        throw new GagalRental(
          `Sepeda ${sepeda.kode} sedang berstatus "${sepeda.status}" dan belum bisa disewakan.`,
        );
      }

      // Penyewa dikenali dari nomor HP supaya pelanggan lama tidak terdata ganda.
      const [penyewaLama] = await tx
        .select({ id: renters.id })
        .from(renters)
        .where(eq(renters.noHp, noHp))
        .limit(1);

      let renterId: number;
      if (penyewaLama) {
        renterId = penyewaLama.id;
        await tx
          .update(renters)
          .set({ nama: data.namaPenyewa })
          .where(eq(renters.id, renterId));
      } else {
        const [baru] = await tx
          .insert(renters)
          .values({ nama: data.namaPenyewa, noHp })
          .returning({ id: renters.id });
        renterId = baru.id;
      }

      await tx.insert(rentals).values({
        bikeId: sepeda.id,
        renterId,
        kasirId: pengguna.id,
        // Nilai disalin sekarang; perubahan tarif atau persentase nanti tidak
        // akan mengubah transaksi ini.
        ownerIdSnapshot: sepeda.ownerId,
        tarifPerJamSnapshot: sepeda.tarifPerJam,
        persentasePemilikSnapshot: sepeda.persentasePemilik,
        waktuMulai: new Date(),
        estimasiJam: data.estimasiJam ?? null,
        metodeBayar: data.metodeBayar ?? null,
        jaminan: data.jaminan ?? null,
        catatan: data.catatan ?? null,
        status: "berjalan",
      });

      await tx.update(bikes).set({ status: "disewa" }).where(eq(bikes.id, sepeda.id));

      return sepeda.kode;
    });
  } catch (galat) {
    if (galat instanceof GagalRental) return { galat: galat.message };
    if (pelanggaranUnik(galat)) {
      return {
        galat:
          "Sepeda ini baru saja dimulai rentalnya oleh petugas lain. Muat ulang halaman untuk melihat kondisi terbaru.",
      };
    }
    throw galat;
  }

  segarkanHalamanTerkait();
  redirect(`/scan?kode=${encodeURIComponent(kodeSepeda)}&mulai=1`);
}

// --- Selesaikan rental ------------------------------------------------------

const skemaSelesai = z.object({
  rentalId: z.coerce.number().int().positive(),
  metodeBayar: z.enum(["tunai", "qris", "transfer"], {
    error: "Pilih metode pembayaran",
  }),
  catatan: z.string().trim().max(500).optional(),
});

export async function selesaikanRental(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  await wajibPengguna();

  const hasil = skemaSelesai.safeParse({
    rentalId: formData.get("rentalId"),
    metodeBayar: formData.get("metodeBayar"),
    catatan: kosongJadiUndefined(formData.get("catatan")),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;
  let idTransaksi: number;

  try {
    idTransaksi = await db.transaction(async (tx) => {
      const [rental] = await tx
        .select()
        .from(rentals)
        .where(and(eq(rentals.id, data.rentalId), eq(rentals.status, "berjalan")))
        .for("update")
        .limit(1);

      if (!rental) {
        throw new GagalRental(
          "Rental ini sudah diselesaikan atau dibatalkan oleh petugas lain.",
        );
      }

      const waktuSelesai = new Date();
      const biaya = hitungBiaya({
        waktuMulai: rental.waktuMulai,
        waktuSelesai,
        tarifPerJam: rental.tarifPerJamSnapshot,
        persentasePemilik: rental.persentasePemilikSnapshot,
      });

      await tx
        .update(rentals)
        .set({
          waktuSelesai,
          durasiMenit: biaya.durasiMenit,
          durasiJamDitagih: biaya.durasiJamDitagih,
          totalBiaya: biaya.totalBiaya,
          bagianPemilik: biaya.bagianPemilik,
          bagianRental: biaya.bagianRental,
          metodeBayar: data.metodeBayar,
          catatan: data.catatan ?? rental.catatan,
          status: "selesai",
        })
        .where(eq(rentals.id, rental.id));

      // Kembalikan sepeda ke "tersedia" hanya kalau statusnya memang "disewa".
      // Kalau sementara ini admin sudah menandainya servis, tanda itu dihormati.
      await tx
        .update(bikes)
        .set({ status: "tersedia" })
        .where(and(eq(bikes.id, rental.bikeId), eq(bikes.status, "disewa")));

      return rental.id;
    });
  } catch (galat) {
    if (galat instanceof GagalRental) return { galat: galat.message };
    throw galat;
  }

  segarkanHalamanTerkait();
  redirect(`/transaksi/${idTransaksi}?selesai=1`);
}

// --- Batalkan rental --------------------------------------------------------

const skemaBatal = z.object({
  rentalId: z.coerce.number().int().positive(),
  alasan: z.string().trim().min(3, "Tulis alasan pembatalan").max(200),
});

/** Untuk salah scan atau penyewa batal jalan. Tidak menghasilkan omzet. */
export async function batalkanRental(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh membatalkan rental." };
  }

  const hasil = skemaBatal.safeParse({
    rentalId: formData.get("rentalId"),
    alasan: formData.get("alasan"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;

  try {
    await db.transaction(async (tx) => {
      const [rental] = await tx
        .select()
        .from(rentals)
        .where(and(eq(rentals.id, data.rentalId), eq(rentals.status, "berjalan")))
        .for("update")
        .limit(1);

      if (!rental) throw new GagalRental("Rental ini sudah tidak berjalan.");

      await tx
        .update(rentals)
        .set({
          status: "batal",
          waktuSelesai: new Date(),
          catatan: `Dibatalkan oleh ${pengguna.nama}: ${data.alasan}`,
        })
        .where(eq(rentals.id, rental.id));

      await tx
        .update(bikes)
        .set({ status: "tersedia" })
        .where(and(eq(bikes.id, rental.bikeId), eq(bikes.status, "disewa")));
    });
  } catch (galat) {
    if (galat instanceof GagalRental) return { galat: galat.message };
    throw galat;
  }

  segarkanHalamanTerkait();
  redirect("/transaksi");
}

/** Galat yang boleh ditampilkan apa adanya ke petugas. */
class GagalRental extends Error {}

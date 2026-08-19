"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bikes, bookingSlots, bookings, owners, renters, rentals } from "@/lib/db/schema";
import { pelanggaranUnik } from "@/lib/db/galat";
import { wajibPengguna } from "@/lib/auth/dal";
import { normalkanNoHp } from "@/lib/format";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { daftarJamBooking, dariKunciTanggalWib } from "@/lib/waktu";
import { namaOrang, noHpWa } from "@/lib/validasi";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

/** Galat yang boleh ditampilkan apa adanya ke petugas. */
class GagalBooking extends Error {}

function segarkan() {
  revalidatePath("/booking");
  revalidatePath("/dashboard");
  revalidatePath("/scan");
  revalidatePath("/sepeda");
}

function kosongJadiUndefined(nilai: FormDataEntryValue | null): string | undefined {
  const teks = typeof nilai === "string" ? nilai.trim() : "";
  return teks === "" ? undefined : teks;
}

const skemaBuat = z.object({
  bikeId: z.coerce.number().int().positive("Pilih sepeda"),
  namaPenyewa: namaOrang,
  noHp: noHpWa,
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  jam: z.coerce.number().int().min(0, "Jam tidak valid").max(23, "Jam tidak valid"),
  durasiJam: z.coerce
    .number()
    .int("Durasi harus jam bulat")
    .min(1, "Durasi minimal 1 jam")
    .max(24, "Durasi maksimal 24 jam"),
  metodeBayar: z.enum(["tunai", "qris", "transfer"]).optional(),
  catatan: z.string().trim().max(500).optional(),
});

export async function buatBooking(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaBuat.safeParse({
    bikeId: formData.get("bikeId"),
    namaPenyewa: formData.get("namaPenyewa"),
    noHp: formData.get("noHp"),
    tanggal: formData.get("tanggal"),
    jam: formData.get("jam"),
    durasiJam: formData.get("durasiJam"),
    metodeBayar: kosongJadiUndefined(formData.get("metodeBayar")),
    catatan: kosongJadiUndefined(formData.get("catatan")),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;

  const awalHari = dariKunciTanggalWib(data.tanggal);
  if (!awalHari) return { galatField: { tanggal: ["Tanggal tidak valid"] } };

  const waktuMulai = new Date(awalHari.getTime() + data.jam * 60 * 60 * 1000);

  // Booking untuk waktu yang sudah lewat tidak masuk akal dan akan mengunci
  // jam-jam yang tidak mungkin dipakai.
  if (waktuMulai.getTime() < Date.now() - 60 * 60 * 1000) {
    return { galat: "Waktu booking sudah lewat. Pilih tanggal dan jam yang akan datang." };
  }

  const noHp = normalkanNoHp(data.noHp);
  let idBaru: number;

  try {
    idBaru = await db.transaction(async (tx) => {
      const [sepeda] = await tx
        .select({
          id: bikes.id,
          kode: bikes.kode,
          status: bikes.status,
          tarifPerJam: bikes.tarifPerJam,
        })
        .from(bikes)
        .where(eq(bikes.id, data.bikeId))
        .for("update", { of: bikes })
        .limit(1);

      if (!sepeda) throw new GagalBooking("Sepeda tidak ditemukan.");
      if (sepeda.status === "servis" || sepeda.status === "nonaktif") {
        throw new GagalBooking(
          `Sepeda ${sepeda.kode} sedang berstatus "${sepeda.status}" dan belum bisa dipesan.`,
        );
      }

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

      const [booking] = await tx
        .insert(bookings)
        .values({
          bikeId: sepeda.id,
          renterId,
          dicatatOleh: pengguna.id,
          waktuMulai,
          durasiJam: data.durasiJam,
          tarifPerJamSnapshot: sepeda.tarifPerJam,
          metodeBayar: data.metodeBayar ?? null,
          catatan: data.catatan ?? null,
        })
        .returning({ id: bookings.id });

      // Slot per jam inilah yang ditolak database kalau ada yang bertumpang tindih.
      await tx.insert(bookingSlots).values(
        daftarJamBooking(waktuMulai, data.durasiJam).map((jam) => ({
          bookingId: booking.id,
          bikeId: sepeda.id,
          jam,
        })),
      );

      return booking.id;
    });
  } catch (galat) {
    if (galat instanceof GagalBooking) return { galat: galat.message };
    if (pelanggaranUnik(galat)) {
      return {
        galat:
          "Sepeda ini sudah dipesan orang lain pada sebagian jam tersebut. Pilih jam lain atau sepeda lain.",
      };
    }
    throw galat;
  }

  segarkan();
  redirect(`/booking/${idBaru}?baru=1`);
}

const skemaBatal = z.object({
  bookingId: z.coerce.number().int().positive(),
  alasan: z.string().trim().min(3, "Tulis alasan pembatalan").max(200),
});

export async function batalkanBooking(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaBatal.safeParse({
    bookingId: formData.get("bookingId"),
    alasan: formData.get("alasan"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const { bookingId, alasan } = hasil.data;

  try {
    await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, "booking")))
        .for("update")
        .limit(1);

      if (!booking) {
        throw new GagalBooking("Booking ini sudah tidak berstatus booking.");
      }

      await tx
        .update(bookings)
        .set({
          status: "batal",
          catatan: `Dibatalkan oleh ${pengguna.nama}: ${alasan}`,
        })
        .where(eq(bookings.id, bookingId));

      // Slot dilepas supaya jam-jamnya bisa dipesan orang lain.
      await tx
        .update(bookingSlots)
        .set({ aktif: false })
        .where(eq(bookingSlots.bookingId, bookingId));
    });
  } catch (galat) {
    if (galat instanceof GagalBooking) return { galat: galat.message };
    throw galat;
  }

  segarkan();
  redirect("/booking");
}

const skemaMulai = z.object({
  bookingId: z.coerce.number().int().positive(),
  jaminan: z.string().trim().max(200).optional(),
});

/**
 * Menjemput booking: sepeda diambil penyewa, booking berubah menjadi rental
 * yang berjalan.
 *
 * Nilai snapshot rental diambil dari kondisi saat ini (tarif sepeda dan
 * persentase pemilik), sama seperti mulaiRental biasa, supaya perhitungan bagi
 * hasil tetap konsisten dengan seluruh laporan.
 */
export async function mulaiRentalDariBooking(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaMulai.safeParse({
    bookingId: formData.get("bookingId"),
    jaminan: kosongJadiUndefined(formData.get("jaminan")),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const { bookingId, jaminan } = hasil.data;
  let kodeSepeda: string;

  try {
    kodeSepeda = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, "booking")))
        .for("update")
        .limit(1);

      if (!booking) {
        throw new GagalBooking(
          "Booking ini sudah dijemput atau dibatalkan oleh petugas lain.",
        );
      }

      const [sepeda] = await tx
        .select({
          id: bikes.id,
          kode: bikes.kode,
          status: bikes.status,
          tarifPerJam: bikes.tarifPerJam,
          ownerId: bikes.ownerId,
          persentasePemilik: owners.persentaseBagiHasil,
        })
        .from(bikes)
        .innerJoin(owners, eq(bikes.ownerId, owners.id))
        .where(eq(bikes.id, booking.bikeId))
        .for("update", { of: bikes })
        .limit(1);

      if (!sepeda) throw new GagalBooking("Sepeda tidak ditemukan.");

      if (sepeda.status === "disewa") {
        throw new GagalBooking(
          `Sepeda ${sepeda.kode} masih dipakai penyewa sebelumnya. Selesaikan rental itu dulu, atau pilihkan sepeda lain untuk penyewa ini.`,
        );
      }
      if (sepeda.status === "servis" || sepeda.status === "nonaktif") {
        throw new GagalBooking(
          `Sepeda ${sepeda.kode} sedang berstatus "${sepeda.status}" dan tidak bisa diserahkan.`,
        );
      }

      const [rental] = await tx
        .insert(rentals)
        .values({
          bikeId: sepeda.id,
          renterId: booking.renterId,
          kasirId: pengguna.id,
          ownerIdSnapshot: sepeda.ownerId,
          tarifPerJamSnapshot: sepeda.tarifPerJam,
          persentasePemilikSnapshot: sepeda.persentasePemilik,
          waktuMulai: new Date(),
          estimasiJam: booking.durasiJam,
          metodeBayar: booking.metodeBayar,
          jaminan: jaminan ?? null,
          catatan: `Dari booking BK-${String(booking.id).padStart(4, "0")}`,
          status: "berjalan",
        })
        .returning({ id: rentals.id });

      await tx
        .update(bookings)
        .set({ status: "selesai", rentalId: rental.id })
        .where(eq(bookings.id, booking.id));

      await tx.update(bikes).set({ status: "disewa" }).where(eq(bikes.id, sepeda.id));

      return sepeda.kode;
    });
  } catch (galat) {
    if (galat instanceof GagalBooking) return { galat: galat.message };
    if (pelanggaranUnik(galat)) {
      return {
        galat:
          "Sepeda ini baru saja mulai disewakan oleh petugas lain. Muat ulang halaman untuk melihat kondisi terbaru.",
      };
    }
    throw galat;
  }

  segarkan();
  redirect(`/scan?kode=${encodeURIComponent(kodeSepeda)}&mulai=1`);
}

/** Menandai booking yang penyewanya tidak datang sebagai batal. */
export async function tandaiHangus(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId <= 0) return;

  const pengaturan = await ambilPengaturan();
  const batas = new Date(Date.now() - pengaturan.toleransiBookingMenit * 60_000);

  await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "booking")))
      .for("update")
      .limit(1);

    // Hanya booking yang jam mulainya benar-benar sudah terlewat yang boleh
    // ditandai hangus, supaya booking mendatang tidak bisa dihanguskan.
    if (!booking || booking.waktuMulai.getTime() > batas.getTime()) return;

    await tx
      .update(bookings)
      .set({
        status: "batal",
        catatan: `Hangus, penyewa tidak datang. Ditandai oleh ${pengguna.nama}.`,
      })
      .where(eq(bookings.id, bookingId));

    await tx
      .update(bookingSlots)
      .set({ aktif: false })
      .where(eq(bookingSlots.bookingId, bookingId));
  });

  segarkan();
  redirect("/booking");
}

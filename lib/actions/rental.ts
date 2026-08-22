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
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { normalkanNoHp } from "@/lib/format";
import { namaOrang, noHpWa } from "@/lib/validasi";

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
  namaPenyewa: namaOrang,
  // Penyewa harus bisa dihubungi kalau sepeda belum kembali, jadi aturannya
  // menuntut nomor seluler sungguhan — bukan sekadar "berisi angka".
  noHp: noHpWa,
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
  /**
   * Tambahan keterlambatan yang dipilih kasir. Boleh kosong — artinya kasir
   * tidak mengubah saran sistem, jalur yang paling sering terjadi.
   */
  tambahanDitagih: z.coerce
    .number({ error: "Tambahan harus berupa angka" })
    .int("Tambahan harus rupiah bulat")
    .min(0, "Tambahan tidak boleh negatif")
    .optional(),
  alasanPotongan: z.string().trim().max(200).optional(),
});

export async function selesaikanRental(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();

  const hasil = skemaSelesai.safeParse({
    rentalId: formData.get("rentalId"),
    metodeBayar: formData.get("metodeBayar"),
    catatan: kosongJadiUndefined(formData.get("catatan")),
    tambahanDitagih: kosongJadiUndefined(formData.get("tambahanDitagih")),
    alasanPotongan: kosongJadiUndefined(formData.get("alasanPotongan")),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const data = hasil.data;
  const pengaturan = await ambilPengaturan();
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

      // Biaya dihitung ULANG di sini dari jam server, bukan dipercayakan pada
      // angka yang dikirim formulir. Yang datang dari kasir hanyalah keputusan
      // menurunkan denda — batas atasnya tetap ditentukan sistem.
      //
      // Penolakan "tambahan melebihi saran" datang dari sini sebagai Error
      // biasa. Diterjemahkan jadi GagalRental supaya kasir melihat pesannya di
      // formulir, bukan halaman galat — ini kesalahan yang wajar terjadi kalau
      // sepeda dikembalikan tepat saat blok setengah jam berikutnya berganti.
      let biaya;
      try {
        biaya = hitungBiaya({
          waktuMulai: rental.waktuMulai,
          waktuSelesai,
          tarifPerJam: rental.tarifPerJamSnapshot,
          persentasePemilik: rental.persentasePemilikSnapshot,
          toleransiMenit: pengaturan.toleransiTelatMenit,
          tambahanDitagih: data.tambahanDitagih,
        });
      } catch (galat) {
        throw new GagalRental(
          galat instanceof Error ? galat.message : "Perhitungan biaya gagal.",
        );
      }

      // Keringanan harus punya nama dan alasan. Tanpa syarat ini, seluruh jejak
      // yang dikumpulkan tidak bisa dipakai menjawab ke mana uang kelebihan jam
      // itu perginya.
      const memberiPotongan = biaya.tambahanDitagih < biaya.tambahanSaran;
      if (memberiPotongan && !data.alasanPotongan) {
        throw new GagalRental(
          "Tambahan diturunkan dari saran sistem, jadi alasannya wajib diisi.",
        );
      }

      await tx
        .update(rentals)
        .set({
          waktuSelesai,
          durasiMenit: biaya.durasiMenit,
          durasiJamDitagih: biaya.durasiJamDitagih,
          tambahanSaran: biaya.tambahanSaran,
          tambahanDitagih: biaya.tambahanDitagih,
          alasanPotongan: memberiPotongan ? (data.alasanPotongan ?? null) : null,
          totalBiaya: biaya.totalBiaya,
          bagianPemilik: biaya.bagianPemilik,
          bagianRental: biaya.bagianRental,
          metodeBayar: data.metodeBayar,
          catatan: data.catatan ?? rental.catatan,
          // Uang berpindah tangan di sini, bukan saat rental dimulai. Rekap kas
          // harian membebankannya ke orang ini, bukan ke kasir pembuka — kalau
          // shift berganti saat sepeda masih di jalan, keduanya berbeda.
          diselesaikanOleh: pengguna.id,
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

      // Kolom catatan sengaja tidak disentuh. Sebelumnya jejak pembatalan
      // ditulis ke sana, yang berarti catatan asli kasir — jaminan apa yang
      // ditahan, kondisi sepeda saat berangkat — ikut terhapus justru pada
      // rental yang paling mungkin dipersoalkan kemudian.
      await tx
        .update(rentals)
        .set({
          status: "batal",
          waktuSelesai: new Date(),
          dibatalkanOleh: pengguna.id,
          dibatalkanPada: new Date(),
          alasanBatal: data.alasan,
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

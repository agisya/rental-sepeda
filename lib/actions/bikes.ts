"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bikes } from "@/lib/db/schema";
import { wajibPengguna } from "@/lib/auth/dal";
import { kodeSudahDipakai, sepedaPunyaRiwayat } from "@/lib/queries/bikes";
import { periksaFoto } from "@/lib/foto";
import { normalkanKode } from "@/lib/format";
import type { StatusAksi } from "./rental";

export type { StatusAksi };

const skema = z.object({
  kode: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter")
    .max(32, "Kode maksimal 32 karakter")
    .refine(
      (v) => /^[A-Za-z0-9-]+$/.test(v.replace(/\s+/g, "")),
      "Kode hanya boleh huruf, angka, dan tanda hubung",
    ),
  nama: z.string().trim().min(2, "Nama sepeda minimal 2 huruf").max(100),
  jenis: z.string().trim().min(2, "Jenis wajib diisi").max(50),
  merk: z.string().trim().max(50).optional(),
  tarifPerJam: z.coerce
    .number({ error: "Tarif harus berupa angka" })
    .int("Tarif harus rupiah bulat tanpa desimal")
    .min(0, "Tarif tidak boleh negatif")
    .max(10_000_000, "Tarif terlalu besar"),
  ownerId: z.coerce.number().int().positive("Pilih pemilik sepeda"),
  status: z.enum(["tersedia", "disewa", "booking", "servis", "nonaktif"]),
  catatan: z.string().trim().max(500).optional(),
});

export async function simpanSepeda(
  _sebelumnya: StatusAksi,
  formData: FormData,
): Promise<StatusAksi> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") {
    return { galat: "Hanya admin atau owner yang boleh mengubah data sepeda." };
  }

  const idMentah = formData.get("id");
  const id = idMentah ? Number(idMentah) : null;

  const teks = (kunci: string) => {
    const nilai = formData.get(kunci);
    const bersih = typeof nilai === "string" ? nilai.trim() : "";
    return bersih === "" ? undefined : bersih;
  };

  const hasil = skema.safeParse({
    kode: formData.get("kode"),
    nama: formData.get("nama"),
    jenis: formData.get("jenis"),
    merk: teks("merk"),
    tarifPerJam: formData.get("tarifPerJam"),
    ownerId: formData.get("ownerId"),
    status: formData.get("status"),
    catatan: teks("catatan"),
  });

  if (!hasil.success) {
    return { galatField: z.flattenError(hasil.error).fieldErrors };
  }

  const kode = normalkanKode(hasil.data.kode);

  if (await kodeSudahDipakai(kode, id ?? undefined)) {
    return { galatField: { kode: [`Kode ${kode} sudah dipakai sepeda lain.`] } };
  }

  const data = {
    kode,
    nama: hasil.data.nama,
    jenis: hasil.data.jenis,
    merk: hasil.data.merk ?? null,
    tarifPerJam: hasil.data.tarifPerJam,
    ownerId: hasil.data.ownerId,
    catatan: hasil.data.catatan ?? null,
  };

  if (id) {
    const [sekarang] = await db
      .select({ status: bikes.status })
      .from(bikes)
      .where(eq(bikes.id, id))
      .limit(1);

    // Status sepeda yang sedang disewa hanya boleh diubah lewat alur selesai
    // atau batal rental, supaya tidak ada rental berjalan yang menggantung.
    if (sekarang?.status === "disewa" && hasil.data.status !== "disewa") {
      return {
        galat:
          "Sepeda ini sedang disewa. Selesaikan atau batalkan rentalnya dulu sebelum mengubah status.",
      };
    }

    await db
      .update(bikes)
      .set({ ...data, status: hasil.data.status })
      .where(eq(bikes.id, id));
  } else {
    /*
      Foto ikut disimpan bersama sepedanya, bukan lewat langkah kedua.

      Sebelumnya kolom foto hanya ada di halaman ubah, karena foto disimpan
      terhadap id sepeda dan id itu baru lahir setelah tersimpan. Akibatnya foto
      hampir selalu terlupakan: petugas menekan simpan, halaman pindah ke daftar
      sepeda, dan tidak ada apa pun yang mengingatkan.

      Insert bisa langsung memuat kolom fotonya, jadi langkah keduanya memang
      tidak pernah diperlukan.
    */
    let foto: { fotoData: Buffer; fotoTipe: string; fotoVersi: number } | undefined;

    const berkas = formData.get("foto");
    if (berkas instanceof File && berkas.size > 0) {
      const isi = new Uint8Array(await berkas.arrayBuffer());
      const periksa = periksaFoto(berkas.type, berkas.size, isi);
      if (!periksa.ok) {
        return { galatField: { foto: [periksa.pesan] } };
      }
      foto = { fotoData: Buffer.from(isi), fotoTipe: periksa.tipe, fotoVersi: 1 };
    }

    await db.insert(bikes).values({
      ...data,
      ...foto,
      // Sepeda baru tidak boleh langsung berstatus disewa tanpa transaksi.
      status: hasil.data.status === "disewa" ? "tersedia" : hasil.data.status,
    });
  }

  revalidatePath("/sepeda");
  revalidatePath("/dashboard");
  redirect("/sepeda");
}

export async function hapusSepeda(formData: FormData): Promise<void> {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  // Sepeda yang pernah dipakai tidak dihapus supaya laporan lama tidak rusak.
  if (await sepedaPunyaRiwayat(id)) {
    await db.update(bikes).set({ status: "nonaktif" }).where(eq(bikes.id, id));
  } else {
    await db.delete(bikes).where(eq(bikes.id, id));
  }

  revalidatePath("/sepeda");
  revalidatePath("/dashboard");
  redirect("/sepeda");
}

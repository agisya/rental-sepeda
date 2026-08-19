import { z } from "zod";
import { normalkanNoHp } from "./format";

/**
 * Aturan isian yang dipakai bersama.
 *
 * Dikumpulkan di satu berkas supaya tidak ada dua tempat yang menerima nomor
 * berbeda untuk hal yang sama. Sebelumnya setiap action menulis aturannya
 * sendiri, dan yang paling longgar menentukan apa yang benar-benar masuk ke
 * database — nomor seperti "1" atau "+++" lolos di satu pintu lalu tersimpan
 * selamanya.
 */

/**
 * Nomor yang harus bisa dihubungi lewat WhatsApp atau telepon seluler.
 *
 * Dipakai untuk penyewa dan booking: kalau sepeda belum kembali, nomor inilah
 * satu-satunya cara menghubungi orangnya. Nomor yang tidak bisa dihubungi sama
 * saja dengan tidak ada nomor.
 *
 * Dinormalkan lebih dulu supaya 08xx, 628xx, dan +628xx dianggap satu nomor —
 * penting karena penyewa dikenali dari nomornya, dan bentuk yang berbeda akan
 * membuat orang yang sama terdata dua kali.
 */
export const noHpWa = z
  .string()
  .trim()
  .min(1, "Nomor HP wajib diisi")
  .transform(normalkanNoHp)
  .refine((v) => /^08\d{8,12}$/.test(v), {
    error:
      "Nomor HP harus nomor seluler Indonesia, diawali 08 dan panjang 10–14 angka. " +
      "Contoh: 081234567890",
  });

/**
 * Nomor kontak yang tidak harus seluler.
 *
 * Dipakai untuk pemilik sepeda dan identitas usaha, karena telepon rumah masih
 * lazim di sini — memaksanya berawalan 08 akan menolak nomor yang benar-benar
 * dipakai orang.
 */
export const noHpKontak = z
  .string()
  .trim()
  .min(1, "Nomor telepon wajib diisi")
  .transform(normalkanNoHp)
  .refine((v) => /^0\d{7,13}$/.test(v), {
    error:
      "Nomor telepon harus angka Indonesia yang diawali 0, panjang 8–14 angka. " +
      "Boleh nomor HP maupun telepon rumah.",
  });

/**
 * Nama orang.
 *
 * Menuntut minimal satu huruf, bukan hanya panjang minimal. Tanpa itu "12",
 * "--", dan "..." lolos — dan nama seperti itu membuat daftar penyewa tidak bisa
 * dipakai untuk mengenali siapa pun.
 */
export const namaOrang = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 huruf")
  .max(100, "Nama maksimal 100 huruf")
  .refine((v) => /\p{L}/u.test(v), {
    error: "Nama harus memuat huruf, bukan hanya angka atau tanda baca",
  });

/** Rupiah bulat yang wajar untuk nominal uang. */
export const rupiahPositif = z.coerce
  .number({ error: "Jumlah harus berupa angka" })
  .int("Jumlah harus rupiah bulat, tanpa sen")
  .min(1, "Jumlah harus lebih dari nol")
  .max(1_000_000_000, "Jumlah tidak masuk akal");

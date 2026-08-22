"use server";

import { wajibPengguna } from "@/lib/auth/dal";
import { daftarRentalBerjalan } from "@/lib/queries/rentals";
import { bookingAktif } from "@/lib/queries/bookings";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { susunNotifikasi, type Notifikasi } from "@/lib/notifikasi/susun";

/**
 * Keadaan yang perlu diberitahukan ke petugas saat ini juga.
 *
 * Dipanggil berkala dari peramban, jadi sengaja hanya membaca — tidak ada yang
 * ditulis dan tidak ada revalidasi halaman. Kuerinya dipakai ulang dari yang
 * sudah ada, sehingga tidak ada SQL baru yang perlu dirawat.
 *
 * Aturan kapan sebuah notifikasi muncul tidak ada di sini melainkan di
 * lib/notifikasi/susun.ts, yang murni dan diuji tanpa database.
 */
export async function ambilNotifikasi(): Promise<Notifikasi[]> {
  await wajibPengguna();

  const sekarang = new Date();
  const [pengaturan, rental, booking] = await Promise.all([
    ambilPengaturan(),
    daftarRentalBerjalan(),
    bookingAktif(sekarang),
  ]);

  return susunNotifikasi(rental, booking, sekarang, {
    toleransiBookingMenit: pengaturan.toleransiBookingMenit,
    batasJamRental: pengaturan.batasJamRental,
  });
}

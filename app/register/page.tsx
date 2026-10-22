import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sistemKosong } from "@/lib/pengguna/kelola";
import { KerangkaPublik } from "@/components/ui/kerangka-publik";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Buat akun pertama",
};

/**
 * Pembuatan akun admin pertama.
 *
 * Migrasi hanya membuat tabel; isinya kosong, sehingga instance yang baru
 * dideploy tidak punya akun untuk login. Sebelum ada halaman ini, satu-satunya
 * jalan adalah menyisipkan baris lewat terminal Postgres atau membuka database
 * ke internet supaya `npm run db:seed` bisa dijalankan dari laptop. Keduanya
 * menuntut ketelitian tinggi untuk sesuatu yang cuma dilakukan sekali.
 *
 * Halaman ini menutup diri begitu ada satu pengguna — jadi ia bukan pendaftaran
 * terbuka, melainkan pintu yang hanya bisa dilewati satu kali.
 */
export default async function HalamanRegister() {
  /**
   * Menghentikan prerender di sini, dan ini wajib.
   *
   * Halaman ini tidak menyentuh cookie maupun searchParams, jadi Next
   * menganggapnya bisa dibuat statis saat build — lalu hasil pemeriksaan di
   * bawah ikut membeku ke dalam berkas. Yang terjadi: `next build` berjalan di
   * mesin tanpa database, pemeriksaannya gagal, pintu dinyatakan tertutup, dan
   * pengalihan 307 ke /login tersimpan permanen di dalam image. Akun pertama
   * tidak akan pernah bisa dibuat, dan gejalanya sulit ditelusuri karena
   * kodenya terlihat benar.
   */
  await connection();

  // Dijaga dua lapis. Yang ini supaya halamannya tidak muncul, dan yang di dalam
  // action supaya pemanggilan POST langsung juga tetap ditolak.
  //
  // Kalau database tidak bisa dihubungi, keadaannya tidak diketahui — dan pada
  // keadaan tidak diketahui, pintu ini dipilih tertutup.
  let kosong: boolean;
  try {
    kosong = await sistemKosong();
  } catch (galat) {
    console.error("Gagal memeriksa keadaan sistem di halaman register:", galat);
    kosong = false;
  }

  if (!kosong) redirect("/login");

  return (
    <KerangkaPublik>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Buat akun pertama</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Belum ada akun di sistem ini. Akun pertama menjadi admin.
        </p>

        <div className="mt-8">
          <RegisterForm />
        </div>

        <p className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-ink-faint">
          Halaman ini menutup sendiri setelah akun pertama dibuat. Petugas berikutnya
          ditambahkan dari menu Pengaturan.
        </p>
      </div>
    </KerangkaPublik>
  );
}

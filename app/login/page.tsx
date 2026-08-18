import type { Metadata } from "next";
import { Bike } from "lucide-react";
import { sistemKosong } from "@/lib/pengguna/kelola";
import { ButtonLink } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

/**
 * Koneksi database bisa putus karena internet mati di lokasi rental. Kalau itu
 * terjadi, halaman login harus tetap tampil apa adanya — bukan berubah menjadi
 * layar galat yang membuat petugas mengira aplikasinya rusak. Pesan koneksi yang
 * bisa ditindaklanjuti sudah disiapkan action masuk() saat tombolnya ditekan.
 */
async function belumPunyaAkunSamaSekali(): Promise<boolean> {
  try {
    return await sistemKosong();
  } catch (galat) {
    console.error("Gagal memeriksa apakah sistem masih kosong:", galat);
    return false;
  }
}

export default async function HalamanLogin(props: PageProps<"/login">) {
  const { lanjut } = await props.searchParams;
  const tujuan = typeof lanjut === "string" && lanjut.startsWith("/") ? lanjut : undefined;

  /**
   * Login sengaja membalas pesan yang sama untuk username yang tidak ada maupun
   * kata sandi yang salah, supaya halaman ini tidak bisa dipakai menebak username
   * terdaftar. Tapi pada sistem yang belum punya akun sama sekali, tidak ada
   * username untuk ditebak — jadi tidak ada yang bocor, dan diamnya justru
   * menyesatkan: "belum ada akun" terlihat persis seperti "sandi salah".
   */
  const belumAdaAkun = await belumPunyaAkunSamaSekali();

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-bg px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-panel bg-brand text-brand-ink"
            aria-hidden="true"
          >
            <Bike className="size-7" strokeWidth={1.9} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Rental Sepeda Garut
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Masuk untuk mulai mencatat rental hari ini
          </p>
        </div>

        {belumAdaAkun ? (
          <div className="rounded-card border border-line bg-surface p-5 text-center">
            <h2 className="text-sm font-semibold text-ink">Belum ada akun di sistem ini</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Database sudah siap, tapi belum ada satu pun akun untuk masuk. Buat akun
              admin pertama lebih dulu.
            </p>
            <ButtonLink href="/register" ukuran="lg" penuh className="mt-5">
              Buat akun pertama
            </ButtonLink>
          </div>
        ) : (
          <div className="rounded-card border border-line bg-surface p-5">
            <LoginForm lanjut={tujuan} />
          </div>
        )}

        <p className="mt-6 text-center text-xs text-ink-faint">
          {belumAdaAkun
            ? "Halaman ini hanya muncul sekali, sebelum akun pertama ada."
            : "Lupa kata sandi? Hubungi admin rental."}
        </p>
      </div>
    </main>
  );
}

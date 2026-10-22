import type { Metadata } from "next";
import { sistemKosong } from "@/lib/pengguna/kelola";
import { namaAkunDemo } from "@/lib/auth/demo";
import { ButtonLink } from "@/components/ui/button";
import { KerangkaPublik } from "@/components/ui/kerangka-publik";
import { DemoButton } from "@/components/auth/demo-button";
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
  const adaAkunDemo = namaAkunDemo() !== null;

  /*
    Form langsung di atas latar, tanpa kartu. Halaman ini hanya punya satu
    pekerjaan, dan bingkai di sekeliling satu-satunya isi halaman tidak
    memisahkannya dari apa pun — hanya menambah garis.
  */
  return (
    <KerangkaPublik>
      <div className="mx-auto w-full max-w-sm">
        {belumAdaAkun ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Belum ada akun
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Database sudah siap, tapi belum ada satu pun akun untuk masuk. Buat akun
              admin pertama lebih dulu.
            </p>
            <ButtonLink href="/register" ukuran="lg" penuh className="mt-8">
              Buat akun pertama
            </ButtonLink>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Masuk</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Lanjutkan mencatat rental hari ini.
            </p>

            <div className="mt-8">
              <LoginForm lanjut={tujuan} />
            </div>

            {/*
              Hanya muncul di deployment yang memang punya akun demo. Tanpa
              AKUN_DEMO tidak ada tombol dan tidak ada jalan masuk tambahan, jadi
              pemasangan di rental sungguhan tidak ikut membawa pintu ini.
            */}
            {adaAkunDemo && (
              <>
                <div className="my-6 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-xs text-ink-faint">atau</span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <DemoButton />

                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  Masuk sebagai kasir dengan data contoh. Bisa mencatat rental dan
                  membuka laporan; menghapus data dan menu keuangan tertutup.
                </p>
              </>
            )}
          </>
        )}

        <p className="mt-10 border-t border-line pt-5 text-xs text-ink-faint">
          {belumAdaAkun
            ? "Halaman ini hanya muncul sekali, sebelum akun pertama ada."
            : "Lupa kata sandi? Hubungi admin rental."}
        </p>
      </div>
    </KerangkaPublik>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { Merek } from "./merek";
import { TombolTema } from "./tema";

/**
 * Kerangka halaman yang dibuka tanpa sesi atau di luar aplikasi: masuk, akun
 * pertama, halaman tidak ditemukan, dan galat.
 *
 * Kepalanya hanya merek dan tombol tema. Dulu halaman-halaman ini berdiri
 * sendiri tanpa kepala sama sekali, sehingga satu-satunya cara mengganti tema
 * adalah masuk lebih dulu — padahal layar login justru yang pertama menyilaukan
 * di konter yang gelap.
 *
 * Merek menuju "/", bukan ke dashboard: yang belum masuk sampai ke landing page,
 * dan yang sudah masuk dialihkan proxy.ts ke dashboard.
 */
export function KerangkaPublik({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="rounded-control" aria-label="Rental Ku, ke halaman depan">
          <Merek />
        </Link>
        <TombolTema />
      </header>

      {/* pb-16 menggeser titik tengahnya sedikit ke atas: isi yang berada
          tepat di tengah layar terlihat melorot karena kepala di atasnya. */}
      <main className="flex flex-1 flex-col justify-center px-4 pb-16 pt-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

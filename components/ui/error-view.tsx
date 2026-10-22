"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Ikon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Tampilan galat yang sama untuk seluruh aplikasi. Pesan asli tidak pernah
 * ditampilkan karena bisa memuat detail koneksi database; yang ditunjukkan hanya
 * digest-nya, supaya bisa dicocokkan dengan log server.
 *
 * Tingkat judulnya ditentukan pemanggil. Di dalam aplikasi, bilah atas sudah
 * memegang satu-satunya h1 halaman; di luar aplikasi, judul inilah h1-nya.
 */
export function ErrorView({
  error,
  reset,
  tingkat = "h2",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  tingkat?: "h1" | "h2";
}) {
  const Judul = tingkat;

  return (
    <div className="mx-auto w-full max-w-sm py-10">
      <Ikon.peringatan className="size-5 text-danger" strokeWidth={1.9} aria-hidden="true" />

      <Judul
        className={cn(
          "mt-3 font-semibold tracking-tight text-ink",
          tingkat === "h1" ? "text-2xl" : "text-xl",
        )}
      >
        Terjadi kesalahan
      </Judul>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Halaman ini gagal dimuat. Coba muat ulang; kalau tetap gagal, periksa koneksi
        internet lalu hubungi admin.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-ink-faint">Kode: {error.digest}</p>
      )}

      <div className="mt-8 flex gap-2">
        <Button variasi="kedua" className="flex-1" onClick={reset}>
          Coba lagi
        </Button>
        <ButtonLink href="/dashboard" className="flex-1">
          Ke Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

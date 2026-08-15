"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Ikon } from "@/components/ui/icons";

/**
 * Tampilan galat yang sama untuk seluruh aplikasi. Pesan asli tidak pernah
 * ditampilkan karena bisa memuat detail koneksi database; yang ditunjukkan hanya
 * digest-nya, supaya bisa dicocokkan dengan log server.
 */
export function ErrorView({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-14 text-center">
      <span
        className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"
        aria-hidden="true"
      >
        <Ikon.peringatan className="size-6" strokeWidth={1.9} />
      </span>

      <h1 className="text-lg font-semibold tracking-tight text-ink">
        Terjadi kesalahan
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Halaman ini gagal dimuat. Coba muat ulang; kalau tetap gagal, periksa koneksi
        internet lalu hubungi admin.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-ink-faint">Kode: {error.digest}</p>
      )}

      <div className="mt-7 flex gap-2">
        <Button variasi="kedua" penuh onClick={reset}>
          Coba lagi
        </Button>
        <ButtonLink href="/dashboard" penuh>
          Ke Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

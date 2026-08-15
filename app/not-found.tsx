import Link from "next/link";
import { SearchX } from "lucide-react";

export default function TidakDitemukan() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 text-center">
      <span
        className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-faint"
        aria-hidden="true"
      >
        <SearchX className="size-6" strokeWidth={1.9} />
      </span>

      <h1 className="text-lg font-semibold tracking-tight text-ink">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        Alamat yang dibuka tidak ada, atau datanya sudah dihapus.
      </p>

      <Link
        href="/dashboard"
        className="mt-7 inline-flex min-h-11 items-center rounded-control bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover"
      >
        Kembali ke Dashboard
      </Link>
    </main>
  );
}

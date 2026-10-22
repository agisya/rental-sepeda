import { ButtonLink } from "@/components/ui/button";
import { KerangkaPublik } from "@/components/ui/kerangka-publik";

export default function TidakDitemukan() {
  return (
    <KerangkaPublik>
      <div className="mx-auto w-full max-w-sm">
        <p className="font-mono text-sm text-ink-faint">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Alamat yang dibuka tidak ada, atau datanya sudah dihapus.
        </p>

        <ButtonLink href="/dashboard" className="mt-8">
          Kembali ke Dashboard
        </ButtonLink>
      </div>
    </KerangkaPublik>
  );
}

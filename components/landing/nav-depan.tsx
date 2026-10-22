import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Merek } from "@/components/ui/merek";
import { TombolTema } from "@/components/ui/tema";
import { DemoButton } from "@/components/auth/demo-button";

const TAUTAN = [
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-kerja", label: "Cara Kerja" },
];

/**
 * Kepala landing page.
 *
 * Tautan bagiannya disembunyikan di layar sempit, bukan dilipat ke menu hamburger.
 * Halaman ini cuma punya dua bagian dan keduanya terlewati sambil menggulir; menu
 * yang harus dibuka dulu untuk melompati dua sekrol adalah kerumitan yang tidak
 * membayar dirinya sendiri. Yang tetap terlihat di HP adalah tombol tema dan dua
 * tombol masuk, sebab itulah yang orang cari di halaman ini.
 *
 * Tombol hijau selalu jatuh ke ajakan terkuat yang tersedia: Coba demo kalau
 * deployment ini punya akun demo, kalau tidak ya Masuk. Tanpa aturan itu, instalasi
 * di rental sungguhan akan memajang tombol kedua yang tidak pernah jadi hijau.
 */
export function NavDepan({ adaAkunDemo }: { adaAkunDemo: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-control">
          <Merek namaDisembunyikanDiHp={adaAkunDemo} />
        </Link>

        <nav aria-label="Bagian halaman" className="hidden items-center gap-1 md:flex">
          {TAUTAN.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <TombolTema />
          <ButtonLink
            href="/login"
            variasi={adaAkunDemo ? "halus" : "utama"}
            ukuran="sm"
          >
            Masuk
          </ButtonLink>
          {adaAkunDemo && <DemoButton ukuran="sm" penuh={false} variasi="utama" />}
        </div>
      </div>
    </header>
  );
}

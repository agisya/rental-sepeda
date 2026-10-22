import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Baris saringan berbentuk pil. Bisa digeser mendatar di layar HP tanpa membuat
 * seluruh halaman ikut bergeser.
 *
 * Pil yang aktif berwarna tinta, bukan hijau merek. Hijau pekat disimpan untuk
 * tombol yang mengerjakan sesuatu; saringan hanya memilih apa yang dilihat, dan
 * pil hijau di atas daftar sempat bersaing dengan tombol Tambah di sebelahnya.
 */
export function FilterChips({
  label,
  pilihan,
  aktif,
}: {
  label: string;
  pilihan: Array<{ nilai: string; label: string; href: string }>;
  aktif: string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-0.5">
        {pilihan.map((p) => {
          const dipilih = aktif === p.nilai;
          return (
            <li key={p.nilai || "semua"}>
              <Link
                href={p.href}
                aria-current={dipilih ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  dipilih
                    ? "border-ink bg-ink text-bg"
                    : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

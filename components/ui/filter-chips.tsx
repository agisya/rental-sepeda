import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Baris saringan berbentuk pil. Bisa digeser mendatar di layar HP tanpa membuat
 * seluruh halaman ikut bergeser.
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
                    ? "border-brand bg-brand text-brand-ink"
                    : "border-line-strong bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink",
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

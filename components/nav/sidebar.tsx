"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Peran } from "@/lib/db/schema";
import { Ikon } from "@/components/ui/icons";
import { ikonMenu, kelompokUntukPeran, menuAktif } from "./menu";

/**
 * Navigasi samping untuk laptop kasir. Disembunyikan di layar kecil.
 *
 * Menu disaring menurut peran supaya kasir tidak melihat menu keuangan yang
 * memang tidak boleh dibukanya. Penyaringan di sini hanya merapikan tampilan —
 * penjagaan sesungguhnya tetap ada di setiap halaman dan setiap aksi.
 */
export function Sidebar({ peran }: { peran: Peran }) {
  const pathname = usePathname();
  const kelompokMenu = kelompokUntukPeran(peran);

  return (
    <nav
      aria-label="Menu utama"
      className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block"
    >
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand text-brand-ink"
            aria-hidden="true"
          >
            <Ikon.sepeda className="size-5" strokeWidth={2} />
          </span>
          <span className="text-[0.9375rem] font-semibold leading-tight tracking-tight text-ink">
            Rental Sepeda
            <span className="block text-xs font-normal text-ink-muted">Garut</span>
          </span>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {kelompokMenu.map((kelompok) => (
            <div key={kelompok.judul}>
              <p className="label-bagian px-3 pb-1.5">{kelompok.judul}</p>
              <ul className="space-y-0.5">
                {kelompok.item.map((m) => {
                  const aktif = menuAktif(pathname, m.href);
                  const IkonMenu = ikonMenu(m);

                  return (
                    <li key={m.href}>
                      <Link
                        href={m.href}
                        aria-current={aktif ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors",
                          aktif
                            ? "bg-brand-soft font-medium text-brand-soft-ink"
                            : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                        )}
                      >
                        {/* Penanda batang di tepi kiri: status aktif tidak hanya
                            dibedakan lewat warna. */}
                        {aktif && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand"
                          />
                        )}
                        <IkonMenu
                          className={cn("size-[18px] shrink-0", aktif && "text-brand")}
                          strokeWidth={aktif ? 2.2 : 1.8}
                          aria-hidden="true"
                        />
                        {m.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

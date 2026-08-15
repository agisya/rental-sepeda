"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MENU_BAWAH, ikonMenu, menuAktif } from "./menu";

/**
 * Bilah navigasi bawah untuk HP. Ditempatkan di bawah karena petugas memakai
 * aplikasi ini sambil berdiri dan memegang HP dengan satu tangan.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MENU_BAWAH.map((m) => {
          const aktif = menuAktif(pathname, m.href);
          const IkonMenu = ikonMenu(m);

          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex min-h-15 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] transition-colors",
                  aktif ? "font-semibold text-brand" : "font-medium text-ink-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    aktif && "bg-brand-soft",
                  )}
                >
                  <IkonMenu
                    className="size-[19px]"
                    strokeWidth={aktif ? 2.2 : 1.8}
                    aria-hidden="true"
                  />
                </span>
                {m.labelPendek}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

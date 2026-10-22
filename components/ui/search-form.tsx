import type { ReactNode } from "react";
import { Button } from "./button";
import { Ikon } from "./icons";

/** Kolom pencarian dengan pengiriman biasa lewat GET, tanpa JavaScript. */
export function SearchForm({
  aksi,
  nilaiAwal,
  placeholder,
  label,
  tersembunyi,
}: {
  aksi: string;
  nilaiAwal?: string;
  placeholder: string;
  label: string;
  /** Parameter lain yang harus ikut terbawa, misalnya saringan status. */
  tersembunyi?: ReactNode;
}) {
  return (
    <form method="get" action={aksi} className="flex gap-2">
      {tersembunyi}
      <div className="relative flex-1">
        <Ikon.cari
          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-faint"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <input
          type="search"
          name="cari"
          defaultValue={nilaiAwal}
          placeholder={placeholder}
          aria-label={label}
          className="min-h-11 w-full rounded-control border border-line-strong bg-surface py-2.5 pl-11 pr-3 text-base text-ink transition-colors placeholder:text-ink-faint"
        />
      </div>
      <Button type="submit" variasi="kedua" className="shrink-0">
        Cari
      </Button>
    </form>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Ikon, type KomponenIkon } from "./icons";

type Nada = "netral" | "ok" | "danger" | "warn" | "info";

const warnaNada: Record<Nada, string> = {
  netral: "text-ink",
  ok: "text-ok",
  danger: "text-danger",
  warn: "text-warn",
  info: "text-info",
};

const latarIkon: Record<Nada, string> = {
  netral: "bg-surface-2 text-ink-muted",
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
};

/**
 * Kartu angka utama, dipakai untuk omzet hari ini. Angkanya sengaja jauh lebih
 * besar dari yang lain karena inilah yang paling sering dicari pemilik usaha.
 */
export function StatUtama({
  label,
  nilai,
  keterangan,
  ikon: IkonStat = Ikon.uang,
}: {
  label: string;
  nilai: ReactNode;
  keterangan?: ReactNode;
  ikon?: KomponenIkon;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label-bagian">{label}</p>
        <span
          className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand-soft-ink"
          aria-hidden="true"
        >
          <IkonStat className="size-[18px]" strokeWidth={1.9} />
        </span>
      </div>
      <p className="angka-utama mt-2 text-ink">{nilai}</p>
      {keterangan && <p className="mt-1.5 text-sm text-ink-muted">{keterangan}</p>}
    </div>
  );
}

/** Kartu angka pendukung. Bisa diklik kalau diberi href. */
export function Stat({
  label,
  nilai,
  keterangan,
  ikon: IkonStat,
  nada = "netral",
  href,
}: {
  label: string;
  nilai: ReactNode;
  keterangan?: string;
  ikon?: KomponenIkon;
  nada?: Nada;
  href?: string;
}) {
  const isi = (
    <>
      <div className="flex items-center gap-2">
        {IkonStat && (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md",
              latarIkon[nada],
            )}
            aria-hidden="true"
          >
            <IkonStat className="size-3.5" strokeWidth={2} />
          </span>
        )}
        <p className="truncate text-xs font-medium text-ink-muted">{label}</p>
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
          warnaNada[nada],
        )}
      >
        {nilai}
      </p>
      {keterangan && <p className="mt-0.5 text-xs text-ink-faint">{keterangan}</p>}
    </>
  );

  const kelas = "block rounded-card border border-line bg-surface p-4";

  return href ? (
    <Link href={href} className={cn(kelas, "transition-colors hover:border-line-strong")}>
      {isi}
    </Link>
  ) : (
    <div className={kelas}>{isi}</div>
  );
}

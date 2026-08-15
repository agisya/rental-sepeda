import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { KomponenIkon } from "./icons";

type Variasi = "utama" | "kedua" | "bahaya" | "sukses" | "halus";
type Ukuran = "sm" | "md" | "lg";

const dasar =
  "inline-flex items-center justify-center gap-2 rounded-control border font-medium " +
  "transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed";

const gayaVariasi: Record<Variasi, string> = {
  utama: "bg-brand text-brand-ink border-brand hover:bg-brand-hover hover:border-brand-hover",
  kedua: "bg-surface text-ink border-line-strong hover:bg-surface-2",
  bahaya: "bg-danger text-white border-danger hover:brightness-95",
  sukses: "bg-ok text-white border-ok hover:brightness-95",
  halus:
    "bg-transparent text-ink-muted border-transparent hover:bg-surface-2 hover:text-ink",
};

// Tinggi minimum 44px pada md dan 52px pada lg: target sentuh yang nyaman ditekan
// dengan ibu jari sambil berdiri di depan sepeda.
const gayaUkuran: Record<Ukuran, string> = {
  sm: "text-sm px-3 py-1.5 min-h-9",
  md: "text-sm px-4 py-2.5 min-h-11",
  lg: "text-base px-5 py-3 min-h-13",
};

const ukuranIkon: Record<Ukuran, string> = {
  sm: "size-4",
  md: "size-[18px]",
  lg: "size-5",
};

type PropsBersama = {
  variasi?: Variasi;
  ukuran?: Ukuran;
  penuh?: boolean;
  ikon?: KomponenIkon;
};

function Isi({
  ikon: IkonTombol,
  ukuran,
  children,
}: {
  ikon?: KomponenIkon;
  ukuran: Ukuran;
  children: React.ReactNode;
}) {
  return (
    <>
      {IkonTombol && (
        <IkonTombol
          className={cn("shrink-0", ukuranIkon[ukuran])}
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      {children}
    </>
  );
}

export function Button({
  variasi = "utama",
  ukuran = "md",
  penuh = false,
  ikon,
  className,
  type = "button",
  children,
  ...props
}: ComponentProps<"button"> & PropsBersama) {
  return (
    <button
      type={type}
      className={cn(
        dasar,
        gayaVariasi[variasi],
        gayaUkuran[ukuran],
        penuh && "w-full",
        className,
      )}
      {...props}
    >
      <Isi ikon={ikon} ukuran={ukuran}>
        {children}
      </Isi>
    </button>
  );
}

export function ButtonLink({
  variasi = "utama",
  ukuran = "md",
  penuh = false,
  ikon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & PropsBersama) {
  return (
    <Link
      className={cn(
        dasar,
        gayaVariasi[variasi],
        gayaUkuran[ukuran],
        penuh && "w-full",
        className,
      )}
      {...props}
    >
      <Isi ikon={ikon} ukuran={ukuran}>
        {children}
      </Isi>
    </Link>
  );
}

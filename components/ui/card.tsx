import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { KomponenIkon } from "./icons";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({
  judul,
  keterangan,
  aksi,
  className,
}: {
  judul: ReactNode;
  keterangan?: ReactNode;
  aksi?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-line px-4 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
          {judul}
        </h3>
        {keterangan && <p className="mt-0.5 text-xs text-ink-muted">{keterangan}</p>}
      </div>
      {aksi && <div className="shrink-0">{aksi}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

/** Baris label–nilai. Dipakai di seluruh kartu rincian supaya bentuknya seragam. */
export function BarisData({
  label,
  children,
  tebal,
}: {
  label: ReactNode;
  children: ReactNode;
  tebal?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right",
          tebal
            ? "text-lg font-semibold tracking-tight text-ink"
            : "text-sm font-medium text-ink",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** Daftar BarisData dengan garis pemisah. */
export function DaftarData({ className, ...props }: ComponentProps<"dl">) {
  return <dl className={cn("divide-y divide-line", className)} {...props} />;
}

/** Keadaan kosong yang menjelaskan langkah berikutnya, bukan layar kosong. */
export function KeadaanKosong({
  ikon: IkonKosong,
  judul,
  keterangan,
  aksi,
}: {
  ikon?: KomponenIkon;
  judul: string;
  keterangan?: string;
  aksi?: ReactNode;
}) {
  return (
    <div role="status" className="px-4 py-12 text-center">
      {IkonKosong && (
        <span
          className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-faint"
          aria-hidden="true"
        >
          <IkonKosong className="size-5" strokeWidth={1.8} />
        </span>
      )}
      <h3 className="text-sm font-semibold text-ink">{judul}</h3>
      {keterangan && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
          {keterangan}
        </p>
      )}
      {aksi && <div className="mt-5 flex justify-center">{aksi}</div>}
    </div>
  );
}

export function PesanGalat({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-control border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
    >
      {children}
    </p>
  );
}

export function PesanBerhasil({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-control border border-ok/25 bg-ok-soft px-3.5 py-2.5 text-sm font-medium text-ok"
    >
      {children}
    </p>
  );
}

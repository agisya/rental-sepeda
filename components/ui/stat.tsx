import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Nada = "netral" | "ok" | "danger" | "warn" | "info" | "idle";

/**
 * Titik warna di depan label. Satu-satunya tempat nada sebuah angka terlihat:
 * angkanya sendiri tetap berwarna teks biasa, supaya deretan kartu tidak
 * berubah jadi pelangi angka yang bersaing satu sama lain. Bahasa titiknya
 * sama dengan lencana status, jadi "Tersedia" hijau di dashboard dan di
 * daftar sepeda terbaca sebagai hal yang sama.
 */
const warnaTitik: Record<Exclude<Nada, "netral">, string> = {
  ok: "bg-ok",
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-info",
  idle: "bg-idle",
};

function Label({ label, nada }: { label: string; nada: Nada }) {
  return (
    <p className="flex items-center gap-2 text-xs font-medium text-ink-muted">
      {nada !== "netral" && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", warnaTitik[nada])}
        />
      )}
      <span className="truncate">{label}</span>
    </p>
  );
}

/**
 * Kartu angka utama, dipakai untuk omzet hari ini. Angkanya sengaja jauh lebih
 * besar dari yang lain karena inilah yang paling sering dicari pemilik usaha.
 *
 * Nada mewarnai angkanya — berbeda dari Stat. Kartu ini selalu berdiri
 * sendiri, jadi warnanya tidak bersaing dengan apa pun; dipakai laba-rugi
 * untuk membedakan untung dari rugi.
 */
export function StatUtama({
  label,
  nilai,
  keterangan,
  nada = "netral",
}: {
  label: string;
  nilai: ReactNode;
  keterangan?: ReactNode;
  nada?: "netral" | "ok" | "danger";
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="label-bagian">{label}</p>
      <p
        className={cn(
          "angka-utama mt-2",
          nada === "ok" ? "text-ok" : nada === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {nilai}
      </p>
      {keterangan && <p className="mt-1.5 text-sm text-ink-muted">{keterangan}</p>}
    </div>
  );
}

/** Kartu angka pendukung. Bisa diklik kalau diberi href. */
export function Stat({
  label,
  nilai,
  keterangan,
  nada = "netral",
  href,
}: {
  label: string;
  nilai: ReactNode;
  keterangan?: string;
  nada?: Nada;
  href?: string;
}) {
  const isi = (
    <>
      <Label label={label} nada={nada} />
      <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink tabular-nums">
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

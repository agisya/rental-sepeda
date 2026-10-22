import type { ReactNode } from "react";
import { Button, ButtonLink } from "./button";
import { Input } from "./field";

/**
 * Pemilih tanggal untuk menyaring daftar, dikirim lewat GET tanpa JavaScript.
 *
 * Dulu ditulis tangan di Transaksi dan Laporan Harian dengan label yang lebih
 * kecil dan lebih pucat daripada label form di tempat lain. Sekarang memakai
 * Input dan Button yang sama dengan seluruh aplikasi.
 */
export function FormTanggal({
  aksi,
  label,
  nilaiAwal,
  maks,
  hrefReset,
  tersembunyi,
}: {
  aksi: string;
  label: string;
  nilaiAwal?: string;
  /** Tanggal terakhir yang boleh dipilih, format YYYY-MM-DD. */
  maks?: string;
  /** Kalau diisi, muncul tautan untuk membuang saringan tanggal. */
  hrefReset?: string;
  /** Parameter lain yang harus ikut terbawa, misalnya saringan status. */
  tersembunyi?: ReactNode;
}) {
  return (
    <form method="get" action={aksi} className="flex flex-wrap items-end gap-2">
      {tersembunyi}
      <div className="min-w-40 flex-1 space-y-1.5">
        <label htmlFor="tanggal" className="block text-sm font-medium text-ink">
          {label}
        </label>
        <Input id="tanggal" type="date" name="tanggal" defaultValue={nilaiAwal} max={maks} />
      </div>
      <Button type="submit" variasi="kedua">
        Tampilkan
      </Button>
      {hrefReset && (
        <ButtonLink href={hrefReset} variasi="halus">
          Reset
        </ButtonLink>
      )}
    </form>
  );
}

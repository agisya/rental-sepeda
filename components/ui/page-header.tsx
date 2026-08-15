import type { ReactNode } from "react";

/**
 * Kepala halaman yang seragam. Sebelumnya tiap halaman menuliskan judul dan
 * keterangannya sendiri dengan ukuran yang berbeda-beda; komponen ini membuat
 * hierarkinya sama di seluruh aplikasi.
 *
 * Judul di sini adalah judul isi halaman. Nama menu yang sedang dibuka sudah
 * ditampilkan di topbar, jadi keduanya tidak diulang persis sama.
 */
export function PageHeader({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: ReactNode;
  aksi?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{judul}</h2>
        {keterangan && (
          <p className="mt-1 text-sm text-ink-muted">{keterangan}</p>
        )}
      </div>
      {aksi && <div className="shrink-0 pt-0.5">{aksi}</div>}
    </div>
  );
}

/** Kelompok isi dengan label kecil di atasnya, dipakai di dashboard dan laporan. */
export function Bagian({
  judul,
  aksi,
  children,
}: {
  judul: string;
  aksi?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="label-bagian">{judul}</h3>
        {aksi}
      </div>
      {children}
    </section>
  );
}

import { ButtonLink } from "./button";
import { Ikon } from "./icons";

type Tautan = { href: string; label: string };

/**
 * Pindah periode laporan: sebelumnya, periode berjalan, berikutnya.
 *
 * Dulu ditulis tangan di tiga halaman (pengeluaran, laporan mingguan, laporan
 * bulanan) dengan kelas yang disalin. Tombol berikutnya boleh tidak ada —
 * periode yang belum terjadi tidak punya isi untuk dilihat — dan tempatnya
 * tetap dijaga supaya tombol tengah tidak bergeser.
 */
export function NavPeriode({
  label,
  sebelumnya,
  sekarang,
  berikutnya,
}: {
  /** Untuk pembaca layar, misalnya "Pindah bulan". */
  label: string;
  sebelumnya: Tautan;
  sekarang: Tautan;
  berikutnya?: Tautan;
}) {
  return (
    <nav aria-label={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <ButtonLink href={sebelumnya.href} variasi="kedua" className="justify-self-start">
        <Ikon.kembali className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        {sebelumnya.label}
      </ButtonLink>

      <ButtonLink href={sekarang.href} variasi="halus">
        {sekarang.label}
      </ButtonLink>

      {berikutnya ? (
        <ButtonLink href={berikutnya.href} variasi="kedua" className="justify-self-end">
          {berikutnya.label}
          <Ikon.lanjut className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        </ButtonLink>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toSVG } from "bwip-js/node";
import { wajibPengguna } from "@/lib/auth/dal";
import { sepedaById } from "@/lib/queries/bikes";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TombolCetak } from "@/components/sepeda/print-button";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Cetak Barcode" };

const JUMLAH_STIKER = 4;

export default async function HalamanBarcode(props: PageProps<"/sepeda/[id]/barcode">) {
  await wajibPengguna();

  const { id } = await props.params;
  const bikeId = Number(id);
  if (!Number.isInteger(bikeId) || bikeId <= 0) notFound();

  const sepeda = await sepedaById(bikeId);
  if (!sepeda) notFound();

  // Code128 dipilih karena mendukung huruf dan angka sekaligus, sehingga kode
  // seperti "MTB-023" bisa dicetak apa adanya tanpa penyandian tambahan.
  const svg = toSVG({
    bcid: "code128",
    text: sepeda.kode,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    textsize: 10,
  });

  return (
    <div className="space-y-4">
      <div className="no-print space-y-4">
        <PageHeader judul="Cetak Barcode" keterangan={`${sepeda.kode} — ${sepeda.nama}`} />

        <p className="rounded-control bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink-muted">
          Tempel stiker di rangka atau stang sepeda pada posisi yang mudah dijangkau
          scanner. Cetak beberapa buah sekaligus sebagai cadangan kalau ada yang rusak.
        </p>

        <div className="flex gap-2">
          <TombolCetak />
          <ButtonLink href={`/sepeda/${bikeId}`} variasi="kedua" className="flex-1">
            Kembali
          </ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: JUMLAH_STIKER }).map((_, i) => (
          <div
            key={i}
            className="break-inside-avoid rounded-card border border-line bg-white p-3 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-black/60">
              Rental Sepeda Garut
            </p>
            <div
              className="mx-auto mt-1 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
              // SVG dihasilkan di server dari kode sepeda sendiri, bukan dari
              // masukan bebas pengguna.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="mt-1 truncate text-[11px] font-medium text-black">
              {sepeda.nama}
            </p>
            <p className="text-[10px] text-black/60">{rupiah(sepeda.tarifPerJam)}/jam</p>
          </div>
        ))}
      </div>
    </div>
  );
}

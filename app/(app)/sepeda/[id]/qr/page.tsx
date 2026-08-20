import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toSVG } from "bwip-js/node";
import { wajibPengguna } from "@/lib/auth/dal";
import { sepedaById } from "@/lib/queries/bikes";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TombolCetak } from "@/components/sepeda/print-button";
import { OPSI_QR } from "@/lib/qr";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Cetak QR" };

const JUMLAH_STIKER = 4;

export default async function HalamanQr(props: PageProps<"/sepeda/[id]/qr">) {
  await wajibPengguna();

  const { id } = await props.params;
  const bikeId = Number(id);
  if (!Number.isInteger(bikeId) || bikeId <= 0) notFound();

  const sepeda = await sepedaById(bikeId);
  if (!sepeda) notFound();

  // Pilihan penyandiannya ada di lib/qr.ts, satu tempat dengan yang dipakai uji
  // baca-ulang. Kodenya masuk apa adanya, bukan sebagai tautan: stiker ini
  // menempel bertahun-tahun di rangka sepeda, dan alamat yang tertanam di
  // dalamnya akan mati lebih dulu daripada stikernya.
  const svg = toSVG({ ...OPSI_QR, text: sepeda.kode, scale: 4 });

  return (
    <div className="space-y-4">
      <div className="no-print space-y-4">
        <PageHeader judul="Cetak QR" keterangan={`${sepeda.kode} — ${sepeda.nama}`} />

        <p className="rounded-control bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink-muted">
          Tempel stiker di rangka atau stang sepeda pada posisi yang mudah dijangkau
          kamera. Cetak beberapa buah sekaligus sebagai cadangan kalau ada yang rusak.
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
            {/* Selebar kartu, bukan tiga perempatnya. Zona sunyi sekarang ikut
                di dalam SVG dan memakan sekitar seperempat lebarnya, jadi modul
                QR-nya tetap sebesar sebelumnya — yang berubah hanya siapa yang
                menyediakan ruang putih itu, dan kini ia tidak bisa hilang gara-
                gara tata letak. */}
            <div
              className="mt-1 w-full [&_svg]:h-auto [&_svg]:w-full"
              // SVG dihasilkan di server dari kode sepeda sendiri, bukan dari
              // masukan bebas pengguna.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {/* Kodenya dicetak sebagai teks biasa, bukan diserahkan ke bwip-js.
                QR tidak menyediakan baris teks bawaan seperti barcode garis, dan
                menuliskannya sendiri membuat hurufnya seragam dengan nama dan
                tarif di bawahnya. Teks ini juga yang dibaca petugas saat stiker
                sudah terlalu rusak untuk dipindai. */}
            <p className="mt-1 font-mono text-[11px] font-semibold tracking-wide text-black">
              {sepeda.kode}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-black">
              {sepeda.nama}
            </p>
            <p className="text-[10px] text-black/60">{rupiah(sepeda.tarifPerJam)}/jam</p>
          </div>
        ))}
      </div>
    </div>
  );
}

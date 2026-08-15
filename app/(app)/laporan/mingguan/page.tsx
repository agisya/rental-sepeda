import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { laporanPeriode, penggunaanSepeda } from "@/lib/queries/laporan";
import { bagiHasilSemuaPemilik } from "@/lib/queries/rentals";
import { Card, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { RingkasanPeriodeLaporan } from "@/components/laporan/ringkasan-periode";
import { rupiah } from "@/lib/format";
import {
  dariKunciTanggalWib,
  formatRentangTanggalWib,
  kunciTanggalWib,
  rentangMingguWib,
} from "@/lib/waktu";
import Link from "next/link";

export const metadata: Metadata = { title: "Laporan Mingguan" };

const SEMINGGU = 7 * 24 * 60 * 60 * 1000;

export default async function HalamanLaporanMingguan(
  props: PageProps<"/laporan/mingguan">,
) {
  await wajibPengguna();
  const params = await props.searchParams;

  const sekarang = new Date();
  const acuan =
    (typeof params.tanggal === "string" ? dariKunciTanggalWib(params.tanggal) : null) ??
    sekarang;
  const rentang = rentangMingguWib(acuan);

  const [laporan, penggunaan, perPemilik] = await Promise.all([
    laporanPeriode(rentang),
    penggunaanSepeda(rentang),
    bagiHasilSemuaPemilik(rentang),
  ]);

  const mingguLalu = kunciTanggalWib(new Date(rentang.mulai.getTime() - SEMINGGU));
  const mingguDepan = kunciTanggalWib(new Date(rentang.mulai.getTime() + SEMINGGU));
  // Tombol "minggu depan" disembunyikan begitu periodenya melewati minggu berjalan,
  // supaya petugas tidak menelusuri minggu-minggu kosong yang belum terjadi.
  const belumTiba = rentang.selesai.getTime() > sekarang.getTime() + SEMINGGU;

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Laporan Mingguan"
        keterangan={formatRentangTanggalWib(rentang.mulai, rentang.selesai)}
      />

      <nav className="flex items-center justify-between gap-2" aria-label="Pindah minggu">
        <Link
          href={`/laporan/mingguan?tanggal=${mingguLalu}`}
          className="flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          ← Minggu lalu
        </Link>
        <Link
          href="/laporan/mingguan"
          className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-muted hover:text-ink"
        >
          Minggu ini
        </Link>
        {!belumTiba ? (
          <Link
            href={`/laporan/mingguan?tanggal=${mingguDepan}`}
            className="flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
          >
            Minggu depan →
          </Link>
        ) : (
          <span className="min-h-11" />
        )}
      </nav>

      <RingkasanPeriodeLaporan
        laporan={laporan}
        penggunaan={penggunaan}
        judulPenggunaan="Penggunaan sepeda"
      />

      <Card>
        <CardHeader
          judul="Bagi hasil per pemilik"
          keterangan="Bagian pemilik dari rental yang selesai pada minggu ini"
        />
        {perPemilik.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.pemilik}
            judul="Belum ada bagi hasil"
            keterangan="Angka muncul setelah ada rental yang diselesaikan pada minggu ini."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="label-bagian px-4 py-2.5">
                    Pemilik
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Rental
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Omzet
                  </th>
                  <th scope="col" className="label-bagian px-4 py-2.5 text-right">
                    Bagian pemilik
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perPemilik.map((p) => (
                  <tr key={p.ownerId} className="transition-colors hover:bg-surface-2">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <Link
                        href={`/pemilik/${p.ownerId}`}
                        className="font-medium text-brand underline-offset-2 hover:underline"
                      >
                        {p.namaPemilik}
                      </Link>
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-muted">
                      {p.jumlahRental}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-muted">
                      {rupiah(p.omzetKotor)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                      {rupiah(p.bagianPemilik)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

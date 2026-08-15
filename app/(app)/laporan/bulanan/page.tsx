import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import {
  laporanPeriode,
  penggunaanSepeda,
  sepedaTidakDipakai,
} from "@/lib/queries/laporan";
import { bagiHasilSemuaPemilik } from "@/lib/queries/rentals";
import { Card, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { RingkasanPeriodeLaporan } from "@/components/laporan/ringkasan-periode";
import { rupiah } from "@/lib/format";
import {
  dariKunciBulanWib,
  formatBulanWib,
  kunciBulanWib,
  rentangBulanWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Laporan Bulanan" };

export default async function HalamanLaporanBulanan(
  props: PageProps<"/laporan/bulanan">,
) {
  await wajibPengguna();
  const params = await props.searchParams;

  const acuan =
    (typeof params.bulan === "string" ? dariKunciBulanWib(params.bulan) : null) ??
    new Date();
  const rentang = rentangBulanWib(acuan);

  const [laporan, penggunaan, tidakDipakai, perPemilik] = await Promise.all([
    laporanPeriode(rentang),
    penggunaanSepeda(rentang),
    sepedaTidakDipakai(rentang),
    bagiHasilSemuaPemilik(rentang),
  ]);

  const bulanLalu = kunciBulanWib(new Date(rentang.mulai.getTime() - 24 * 60 * 60 * 1000));
  const bulanDepan = kunciBulanWib(
    new Date(rentang.selesai.getTime() + 24 * 60 * 60 * 1000),
  );
  const bulanIni = kunciBulanWib(new Date());
  const sudahBulanIni = kunciBulanWib(rentang.mulai) === bulanIni;

  return (
    <div className="space-y-5">
      <PageHeader judul="Laporan Bulanan" keterangan={formatBulanWib(rentang.mulai)} />

      <nav className="flex items-center justify-between gap-2" aria-label="Pindah bulan">
        <Link
          href={`/laporan/bulanan?bulan=${bulanLalu}`}
          className="flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          ← Bulan lalu
        </Link>
        <Link
          href="/laporan/bulanan"
          className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-muted hover:text-ink"
        >
          Bulan ini
        </Link>
        {!sudahBulanIni ? (
          <Link
            href={`/laporan/bulanan?bulan=${bulanDepan}`}
            className="flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
          >
            Bulan depan →
          </Link>
        ) : (
          <span className="min-h-11" />
        )}
      </nav>

      <RingkasanPeriodeLaporan
        laporan={laporan}
        penggunaan={penggunaan}
        judulPenggunaan="Top 10 sepeda"
        batasPenggunaan={10}
      />

      <Card>
        <CardHeader
          judul="Bagi hasil per pemilik"
          keterangan="Diurutkan dari omzet terbesar"
        />
        {perPemilik.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.pemilik}
            judul="Belum ada bagi hasil"
            keterangan="Angka muncul setelah ada rental yang diselesaikan pada bulan ini."
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
                    Jam
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
                      {p.totalJam}
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

      <Card>
        <CardHeader
          judul={`Sepeda tidak terpakai · ${tidakDipakai.length}`}
          keterangan="Sama sekali tidak disewakan pada bulan ini"
        />
        {tidakDipakai.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.selesai}
            judul="Semua sepeda terpakai"
            keterangan="Tidak ada satu pun sepeda yang menganggur sepanjang bulan ini."
          />
        ) : (
          <ul className="divide-y divide-line">
            {tidakDipakai.map((s) => (
              <li key={s.bikeId}>
                <Link
                  href={`/sepeda/${s.bikeId}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs tracking-wider text-ink-muted">
                      {s.kode}
                    </p>
                    <p className="truncate text-sm font-medium text-ink">{s.nama}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">{s.namaPemilik}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

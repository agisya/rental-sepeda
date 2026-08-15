import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import {
  bagiHasilSemuaPemilik,
  daftarTransaksi,
  ringkasanPeriode,
} from "@/lib/queries/rentals";
import {
  BarisData,
  Card,
  CardHeader,
  DaftarData,
  KeadaanKosong,
} from "@/components/ui/card";
import { Stat, StatUtama } from "@/components/ui/stat";
import { StatusRentalBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import {
  dariKunciTanggalWib,
  formatHariTanggalWib,
  formatJamWib,
  kunciTanggalWib,
  rentangHariWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Laporan Harian" };

export default async function HalamanLaporanHarian(
  props: PageProps<"/laporan/harian">,
) {
  await wajibPengguna();
  const params = await props.searchParams;

  const kunciHariIni = kunciTanggalWib(new Date());
  const kunci = typeof params.tanggal === "string" ? params.tanggal : kunciHariIni;
  const tanggal = dariKunciTanggalWib(kunci) ?? new Date();
  const rentang = rentangHariWib(tanggal);

  const [ringkasan, perPemilik, transaksi] = await Promise.all([
    ringkasanPeriode(rentang),
    bagiHasilSemuaPemilik(rentang),
    daftarTransaksi({ rentang, batas: 200 }),
  ]);

  const rataRataPerTransaksi =
    ringkasan.jumlahTransaksi > 0
      ? Math.round(ringkasan.totalOmzet / ringkasan.jumlahTransaksi)
      : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Laporan Harian"
        keterangan={formatHariTanggalWib(tanggal)}
      />

      <form method="get" action="/laporan/harian" className="flex items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="tanggal" className="block text-xs font-medium text-ink-muted">
            Pilih tanggal
          </label>
          <input
            id="tanggal"
            type="date"
            name="tanggal"
            defaultValue={kunci}
            max={kunciHariIni}
            className="mt-1 min-h-11 w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-base text-ink"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          Tampilkan
        </button>
      </form>

      <StatUtama
        label="Omzet"
        nilai={rupiah(ringkasan.totalOmzet)}
        keterangan={
          ringkasan.jumlahTransaksi === 0
            ? "Belum ada rental yang diselesaikan pada tanggal ini"
            : `${ringkasan.jumlahTransaksi} transaksi · rata-rata ${rupiah(rataRataPerTransaksi)} per transaksi`
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Transaksi" ikon={Ikon.transaksi} nilai={ringkasan.jumlahTransaksi} />
        <Stat
          label="Sepeda dipakai"
          ikon={Ikon.sepeda}
          nilai={ringkasan.jumlahSepedaDipakai}
        />
        <Stat label="Total jam" ikon={Ikon.jam} nilai={`${ringkasan.totalJam} jam`} />
        <Stat
          label="Bagian rental"
          ikon={Ikon.uang}
          nilai={rupiah(ringkasan.totalBagianRental)}
        />
      </div>

      <Card>
        <CardHeader
          judul="Pembagian omzet"
          keterangan="Hanya menghitung rental yang sudah diselesaikan pada tanggal ini"
        />
        <DaftarData>
          <BarisData label="Omzet kotor" tebal>
            {rupiah(ringkasan.totalOmzet)}
          </BarisData>
          <BarisData label="Bagian pemilik sepeda">
            {rupiah(ringkasan.totalBagianPemilik)}
          </BarisData>
          <BarisData label="Bagian Rental Sepeda Garut">
            {rupiah(ringkasan.totalBagianRental)}
          </BarisData>
        </DaftarData>
      </Card>

      <Card>
        <CardHeader judul="Bagi hasil per pemilik" />
        {perPemilik.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.pemilik}
            judul="Belum ada rental selesai"
            keterangan="Angka bagi hasil muncul setelah ada rental yang diselesaikan pada tanggal ini."
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
          judul={`Transaksi · ${transaksi.length}`}
          keterangan="Dikelompokkan menurut jam sepeda dibawa keluar"
        />
        {transaksi.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.transaksi}
            judul="Tidak ada transaksi"
            keterangan="Belum ada sepeda yang disewakan pada tanggal ini."
          />
        ) : (
          <ul className="divide-y divide-line">
            {transaksi.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/transaksi/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {r.kodeSepeda} — {r.namaPenyewa}
                    </p>
                    <p className="text-xs tabular-nums text-ink-muted">
                      {formatJamWib(r.waktuMulai)}
                      {r.waktuSelesai && ` – ${formatJamWib(r.waktuSelesai)}`}
                      {r.durasiJamDitagih !== null && ` · ${r.durasiJamDitagih} jam`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {r.totalBiaya === null ? "—" : rupiah(r.totalBiaya)}
                    </p>
                    <StatusRentalBadge status={r.status} className="mt-1" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

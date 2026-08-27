import Link from "next/link";
import type { LaporanPeriode, PenggunaanSepeda } from "@/lib/queries/laporan";
import { BarisData, Card, CardHeader, DaftarData, KeadaanKosong } from "@/components/ui/card";
import { Stat, StatUtama } from "@/components/ui/stat";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import { formatTanggalWib, namaHariWib } from "@/lib/waktu";

/**
 * Isi laporan mingguan dan bulanan.
 *
 * Keduanya memakai komponen yang sama supaya angka untuk periode yang sama
 * tidak mungkin berbeda antar halaman; yang berbeda hanya rentangnya.
 */
export function RingkasanPeriodeLaporan({
  laporan,
  penggunaan,
  judulPenggunaan,
  batasPenggunaan,
  namaUsaha,
}: {
  laporan: LaporanPeriode;
  penggunaan: PenggunaanSepeda[];
  judulPenggunaan: string;
  batasPenggunaan?: number;
  /** Diterima sebagai prop, bukan dibaca sendiri, supaya komponen ini tetap murni. */
  namaUsaha: string;
}) {
  const { ringkasan, perHari } = laporan;
  const terpakai = batasPenggunaan ? penggunaan.slice(0, batasPenggunaan) : penggunaan;
  const paling = penggunaan[0];
  const paling_rendah = penggunaan[penggunaan.length - 1];

  return (
    <div className="space-y-5">
      <StatUtama
        label="Omzet"
        nilai={rupiah(ringkasan.totalOmzet)}
        keterangan={
          ringkasan.jumlahTransaksi === 0
            ? "Belum ada rental yang diselesaikan pada periode ini"
            : `${ringkasan.jumlahTransaksi} transaksi · rata-rata ${rupiah(laporan.rataRataOmzetPerHari)} per hari`
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
        <CardHeader judul="Pembagian omzet" />
        <DaftarData>
          <BarisData label="Omzet kotor" tebal>
            {rupiah(ringkasan.totalOmzet)}
          </BarisData>
          <BarisData label="Bagian pemilik sepeda">
            {rupiah(ringkasan.totalBagianPemilik)}
          </BarisData>
          <BarisData label={`Bagian ${namaUsaha}`}>
            {rupiah(ringkasan.totalBagianRental)}
          </BarisData>
          <BarisData label="Rata-rata omzet per hari">
            {rupiah(laporan.rataRataOmzetPerHari)}
          </BarisData>
        </DaftarData>
      </Card>

      {(laporan.hariTeramai || laporan.hariTersepi) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {laporan.hariTeramai && (
            <Card>
              <div className="p-4">
                <p className="label-bagian">Hari paling ramai</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  {namaHariWib(new Date(laporan.hariTeramai.tanggal + "T05:00:00Z"))},{" "}
                  {formatTanggalWib(new Date(laporan.hariTeramai.tanggal + "T05:00:00Z"))}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {rupiah(laporan.hariTeramai.totalOmzet)} ·{" "}
                  {laporan.hariTeramai.jumlahTransaksi} transaksi
                </p>
              </div>
            </Card>
          )}

          {laporan.hariTersepi && (
            <Card>
              <div className="p-4">
                <p className="label-bagian">Hari paling sepi</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  {namaHariWib(new Date(laporan.hariTersepi.tanggal + "T05:00:00Z"))},{" "}
                  {formatTanggalWib(new Date(laporan.hariTersepi.tanggal + "T05:00:00Z"))}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {rupiah(laporan.hariTersepi.totalOmzet)} ·{" "}
                  {laporan.hariTersepi.jumlahTransaksi} transaksi
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Hanya menghitung hari yang ada transaksinya.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader judul={judulPenggunaan} keterangan="Diurutkan dari omzet terbesar" />
        {terpakai.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.sepeda}
            judul="Belum ada sepeda yang dipakai"
            keterangan="Angka muncul setelah ada rental yang diselesaikan pada periode ini."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="label-bagian px-4 py-2.5">
                    Sepeda
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Rental
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Jam
                  </th>
                  <th scope="col" className="label-bagian px-4 py-2.5 text-right">
                    Omzet
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {terpakai.map((s, i) => (
                  <tr key={s.bikeId} className="transition-colors hover:bg-surface-2">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="flex items-center gap-2">
                        {batasPenggunaan && i < 3 && (
                          <Ikon.juara
                            className="size-3.5 shrink-0 text-warn"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        )}
                        <Link
                          href={`/sepeda/${s.bikeId}`}
                          className="font-medium text-brand underline-offset-2 hover:underline"
                        >
                          {s.kode}
                        </Link>
                        <span className="truncate text-ink-muted">{s.nama}</span>
                      </span>
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-muted">
                      {s.jumlahRental}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-muted">
                      {s.totalJam}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                      {rupiah(s.totalOmzet)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paling && paling_rendah && penggunaan.length > 1 && (
          <div className="grid gap-1 border-t border-line px-4 py-3 text-xs text-ink-muted sm:grid-cols-2">
            <p>
              Paling produktif: <span className="font-medium text-ink">{paling.kode}</span>{" "}
              ({rupiah(paling.totalOmzet)})
            </p>
            <p>
              Paling rendah:{" "}
              <span className="font-medium text-ink">{paling_rendah.kode}</span> (
              {rupiah(paling_rendah.totalOmzet)})
            </p>
          </div>
        )}
      </Card>

      {perHari.length > 0 && (
        <Card>
          <CardHeader judul="Rincian per hari" />
          <ul className="divide-y divide-line">
            {perHari.map((h) => {
              const tanggal = new Date(h.tanggal + "T05:00:00Z");
              return (
                <li
                  key={h.tanggal}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {namaHariWib(tanggal)}, {formatTanggalWib(tanggal)}
                    </p>
                    <p className="text-xs tabular-nums text-ink-muted">
                      {h.jumlahTransaksi} transaksi · {h.totalJam} jam
                    </p>
                  </div>
                  <Link
                    href={`/laporan/harian?tanggal=${h.tanggal}`}
                    className="shrink-0 text-sm font-semibold tabular-nums text-brand underline-offset-2 hover:underline"
                  >
                    {rupiah(h.totalOmzet)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

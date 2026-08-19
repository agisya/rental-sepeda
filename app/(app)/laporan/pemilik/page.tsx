import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarPembayaranPemilik, saldoSemuaPemilik } from "@/lib/queries/keuangan";
import {
  Card,
  CardBody,
  CardHeader,
  KeadaanKosong,
  PesanBerhasil,
} from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { FormPembayaranPemilik } from "@/components/keuangan/form-pembayaran";
import { rupiah } from "@/lib/format";
import { formatTanggalWib, kunciTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Laporan Pemilik" };

const LABEL_METODE = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" } as const;

export default async function HalamanLaporanPemilik(
  props: PageProps<"/laporan/pemilik">,
) {
  const pengguna = await wajibPengguna();
  const params = await props.searchParams;

  const pemilikTerpilih =
    typeof params.pemilik === "string" ? Number(params.pemilik) : undefined;

  const [saldo, pembayaran] = await Promise.all([
    saldoSemuaPemilik(),
    daftarPembayaranPemilik(undefined, 50),
  ]);

  const totalHak = saldo.reduce((n, s) => n + s.totalHak, 0);
  const totalDibayar = saldo.reduce((n, s) => n + s.sudahDibayar, 0);
  const totalSisa = totalHak - totalDibayar;
  const bolehCatat = pengguna.peran !== "kasir";

  return (
    <div className="space-y-5">
      {params.tersimpan === "1" && (
        <PesanBerhasil>Pembayaran ke pemilik berhasil dicatat.</PesanBerhasil>
      )}

      <PageHeader
        judul="Laporan Pemilik"
        keterangan="Bagi hasil dan setoran, dihitung sejak awal sampai hari ini"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total hak pemilik" ikon={Ikon.pemilik} nilai={rupiah(totalHak)} />
        <Stat
          label="Sudah dibayar"
          ikon={Ikon.selesai}
          nada="ok"
          nilai={rupiah(totalDibayar)}
        />
        <Stat
          label="Sisa harus dibayar"
          ikon={Ikon.uang}
          nada={totalSisa > 0 ? "danger" : "ok"}
          nilai={rupiah(totalSisa)}
        />
      </div>

      <Card>
        <CardHeader
          judul="Saldo per pemilik"
          keterangan="Sisa adalah total hak dikurangi seluruh setoran yang pernah dicatat"
        />
        {saldo.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.pemilik}
            judul="Belum ada pemilik"
            keterangan="Tambahkan pemilik sepeda lebih dulu di menu Data Pemilik."
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
                    Total hak
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Sudah dibayar
                  </th>
                  <th scope="col" className="label-bagian px-4 py-2.5 text-right">
                    Sisa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {saldo.map((s) => (
                  <tr key={s.ownerId} className="transition-colors hover:bg-surface-2">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <Link
                        href={`/pemilik/${s.ownerId}`}
                        className="font-medium text-brand underline-offset-2 hover:underline"
                      >
                        {s.nama}
                      </Link>
                      <span className="ml-1.5 text-xs text-ink-muted">
                        ({s.persentaseBagiHasil}%)
                      </span>
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums text-ink-muted">
                      {rupiah(s.totalHak)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-ok">
                      {rupiah(s.sudahDibayar)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        s.sisa > 0 ? "text-danger" : "text-ink-muted"
                      }`}
                    >
                      {rupiah(s.sisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {bolehCatat && saldo.length > 0 && (
        <Card>
          <CardHeader
            judul="Catat setoran ke pemilik"
            keterangan="Jumlah tidak boleh melebihi sisa yang harus dibayar"
          />
          <CardBody>
            <FormPembayaranPemilik
              pemilik={saldo.map((s) => ({ id: s.ownerId, nama: s.nama, sisa: s.sisa }))}
              tanggalHariIni={kunciTanggalWib(new Date())}
              pemilikAwal={pemilikTerpilih}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          judul={`Riwayat setoran · ${pembayaran.length}`}
          keterangan="50 setoran terakhir"
        />
        {pembayaran.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.uang}
            judul="Belum ada setoran"
            keterangan="Setoran yang sudah diberikan ke pemilik akan tercatat di sini."
          />
        ) : (
          <ul className="divide-y divide-line">
            {pembayaran.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{p.namaPemilik}</p>
                  <p className="text-xs tabular-nums text-ink-muted">
                    {formatTanggalWib(p.tanggal)} · {LABEL_METODE[p.metode]} · dicatat{" "}
                    {p.namaPetugas}
                  </p>
                  {p.catatan && (
                    <p className="mt-0.5 truncate text-xs text-ink-faint">{p.catatan}</p>
                  )}
                </div>

                {/* Tidak ada tombol hapus. Setoran ke pemilik sepeda adalah
                    bukti uang yang sudah berpindah tangan — kalau barisnya bisa
                    dihilangkan, pemilik tidak punya apa pun untuk dipegang saat
                    jumlahnya dipersoalkan. */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums text-ink">
                    {rupiah(p.jumlah)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

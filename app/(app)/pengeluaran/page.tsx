import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import {
  LABEL_KATEGORI,
  daftarPengeluaran,
  pengeluaranPerKategori,
  totalPengeluaran,
} from "@/lib/queries/keuangan";
import { Card, CardBody, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { FormPengeluaran } from "@/components/keuangan/form-pengeluaran";
import { rupiah } from "@/lib/format";
import {
  dariKunciBulanWib,
  formatBulanWib,
  formatTanggalWib,
  kunciBulanWib,
  kunciTanggalWib,
  rentangBulanWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Pengeluaran" };

export default async function HalamanPengeluaran(props: PageProps<"/pengeluaran">) {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/dashboard");

  const params = await props.searchParams;
  const acuan =
    (typeof params.bulan === "string" ? dariKunciBulanWib(params.bulan) : null) ??
    new Date();
  const rentang = rentangBulanWib(acuan);

  const [daftar, perKategori, total] = await Promise.all([
    daftarPengeluaran({ rentang, batas: 200 }),
    pengeluaranPerKategori(rentang),
    totalPengeluaran(rentang),
  ]);

  const bulanLalu = kunciBulanWib(new Date(rentang.mulai.getTime() - 24 * 60 * 60 * 1000));
  const bulanIni = kunciBulanWib(new Date());
  const sudahBulanIni = kunciBulanWib(rentang.mulai) === bulanIni;
  const bulanDepan = kunciBulanWib(
    new Date(rentang.selesai.getTime() + 24 * 60 * 60 * 1000),
  );

  return (
    <div className="space-y-5">
      <PageHeader judul="Pengeluaran" keterangan={formatBulanWib(rentang.mulai)} />

      <nav className="flex items-center justify-between gap-2" aria-label="Pindah bulan">
        <Link
          href={`/pengeluaran?bulan=${bulanLalu}`}
          className="flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          ← Bulan lalu
        </Link>
        <Link
          href="/pengeluaran"
          className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-muted hover:text-ink"
        >
          Bulan ini
        </Link>
        {!sudahBulanIni ? (
          <Link
            href={`/pengeluaran?bulan=${bulanDepan}`}
            className="flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
          >
            Bulan depan →
          </Link>
        ) : (
          <span className="min-h-11" />
        )}
      </nav>

      <Stat
        label="Total pengeluaran bulan ini"
        ikon={Ikon.pengeluaran}
        nada="danger"
        nilai={rupiah(total)}
        keterangan={`${daftar.length} catatan`}
      />

      {perKategori.length > 0 && (
        <Card>
          <CardHeader judul="Per kategori" />
          <ul className="divide-y divide-line">
            {perKategori.map((k) => (
              <li
                key={k.kategori}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="text-sm text-ink">{LABEL_KATEGORI[k.kategori]}</span>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {rupiah(k.jumlah)}
                  <span className="ml-1.5 font-normal text-ink-faint">({k.banyak})</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          judul="Catat pengeluaran"
          keterangan="Biaya maintenance dicatat dari menu Maintenance supaya tidak terhitung dua kali"
        />
        <CardBody>
          <FormPengeluaran tanggalHariIni={kunciTanggalWib(new Date())} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader judul={`Rincian · ${daftar.length}`} />
        {daftar.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.pengeluaran}
            judul="Belum ada pengeluaran"
            keterangan="Catat gaji, listrik, PDAM, dan biaya operasional lainnya di sini."
          />
        ) : (
          <ul className="divide-y divide-line">
            {daftar.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{p.keterangan}</p>
                  <p className="text-xs tabular-nums text-ink-muted">
                    {formatTanggalWib(p.tanggal)} · {LABEL_KATEGORI[p.kategori]} ·{" "}
                    {p.namaPetugas}
                  </p>
                  {p.maintenanceId && (
                    <Link
                      href="/maintenance"
                      className="mt-0.5 inline-block text-xs text-brand underline-offset-2 hover:underline"
                    >
                      Dari catatan maintenance
                    </Link>
                  )}
                </div>

                {/* Tidak ada tombol hapus, dan itu disengaja. Riwayat
                    pengeluaran adalah catatan uang; baris yang bisa lenyap
                    membuat seluruh pembukuan kehilangan gunanya sebagai
                    pertanggungjawaban. Salah catat diperbaiki dengan mencatat
                    koreksinya, bukan dengan menghilangkan jejaknya. */}
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

import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { ringkasanDashboard, rentalTerlaluLama } from "@/lib/queries/dashboard";
import { daftarRentalBerjalan } from "@/lib/queries/rentals";
import { Card, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Stat, StatUtama } from "@/components/ui/stat";
import { Bagian, PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { rupiah } from "@/lib/format";
import { formatHariTanggalWib, formatJamWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Dashboard" };

const BATAS_JAM_MENCURIGAKAN = 12;

export default async function HalamanDashboard() {
  const pengguna = await wajibPengguna();
  const sekarang = new Date();

  const [ringkasan, berjalan, terlaluLama] = await Promise.all([
    ringkasanDashboard(sekarang),
    daftarRentalBerjalan(),
    rentalTerlaluLama(BATAS_JAM_MENCURIGAKAN, sekarang),
  ]);

  return (
    <div className="space-y-6">
      <AutoRefresh detik={60} />

      <PageHeader
        judul={`Halo, ${pengguna.nama.split(" ")[0]}`}
        keterangan={formatHariTanggalWib(sekarang)}
      />

      {/* Aksi utama sengaja besar dan paling atas: inilah yang ditekan puluhan
          kali sehari, sering sambil berdiri memegang sepeda. */}
      <ButtonLink href="/scan" ukuran="lg" penuh ikon={Ikon.scan}>
        Scan Barcode Sepeda
      </ButtonLink>

      <Bagian judul="Hari ini">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <StatUtama
              label="Omzet hari ini"
              nilai={rupiah(ringkasan.hariIni.totalOmzet)}
              keterangan={
                ringkasan.hariIni.jumlahTransaksi === 0
                  ? "Belum ada rental yang diselesaikan"
                  : `${ringkasan.hariIni.jumlahTransaksi} transaksi · ${ringkasan.hariIni.totalJam} jam · ${ringkasan.hariIni.jumlahSepedaDipakai} sepeda dipakai`
              }
            />
          </div>

          <Stat
            label="Bagian pemilik"
            ikon={Ikon.pemilik}
            nilai={rupiah(ringkasan.hariIni.totalBagianPemilik)}
          />
          <Stat
            label="Bagian rental"
            ikon={Ikon.uang}
            nilai={rupiah(ringkasan.hariIni.totalBagianRental)}
          />
          <Stat
            label="Total jam"
            ikon={Ikon.jam}
            nilai={`${ringkasan.hariIni.totalJam} jam`}
            keterangan="jam yang ditagihkan"
          />
        </div>
      </Bagian>

      <Bagian
        judul={`Armada · ${ringkasan.status.total} sepeda`}
        aksi={
          <Link
            href="/sepeda"
            className="text-sm font-medium text-brand underline-offset-2 hover:underline"
          >
            Lihat semua
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat
            label="Tersedia"
            ikon={Ikon.sepeda}
            nada="ok"
            nilai={ringkasan.status.tersedia}
            href="/sepeda?status=tersedia"
          />
          <Stat
            label="Sedang disewa"
            ikon={Ikon.transaksi}
            nada="danger"
            nilai={ringkasan.status.disewa}
            href="/sepeda?status=disewa"
          />
          {/* Booking dihitung dari tabel booking, bukan dari status sepeda: satu
              sepeda bisa punya beberapa booking pada jam yang berbeda. */}
          <Stat
            label="Booking"
            ikon={Ikon.booking}
            nada="warn"
            nilai={ringkasan.bookingAktif}
            href="/booking?status=booking"
          />
          <Stat
            label="Servis"
            ikon={Ikon.servis}
            nada="info"
            nilai={ringkasan.status.servis}
            href="/sepeda?status=servis"
          />
          <Stat
            label="Tidak aktif"
            ikon={Ikon.nonaktif}
            nilai={ringkasan.status.nonaktif}
            href="/sepeda?status=nonaktif"
          />
        </div>
      </Bagian>

      {terlaluLama.length > 0 && (
        <Card className="border-warn/40 bg-warn-soft/40">
          <CardHeader
            className="border-warn/25"
            judul={
              <span className="flex items-center gap-2 text-warn">
                <Ikon.peringatan className="size-4" strokeWidth={2.2} aria-hidden="true" />
                {terlaluLama.length} sepeda belum kembali
              </span>
            }
            keterangan={`Sudah lebih dari ${BATAS_JAM_MENCURIGAKAN} jam sejak dicatat keluar`}
          />
          <ul className="divide-y divide-warn/20">
            {terlaluLama.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {r.kodeSepeda} — {r.namaSepeda}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {r.namaPenyewa} · sejak {formatJamWib(r.waktuMulai)}
                  </p>
                </div>
                <a
                  href={`tel:${r.noHpPenyewa}`}
                  aria-label={`Telepon ${r.namaPenyewa}`}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-2"
                >
                  <Ikon.telepon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  Telepon
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Bagian
        judul={`Sedang berjalan · ${berjalan.length}`}
        aksi={
          <Link
            href="/transaksi"
            className="text-sm font-medium text-brand underline-offset-2 hover:underline"
          >
            Semua transaksi
          </Link>
        }
      >
        <Card>
          {berjalan.length === 0 ? (
            <KeadaanKosong
              ikon={Ikon.sepeda}
              judul="Tidak ada rental berjalan"
              keterangan="Semua sepeda sedang berada di tempat."
            />
          ) : (
            <ul className="divide-y divide-line">
              {berjalan.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/scan?kode=${encodeURIComponent(r.kodeSepeda)}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.kodeSepeda} — {r.namaSepeda}
                      </p>
                      <p className="truncate text-xs text-ink-muted">{r.namaPenyewa}</p>
                    </div>
                    <p className="shrink-0 text-xs tabular-nums text-ink-muted">
                      sejak {formatJamWib(r.waktuMulai)}
                    </p>
                    <Ikon.lanjut
                      className="size-4 shrink-0 text-ink-faint"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Bagian>
    </div>
  );
}

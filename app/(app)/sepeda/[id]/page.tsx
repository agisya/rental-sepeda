import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { sepedaById, statistikBulananSepeda } from "@/lib/queries/bikes";
import { daftarTransaksi, rentalBerjalanUntukSepeda } from "@/lib/queries/rentals";
import { Card, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BikeCard } from "@/components/rental/bike-card";
import { StatusRentalBadge } from "@/components/ui/status-badge";
import { Ikon } from "@/components/ui/icons";
import { TombolKontak } from "@/components/ui/tombol-kontak";
import { pesanWa } from "@/lib/kontak";
import { rupiah } from "@/lib/format";
import { formatJamWib, formatTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Detail Sepeda" };

export default async function HalamanDetailSepeda(props: PageProps<"/sepeda/[id]">) {
  const pengguna = await wajibPengguna();
  const { id } = await props.params;
  const bikeId = Number(id);
  if (!Number.isInteger(bikeId) || bikeId <= 0) notFound();

  const sepeda = await sepedaById(bikeId);
  if (!sepeda) notFound();

  const [statistik, rentalBerjalan, riwayatSepeda] = await Promise.all([
    statistikBulananSepeda(bikeId),
    rentalBerjalanUntukSepeda(bikeId),
    daftarTransaksi({ bikeId, batas: 10 }),
  ]);

  const bolehKelola = pengguna.peran !== "kasir";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={`/scan?kode=${encodeURIComponent(sepeda.kode)}`}
          ukuran="sm"
          ikon={Ikon.scan}
        >
          Buka di Scan
        </ButtonLink>
        <ButtonLink
          href={`/sepeda/${bikeId}/qr`}
          variasi="kedua"
          ukuran="sm"
          ikon={Ikon.label}
        >
          Cetak QR
        </ButtonLink>
        {bolehKelola && (
          <ButtonLink href={`/sepeda/${bikeId}/ubah`} variasi="kedua" ukuran="sm">
            Ubah
          </ButtonLink>
        )}
      </div>

      <BikeCard sepeda={sepeda} statistik={statistik} />

      {rentalBerjalan && (
        <Card>
          <CardHeader
            judul="Sedang disewa"
            keterangan={`${rentalBerjalan.namaPenyewa} · ${rentalBerjalan.noHpPenyewa}`}
            // Tertulis "Buka di scan", bukan "Selesaikan". Tautan ini tidak
            // membawa penanda pindai, jadi yang terbuka hanya keterangan
            // rentalnya — menutup rental tetap menuntut kodenya masuk lewat
            // kotak scan. Label yang menjanjikan penyelesaian akan membuat
            // petugas mengira ada yang rusak saat tombolnya tidak muncul.
            aksi={
              <Link
                href={`/scan?kode=${encodeURIComponent(sepeda.kode)}`}
                className="text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                Buka di scan
              </Link>
            }
          />
          <div className="px-4 pt-3">
            <TombolKontak
              noHp={rentalBerjalan.noHpPenyewa}
              nama={rentalBerjalan.namaPenyewa}
              pesan={pesanWa.sepedaTelat(rentalBerjalan.namaPenyewa, sepeda.kode)}
            />
          </div>
          <p className="px-4 py-3 text-sm text-ink-muted">
            Mulai {formatTanggalWib(rentalBerjalan.waktuMulai)} pukul{" "}
            {formatJamWib(rentalBerjalan.waktuMulai)}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          judul="Riwayat terakhir"
          keterangan="10 transaksi terbaru yang melibatkan sepeda ini"
        />
        {riwayatSepeda.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.transaksi}
            judul="Belum ada transaksi"
            keterangan="Sepeda ini belum pernah disewakan."
          />
        ) : (
          <ul className="divide-y divide-line">
            {riwayatSepeda.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/transaksi/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {r.namaPenyewa}
                    </p>
                    <p className="text-xs tabular-nums text-ink-muted">
                      {formatTanggalWib(r.waktuMulai)} · {formatJamWib(r.waktuMulai)}
                      {r.waktuSelesai && ` – ${formatJamWib(r.waktuSelesai)}`}
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

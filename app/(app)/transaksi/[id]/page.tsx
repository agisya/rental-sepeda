import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { rentalById } from "@/lib/queries/rentals";
import {
  BarisData,
  Card,
  CardHeader,
  DaftarData,
  PesanBerhasil,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusRentalBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import {
  formatDurasi,
  formatJamWib,
  formatTanggalJamWib,
  formatTanggalWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Detail Transaksi" };

const LABEL_BAYAR = {
  tunai: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
} as const;

export default async function HalamanDetailTransaksi(
  props: PageProps<"/transaksi/[id]">,
) {
  await wajibPengguna();

  const [{ id }, params] = await Promise.all([props.params, props.searchParams]);
  const rentalId = Number(id);
  if (!Number.isInteger(rentalId) || rentalId <= 0) notFound();

  const rental = await rentalById(rentalId);
  if (!rental) notFound();

  const baruSelesai = params.selesai === "1";

  return (
    <div className="space-y-4">
      {baruSelesai && (
        <PesanBerhasil>
          Rental selesai. Tagihan {rupiah(rental.totalBiaya)} sudah tercatat.
        </PesanBerhasil>
      )}

      <PageHeader
        judul={`Transaksi #${rental.id}`}
        keterangan={formatTanggalWib(rental.waktuMulai)}
        aksi={<StatusRentalBadge status={rental.status} />}
      />

      {/* Total ditaruh paling atas karena inilah yang paling sering dicari saat
          membuka kembali sebuah transaksi. */}
      <Card>
        <div className="px-4 py-4">
          <p className="label-bagian">Total biaya</p>
          <p className="angka-utama mt-1 text-ink">
            {rental.totalBiaya === null ? "—" : rupiah(rental.totalBiaya)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {rental.durasiJamDitagih === null
              ? "Rental masih berjalan"
              : `${rental.durasiJamDitagih} jam × ${rupiah(rental.tarifPerJamSnapshot)}`}
          </p>
        </div>

        <DaftarData className="border-t border-line">
          <BarisData label={`Bagian pemilik (${rental.persentasePemilikSnapshot}%)`}>
            {rental.bagianPemilik === null ? "—" : rupiah(rental.bagianPemilik)}
          </BarisData>
          <BarisData label="Bagian rental">
            {rental.bagianRental === null ? "—" : rupiah(rental.bagianRental)}
          </BarisData>
          <BarisData label="Pembayaran">
            {rental.metodeBayar ? LABEL_BAYAR[rental.metodeBayar] : "Belum ditentukan"}
          </BarisData>
        </DaftarData>

        {rental.status === "selesai" && (
          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-muted">
            Durasi dibulatkan ke atas per jam dengan minimum 1 jam. Persentase yang
            dipakai adalah persentase pemilik saat rental dimulai.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader judul="Rincian" />
        <DaftarData>
          <BarisData label="Penyewa">{rental.namaPenyewa}</BarisData>
          <BarisData label="No. HP">
            <a
              href={`tel:${rental.noHpPenyewa}`}
              className="text-brand underline-offset-2 hover:underline"
            >
              {rental.noHpPenyewa}
            </a>
          </BarisData>
          <BarisData label="Sepeda">
            <Link
              href={`/sepeda/${rental.bikeId}`}
              className="text-brand underline-offset-2 hover:underline"
            >
              {rental.kodeSepeda} — {rental.namaSepeda}
            </Link>
          </BarisData>
          <BarisData label="Pemilik">
            <Link
              href={`/pemilik/${rental.ownerId}`}
              className="text-brand underline-offset-2 hover:underline"
            >
              {rental.namaPemilik}
            </Link>
          </BarisData>
          <BarisData label="Jam mulai">{formatJamWib(rental.waktuMulai)}</BarisData>
          <BarisData label="Jam selesai">
            {rental.waktuSelesai ? formatJamWib(rental.waktuSelesai) : "Masih berjalan"}
          </BarisData>
          <BarisData label="Durasi">
            {rental.durasiMenit === null ? "—" : formatDurasi(rental.durasiMenit)}
          </BarisData>
          {rental.jaminan && <BarisData label="Jaminan">{rental.jaminan}</BarisData>}
          <BarisData label="Dicatat oleh">{rental.namaKasir}</BarisData>
        </DaftarData>
      </Card>

      {/* Jejak pembatalan berdiri sendiri, tidak lagi menimpa catatan kasir.
          Rental yang dibatalkan justru yang paling mungkin dipersoalkan
          kemudian, jadi catatan asli tentang jaminan dan kondisi sepeda harus
          tetap utuh di sampingnya. */}
      {rental.status === "batal" && (
        <Card className="border-danger/40">
          <CardHeader
            className="border-danger/25"
            judul={<span className="text-danger">Dibatalkan</span>}
            keterangan={
              rental.dibatalkanPada
                ? `${rental.namaPembatal ?? "—"} · ${formatTanggalJamWib(rental.dibatalkanPada)}`
                : undefined
            }
          />
          <p className="px-4 py-3 text-sm leading-relaxed text-ink-muted">
            {rental.alasanBatal ?? "Alasan tidak tercatat (pembatalan sebelum jejak ini ada)."}
          </p>
        </Card>
      )}

      {rental.catatan && (
        <Card>
          <CardHeader judul="Catatan" />
          <p className="px-4 py-3 text-sm leading-relaxed text-ink-muted">
            {rental.catatan}
          </p>
        </Card>
      )}

      <div className="flex gap-2">
        <ButtonLink href="/transaksi" variasi="kedua" className="flex-1">
          Daftar transaksi
        </ButtonLink>
        <ButtonLink href="/scan" className="flex-1" ikon={Ikon.scan}>
          Scan berikutnya
        </ButtonLink>
      </div>
    </div>
  );
}

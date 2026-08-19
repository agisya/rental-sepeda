import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { bookingById, bookingKedaluwarsa, selesaiBooking } from "@/lib/queries/bookings";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { tandaiHangus } from "@/lib/actions/booking";
import {
  BarisData,
  Card,
  CardBody,
  CardHeader,
  DaftarData,
  PesanBerhasil,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { FormBatalBooking, TombolJemput } from "@/components/booking/booking-aksi";
import { kodeBooking } from "@/lib/booking/kode";
import { rupiah } from "@/lib/format";
import { formatJamWib, formatTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Detail Booking" };

const LABEL_BAYAR = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" } as const;

export default async function HalamanDetailBooking(props: PageProps<"/booking/[id]">) {
  await wajibPengguna();

  const [{ id }, params] = await Promise.all([props.params, props.searchParams]);
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) notFound();

  const booking = await bookingById(bookingId);
  if (!booking) notFound();

  const pengaturan = await ambilPengaturan();
  const sekarang = new Date();
  const terlewat = bookingKedaluwarsa(booking, sekarang, pengaturan.toleransiBookingMenit);
  const selesai = selesaiBooking(booking);
  const perkiraan = booking.tarifPerJamSnapshot * booking.durasiJam;

  return (
    <div className="space-y-4">
      {params.baru === "1" && (
        <PesanBerhasil>
          Booking {kodeBooking(booking.id)} tersimpan. Sebutkan kode ini ke penyewa.
        </PesanBerhasil>
      )}

      <PageHeader
        judul={kodeBooking(booking.id)}
        keterangan={`Dicatat ${formatTanggalWib(booking.dibuatPada)} oleh ${booking.namaPetugas}`}
      />

      <Card>
        <div className="px-4 py-4">
          <p className="label-bagian">Jadwal</p>
          <p className="angka-utama mt-1 text-ink">{formatJamWib(booking.waktuMulai)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatTanggalWib(booking.waktuMulai)} · {booking.durasiJam} jam · sampai{" "}
            {formatJamWib(selesai)}
          </p>
        </div>

        <DaftarData className="border-t border-line">
          <BarisData label="Penyewa">{booking.namaPenyewa}</BarisData>
          <BarisData label="No. HP">
            <a
              href={`tel:${booking.noHpPenyewa}`}
              className="text-brand underline-offset-2 hover:underline"
            >
              {booking.noHpPenyewa}
            </a>
          </BarisData>
          <BarisData label="Sepeda">
            <Link
              href={`/sepeda/${booking.bikeId}`}
              className="text-brand underline-offset-2 hover:underline"
            >
              {booking.kodeSepeda} — {booking.namaSepeda}
            </Link>
          </BarisData>
          <BarisData label="Pemilik">{booking.namaPemilik}</BarisData>
          <BarisData label="Tarif">
            {rupiah(booking.tarifPerJamSnapshot)}/jam
          </BarisData>
          <BarisData label="Perkiraan biaya" tebal>
            {rupiah(perkiraan)}
          </BarisData>
          <BarisData label="Rencana bayar">
            {booking.metodeBayar ? LABEL_BAYAR[booking.metodeBayar] : "Belum ditentukan"}
          </BarisData>
        </DaftarData>

        <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-muted">
          Perkiraan di atas memakai tarif saat booking dibuat. Tagihan sebenarnya
          dihitung dari jam kembali, dibulatkan ke atas per jam.
        </p>
      </Card>

      {booking.status === "booking" && (
        <>
          {terlewat && (
            <p className="rounded-control border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
              Jam mulai sudah lewat lebih dari {pengaturan.toleransiBookingMenit} menit
              dan penyewa belum datang.
            </p>
          )}

          <Card>
            <CardHeader
              judul="Penyewa datang"
              keterangan="Serahkan sepeda dan mulai hitung rentalnya."
            />
            <CardBody>
              <TombolJemput bookingId={booking.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              judul="Penyewa tidak jadi"
              keterangan="Jam yang terkunci dilepas supaya bisa dipesan orang lain."
            />
            <CardBody className="space-y-3">
              <FormBatalBooking bookingId={booking.id} />

              {terlewat && (
                <form action={tandaiHangus}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <button
                    type="submit"
                    className="w-full rounded-control border border-line-strong px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    Tandai hangus (penyewa tidak datang)
                  </button>
                </form>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {booking.status === "selesai" && booking.rentalId && (
        <Card>
          <CardHeader
            judul="Sudah dijemput"
            keterangan="Booking ini sudah berubah menjadi transaksi rental."
          />
          <CardBody>
            <ButtonLink href={`/transaksi/${booking.rentalId}`} penuh ikon={Ikon.transaksi}>
              Buka transaksinya
            </ButtonLink>
          </CardBody>
        </Card>
      )}

      {booking.catatan && (
        <Card>
          <CardHeader judul="Catatan" />
          <p className="px-4 py-3 text-sm leading-relaxed text-ink-muted">
            {booking.catatan}
          </p>
        </Card>
      )}

      <ButtonLink href="/booking" variasi="kedua" penuh>
        Kembali ke daftar booking
      </ButtonLink>
    </div>
  );
}

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
  CatatanKaki,
  DaftarData,
  PesanBerhasil,
  PesanPeringatan,
} from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { FormBatalBooking, TombolJemput } from "@/components/booking/booking-aksi";
import { BarisKontak } from "@/components/ui/tombol-kontak";
import { kodeBooking } from "@/lib/booking/kode";
import { pesanWa } from "@/lib/kontak";
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
          <BarisKontak
            noHp={booking.noHpPenyewa}
            nama={booking.namaPenyewa}
            // Halaman ini dibuka justru saat penyewanya perlu dihubungi soal
            // booking itu, jadi pesannya sudah menyebut kode dan jamnya.
            pesan={
              terlewat
                ? pesanWa.bookingHangus(
                    booking.namaPenyewa,
                    kodeBooking(booking.id),
                    formatJamWib(booking.waktuMulai),
                  )
                : pesanWa.bookingJemput(
                    booking.namaPenyewa,
                    kodeBooking(booking.id),
                    booking.kodeSepeda,
                    formatJamWib(booking.waktuMulai),
                  )
            }
          />
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

        <CatatanKaki>
          Perkiraan di atas memakai tarif saat booking dibuat. Tagihan sebenarnya
          dihitung dari jam kembali, dibulatkan ke atas per jam.
        </CatatanKaki>
      </Card>

      {booking.status === "booking" && (
        <>
          {terlewat && (
            <PesanPeringatan>
              Jam mulai sudah lewat lebih dari {pengaturan.toleransiBookingMenit} menit
              dan penyewa belum datang.
            </PesanPeringatan>
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
                  <Button type="submit" variasi="kedua" penuh>
                    Tandai hangus (penyewa tidak datang)
                  </Button>
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

import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { sepedaByKode, statistikBulananSepeda } from "@/lib/queries/bikes";
import { rentalBerjalanUntukSepeda } from "@/lib/queries/rentals";
import { daftarAktivitas } from "@/lib/queries/aktivitas";
import { ScannerInput } from "@/components/scan/scanner-input";
import { DaftarAktivitas } from "@/components/aktivitas/daftar-aktivitas";
import { ButtonLink } from "@/components/ui/button";
import { BikeCard } from "@/components/rental/bike-card";
import { StartForm } from "@/components/rental/start-form";
import { FinishPanel } from "@/components/rental/finish-panel";
import {
  BarisData,
  Card,
  CardBody,
  CardHeader,
  DaftarData,
  KeadaanKosong,
  PesanBerhasil,
} from "@/components/ui/card";
import { labelStatusSepeda } from "@/components/ui/status-badge";
import { Ikon } from "@/components/ui/icons";
import { TombolJemput } from "@/components/booking/booking-aksi";
import { bookingSiapJemput } from "@/lib/queries/bookings";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { BarisKontak } from "@/components/ui/tombol-kontak";
import { pesanWa } from "@/lib/kontak";
import { kodeBooking } from "@/lib/booking/kode";
import { formatJamWib, formatTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Scan QR" };

export default async function HalamanScan(props: PageProps<"/scan">) {
  await wajibPengguna();

  const params = await props.searchParams;
  const kode = typeof params.kode === "string" ? params.kode : "";
  const baruMulai = params.mulai === "1";
  // Hanya kode yang masuk lewat kotak scan yang membawa penanda ini. Tautan
  // dari daftar mana pun — di sini maupun di dashboard — tidak membawanya,
  // sehingga mengetuk sebuah baris tidak pernah langsung sampai ke tombol
  // yang menutup rental dan menerima uang.
  const dariPindai = params.pindai === "1";

  const sepeda = kode ? await sepedaByKode(kode) : null;

  return (
    <div className="space-y-4">
      <ScannerInput kodeAwal={kode} />

      {baruMulai && sepeda && (
        <PesanBerhasil>
          Rental {sepeda.kode} berhasil dimulai. Sepeda berikutnya bisa langsung di-scan.
        </PesanBerhasil>
      )}

      {!kode && <SepedaDiLuar />}

      {kode && !sepeda && (
        <Card>
          <KeadaanKosong
            ikon={Ikon.tidakDitemukan}
            judul={`Kode "${kode}" tidak ditemukan`}
            keterangan="Periksa stikernya, atau cari lewat menu Data Sepeda."
            aksi={
              <Link
                href="/sepeda"
                className="text-sm font-medium text-brand underline underline-offset-2"
              >
                Buka Data Sepeda
              </Link>
            }
          />
        </Card>
      )}

      {sepeda && (
        <IsiSepeda sepedaId={sepeda.id} sepeda={sepeda} dariPindai={dariPindai} />
      )}
    </div>
  );
}

/**
 * Isi halaman selama belum ada sepeda yang di-scan.
 *
 * Daftarnya sama persis dengan yang ada di halaman Booking — booking maupun
 * rental langsung, keduanya. Petugas tidak perlu menebak halaman mana yang
 * memuat sebuah sepeda; yang membedakan tiap baris cuma lencana tahapnya.
 *
 * Kuerinya sengaja hanya dijalankan di cabang ini, jadi alur scan yang sudah
 * ada tidak jadi lebih lambat.
 */
async function SepedaDiLuar() {
  const pengaturan = await ambilPengaturan();
  const sekarang = new Date();
  const daftar = await daftarAktivitas(sekarang, pengaturan.toleransiBookingMenit);

  return (
    <DaftarAktivitas
      aktivitas={daftar}
      sekarang={sekarang}
      judulKosong="Belum ada sepeda yang di-scan"
      keteranganKosong="Buka kamera untuk scan QR, atau ketik kode sepeda (mis. MTB-023)."
    />
  );
}

async function IsiSepeda({
  sepedaId,
  sepeda,
  dariPindai,
}: {
  sepedaId: number;
  sepeda: NonNullable<Awaited<ReturnType<typeof sepedaByKode>>>;
  dariPindai: boolean;
}) {
  const pengaturan = await ambilPengaturan();
  const sekarang = new Date();

  const [statistik, rentalBerjalan, siapJemput] = await Promise.all([
    statistikBulananSepeda(sepedaId),
    sepeda.status === "disewa" ? rentalBerjalanUntukSepeda(sepedaId) : null,
    sepeda.status === "disewa"
      ? null
      : bookingSiapJemput(sepedaId, sekarang, pengaturan.toleransiBookingMenit),
  ]);

  return (
    <div className="space-y-4">
      <BikeCard sepeda={sepeda} statistik={statistik} />

      {/* Booking diperiksa lebih dulu daripada form rental biasa. Kalau penyewa
          yang sudah memesan datang, petugas cukup menyerahkan sepedanya tanpa
          mengetik ulang data yang sudah tercatat saat memesan. */}
      {siapJemput && (
        <Card className="border-warn/40">
          <CardHeader
            className="border-warn/25"
            judul={
              <span className="flex items-center gap-2 text-warn">
                <Ikon.booking className="size-4" strokeWidth={2.2} aria-hidden="true" />
                Ada booking untuk sepeda ini
              </span>
            }
            keterangan={`${kodeBooking(siapJemput.id)} · ${siapJemput.namaPenyewa} · ${formatJamWib(siapJemput.waktuMulai)} · ${siapJemput.durasiJam} jam`}
          />
          <CardBody className="space-y-3">
            <DaftarData className="rounded-card border border-line">
              <BarisData label="Penyewa">{siapJemput.namaPenyewa}</BarisData>
              <BarisKontak
                noHp={siapJemput.noHpPenyewa}
                nama={siapJemput.namaPenyewa}
                pesan={pesanWa.bookingJemput(
                  siapJemput.namaPenyewa,
                  kodeBooking(siapJemput.id),
                  sepeda.kode,
                  formatJamWib(siapJemput.waktuMulai),
                )}
              />
              <BarisData label="Dipesan untuk">
                {formatJamWib(siapJemput.waktuMulai)} · {siapJemput.durasiJam} jam
              </BarisData>
            </DaftarData>

            <TombolJemput bookingId={siapJemput.id} />

            <Link
              href={`/booking/${siapJemput.id}`}
              className="block text-center text-sm font-medium text-brand underline underline-offset-2"
            >
              Buka detail booking
            </Link>
          </CardBody>
        </Card>
      )}

      {sepeda.status === "tersedia" && (
        <Card>
          <CardHeader
            judul={siapJemput ? "Atau mulai rental biasa" : "Mulai rental"}
            keterangan="Isi data penyewa lalu tekan START RENTAL."
          />
          <CardBody>
            <StartForm bikeId={sepeda.id} tarifPerJam={sepeda.tarifPerJam} />
          </CardBody>
        </Card>
      )}

      {/* Booking lewat scan, bukan lewat memilih dari daftar panjang.
          Sepedanya sudah di tangan petugas saat ia menempelkan kamera, jadi
          menyuruh mencari kodenya lagi di dropdown hanya membuka peluang salah
          pilih. Sepeda yang sedang disewa tetap boleh dipesan untuk jam
          berikutnya, jadi tautan ini muncul juga di situ. */}
      {(sepeda.status === "tersedia" ||
        sepeda.status === "disewa" ||
        sepeda.status === "booking") && (
        <Card>
          <CardHeader
            judul="Pesan untuk nanti"
            keterangan={
              sepeda.status === "tersedia"
                ? "Kalau penyewa mau memakainya di jam lain, bukan sekarang"
                : "Sepeda ini boleh dipesan untuk jam yang belum terpakai"
            }
          />
          <CardBody>
            <ButtonLink
              href={`/booking/baru?sepeda=${sepeda.id}`}
              variasi="kedua"
              ukuran="lg"
              penuh
              ikon={Ikon.booking}
            >
              Booking {sepeda.kode}
            </ButtonLink>
          </CardBody>
        </Card>
      )}

      {sepeda.status === "disewa" && rentalBerjalan && (
        <Card>
          <CardHeader
            judul="Sedang disewa"
            keterangan={`Mulai ${formatTanggalWib(rentalBerjalan.waktuMulai)} pukul ${formatJamWib(rentalBerjalan.waktuMulai)}`}
          />
          <CardBody className="space-y-4">
            <DaftarData className="rounded-card border border-line">
              <BarisData label="Penyewa">{rentalBerjalan.namaPenyewa}</BarisData>
              <BarisKontak
                noHp={rentalBerjalan.noHpPenyewa}
                nama={rentalBerjalan.namaPenyewa}
                pesan={pesanWa.sepedaTelat(rentalBerjalan.namaPenyewa, sepeda.kode)}
              />
              <BarisData label="Jam mulai">
                {formatJamWib(rentalBerjalan.waktuMulai)}
              </BarisData>
              {rentalBerjalan.jaminan && (
                <BarisData label="Jaminan">{rentalBerjalan.jaminan}</BarisData>
              )}
              <BarisData label="Dicatat oleh">{rentalBerjalan.namaKasir}</BarisData>
            </DaftarData>

            {dariPindai ? (
              <FinishPanel
                rentalId={rentalBerjalan.id}
                waktuMulaiISO={rentalBerjalan.waktuMulai.toISOString()}
                tarifPerJam={rentalBerjalan.tarifPerJamSnapshot}
                persentasePemilik={rentalBerjalan.persentasePemilikSnapshot}
                metodeBayarAwal={rentalBerjalan.metodeBayar}
                toleransiTelatMenit={pengaturan.toleransiTelatMenit}
              />
            ) : (
              <div className="rounded-card border border-dashed border-line-strong px-4 py-6 text-center">
                <span
                  className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-faint"
                  aria-hidden="true"
                >
                  <Ikon.scan className="size-5" strokeWidth={1.8} />
                </span>
                <p className="text-sm font-semibold text-ink">
                  Pindai sepedanya untuk menyelesaikan
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
                  Halaman ini dibuka dari daftar, jadi hanya menampilkan keterangan.
                  Scan QR {sepeda.kode} atau ketik kodenya di kotak paling atas untuk
                  menghitung biaya dan menutup rental.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {sepeda.status === "disewa" && !rentalBerjalan && (
        <Card>
          <KeadaanKosong
            ikon={Ikon.peringatan}
            judul="Data rental tidak ditemukan"
            keterangan="Sepeda bertanda sedang disewa, tapi tidak ada rental berjalan yang tercatat. Hubungi admin untuk memperbaiki statusnya."
          />
        </Card>
      )}

      {(sepeda.status === "servis" ||
        sepeda.status === "nonaktif" ||
        sepeda.status === "booking") && (
        <Card>
          <KeadaanKosong
            ikon={
              sepeda.status === "servis"
                ? Ikon.servis
                : sepeda.status === "booking"
                  ? Ikon.booking
                  : Ikon.nonaktif
            }
            judul={`Sepeda berstatus ${labelStatusSepeda(sepeda.status)}`}
            keterangan={
              sepeda.status === "servis"
                ? "Sepeda sedang diperbaiki dan belum bisa disewakan. Ubah statusnya lewat Data Sepeda kalau sudah selesai."
                : sepeda.status === "booking"
                  ? "Sepeda sudah dipesan penyewa lain. Menu Booking tersedia pada tahap berikutnya."
                  : "Sepeda ditandai tidak aktif. Aktifkan kembali lewat Data Sepeda kalau mau disewakan."
            }
            aksi={
              <Link
                href={`/sepeda/${sepeda.id}`}
                className="text-sm font-medium text-brand underline underline-offset-2"
              >
                Buka detail sepeda
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}

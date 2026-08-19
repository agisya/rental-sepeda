import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarSepeda } from "@/lib/queries/bikes";
import { jamTerpakai } from "@/lib/queries/bookings";
import { Card, CardBody, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { BookingForm } from "@/components/booking/booking-form";
import { awalHariWib, kunciTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Booking Baru" };

export default async function HalamanBookingBaru(props: PageProps<"/booking/baru">) {
  await wajibPengguna();
  const params = await props.searchParams;

  // Sepeda yang sedang diservis atau tidak aktif tidak bisa dipesan sama sekali.
  // Sepeda yang sedang disewa tetap boleh dipesan untuk jam berikutnya.
  const semua = await daftarSepeda();
  const bisaDipesan = semua.filter(
    (s) => s.status !== "servis" && s.status !== "nonaktif",
  );

  /*
    Jam yang sudah dipesan untuk 30 hari ke depan, dikirim sekali ke formulir.

    Sengaja dikirim seluruhnya, bukan diminta ulang tiap kali sepeda atau tanggal
    diganti: jumlah sepeda dan booking di satu rental kecil sedikit, sedangkan
    permintaan bolak-balik membuat penandaan jamnya tersendat justru saat petugas
    sedang berbicara di telepon.
  */
  const sekarang = new Date();
  const jamDipesan = await jamTerpakai({
    mulai: awalHariWib(sekarang),
    selesai: new Date(awalHariWib(sekarang).getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  const hariIni = kunciTanggalWib(sekarang);
  const sepedaAwal =
    typeof params.sepeda === "string" ? Number(params.sepeda) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Booking Baru"
        keterangan="Catat pesanan yang masuk lewat telepon atau WhatsApp"
      />

      {bisaDipesan.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.sepeda}
            judul="Tidak ada sepeda yang bisa dipesan"
            keterangan="Semua sepeda sedang diservis atau ditandai tidak aktif."
            aksi={<ButtonLink href="/sepeda">Buka Data Sepeda</ButtonLink>}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            judul="Data booking"
            keterangan="Jam yang dipesan akan langsung terkunci untuk sepeda ini."
          />
          <CardBody>
            <BookingForm
              sepeda={bisaDipesan.map((s) => ({
                id: s.id,
                kode: s.kode,
                nama: s.nama,
                tarifPerJam: s.tarifPerJam,
              }))}
              jamTerpakai={jamDipesan}
              tanggalMinimal={hariIni}
              tanggalAwal={hariIni}
              sepedaAwal={
                Number.isInteger(sepedaAwal) && sepedaAwal! > 0 ? sepedaAwal : undefined
              }
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

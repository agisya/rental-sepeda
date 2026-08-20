import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarSepeda } from "@/lib/queries/bikes";
import { jamTerpakai } from "@/lib/queries/bookings";
import { Card, CardBody, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { BookingForm } from "@/components/booking/booking-form";
import { ScannerInput } from "@/components/scan/scanner-input";
import { normalkanKode } from "@/lib/format";
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
  /*
    Sepedanya ditentukan lewat scan QR, bukan dipilih dari daftar.

    Menerima dua bentuk: ?kode= dari hasil pemindaian, dan ?sepeda= dari tautan
    di halaman scan. Keduanya menunjuk sepeda yang sama; yang berbeda hanya dari
    mana petugas datang.
  */
  const kodeDicari =
    typeof params.kode === "string" ? normalkanKode(params.kode) : undefined;
  const idDicari = typeof params.sepeda === "string" ? Number(params.sepeda) : undefined;

  const terpilih =
    bisaDipesan.find((s) => (kodeDicari ? s.kode === kodeDicari : false)) ??
    bisaDipesan.find((s) => Number.isInteger(idDicari) && s.id === idDicari);

  // Kode yang dipindai tapi tidak ada di daftar yang bisa dipesan: entah
  // sepedanya tidak terdaftar, entah sedang servis atau nonaktif. Keduanya perlu
  // dijelaskan, bukan dibiarkan tampil sebagai formulir kosong.
  const kodeTidakCocok = Boolean((kodeDicari || idDicari) && !terpilih);

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Booking Baru"
        keterangan="Catat pesanan dari telepon atau WhatsApp"
      />

      {bisaDipesan.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.sepeda}
            judul="Tidak ada sepeda yang bisa dipesan"
            keterangan="Semua sepeda sedang diservis atau tidak aktif."
            aksi={<ButtonLink href="/sepeda">Buka Data Sepeda</ButtonLink>}
          />
        </Card>
      ) : terpilih ? (
        <Card>
          <CardHeader
            judul="Data booking"
            keterangan="Jam yang dipesan langsung terkunci untuk sepeda ini."
          />
          <CardBody>
            <BookingForm
              sepeda={{
                id: terpilih.id,
                kode: terpilih.kode,
                nama: terpilih.nama,
                tarifPerJam: terpilih.tarifPerJam,
              }}
              jamTerpakai={jamDipesan
                .filter((j) => j.bikeId === terpilih.id)
                .map((j) => ({ tanggal: j.tanggal, jam: j.jam }))}
              tanggalMinimal={hariIni}
              tanggalAwal={hariIni}
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {kodeTidakCocok && (
            <Card className="border-warn/40 bg-warn-soft/40">
              <KeadaanKosong
                ikon={Ikon.peringatan}
                judul="Sepeda itu tidak bisa dipesan"
                keterangan="Kode tidak terdaftar, atau sepedanya sedang diservis atau tidak aktif. Coba sepeda lain."
              />
            </Card>
          )}

          {/* Pemindai yang sama dengan halaman scan, hanya tujuannya berbeda.
              Sepedanya sudah di tangan petugas saat memesan, jadi mencarinya
              lagi di daftar panjang hanya membuka peluang salah pilih. */}
          <ScannerInput
            tujuan="/booking/baru"
            judul="Scan sepeda yang mau dipesan"
            keterangan="Scan QR di sepedanya, atau ketik kodenya lalu tekan Enter."
          />
        </>
      )}
    </div>
  );
}

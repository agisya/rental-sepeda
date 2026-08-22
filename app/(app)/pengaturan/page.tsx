import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { Card, CardBody, CardHeader, PesanBerhasil } from "@/components/ui/card";
import { FormPengaturan } from "@/components/pengaturan/form-pengaturan";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function HalamanPengaturanUmum(props: PageProps<"/pengaturan">) {
  const pengguna = await wajibPengguna();
  const params = await props.searchParams;
  const pengaturan = await ambilPengaturan();

  const bolehUbah = pengguna.peran !== "kasir";

  return (
    <>
      {params.tersimpan === "1" && <PesanBerhasil>Pengaturan tersimpan.</PesanBerhasil>}

      {bolehUbah ? (
        <Card>
          <CardHeader
            judul="Informasi Usaha"
            keterangan="Berlaku untuk seluruh aplikasi dan perhitungan peringatan"
          />
          <CardBody>
            <FormPengaturan awal={pengaturan} />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            judul="Informasi Usaha"
            keterangan="Hanya admin dan owner yang bisa mengubahnya"
          />
          <CardBody className="space-y-2 text-sm text-ink-muted">
            <p>
              Nama usaha:{" "}
              <span className="font-medium text-ink">{pengaturan.namaUsaha}</span>
            </p>
            <p>
              Batas durasi rental:{" "}
              <span className="font-medium text-ink">{pengaturan.batasJamRental} jam</span>
            </p>
            <p>
              Toleransi keterlambatan booking:{" "}
              <span className="font-medium text-ink">
                {pengaturan.toleransiBookingMenit} menit
              </span>
            </p>
            <p>
              Toleransi keterlambatan pengembalian:{" "}
              <span className="font-medium text-ink">
                {pengaturan.toleransiTelatMenit} menit
              </span>
            </p>
          </CardBody>
        </Card>
      )}
    </>
  );
}

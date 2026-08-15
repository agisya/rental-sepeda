import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { Card, CardBody, CardHeader, PesanBerhasil } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  FormGantiSandi,
  FormPengaturan,
} from "@/components/pengaturan/form-pengaturan";

export const metadata: Metadata = { title: "Pengaturan" };

const LABEL_PERAN = {
  admin: "Admin — boleh mengelola semua data dan keuangan",
  kasir: "Kasir — operasional harian, tanpa akses keuangan",
  owner: "Owner — boleh mengelola semua data dan keuangan",
} as const;

export default async function HalamanPengaturan(props: PageProps<"/pengaturan">) {
  const pengguna = await wajibPengguna();
  const params = await props.searchParams;
  const pengaturan = await ambilPengaturan();

  const bolehUbah = pengguna.peran !== "kasir";

  return (
    <div className="space-y-5">
      {params.tersimpan === "1" && <PesanBerhasil>Pengaturan tersimpan.</PesanBerhasil>}
      {params.sandi === "1" && <PesanBerhasil>Kata sandi berhasil diganti.</PesanBerhasil>}

      <PageHeader judul="Pengaturan" keterangan="Identitas usaha dan aturan operasional" />

      <Card>
        <CardHeader judul="Akun Anda" />
        <CardBody className="space-y-1">
          <p className="text-sm font-medium text-ink">{pengguna.nama}</p>
          <p className="text-sm text-ink-muted">
            {pengguna.username} · {LABEL_PERAN[pengguna.peran]}
          </p>
        </CardBody>
      </Card>

      {bolehUbah ? (
        <Card>
          <CardHeader
            judul="Identitas & aturan"
            keterangan="Dipakai di seluruh aplikasi dan pada perhitungan peringatan"
          />
          <CardBody>
            <FormPengaturan awal={pengaturan} />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            judul="Identitas & aturan"
            keterangan="Hanya admin atau owner yang boleh mengubah bagian ini"
          />
          <CardBody className="space-y-2 text-sm text-ink-muted">
            <p>
              Nama usaha: <span className="font-medium text-ink">{pengaturan.namaUsaha}</span>
            </p>
            <p>
              Batas jam rental mencurigakan:{" "}
              <span className="font-medium text-ink">{pengaturan.batasJamRental} jam</span>
            </p>
            <p>
              Toleransi keterlambatan booking:{" "}
              <span className="font-medium text-ink">
                {pengaturan.toleransiBookingMenit} menit
              </span>
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          judul="Ganti kata sandi"
          keterangan="Berlaku untuk akun yang sedang Anda pakai sekarang"
        />
        <CardBody>
          <FormGantiSandi />
        </CardBody>
      </Card>
    </div>
  );
}

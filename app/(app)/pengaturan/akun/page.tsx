import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { Card, CardBody, CardHeader, PesanBerhasil } from "@/components/ui/card";
import { FormGantiSandi } from "@/components/pengaturan/form-pengaturan";

export const metadata: Metadata = { title: "Akun Saya" };

const LABEL_PERAN = {
  admin: "Admin — seluruh data, keuangan, dan pengelolaan tim",
  kasir: "Kasir — operasional harian, tanpa akses keuangan",
  owner: "Owner — seluruh data, keuangan, dan pengelolaan tim",
} as const;

export default async function HalamanAkun(props: PageProps<"/pengaturan/akun">) {
  const pengguna = await wajibPengguna();
  const params = await props.searchParams;

  return (
    <>
      {params.sandi === "1" && <PesanBerhasil>Kata sandi berhasil diubah.</PesanBerhasil>}

      <Card>
        <CardHeader judul="Akun Saya" />
        <CardBody className="space-y-1">
          <p className="text-sm font-medium text-ink">{pengguna.nama}</p>
          <p className="text-sm text-ink-muted">
            {pengguna.username} · {LABEL_PERAN[pengguna.peran]}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          judul="Ubah Kata Sandi"
          keterangan="Berlaku untuk akun yang sedang Anda gunakan"
        />
        <CardBody>
          <FormGantiSandi />
        </CardBody>
      </Card>
    </>
  );
}

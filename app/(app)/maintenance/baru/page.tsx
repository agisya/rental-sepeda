import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarSepeda } from "@/lib/queries/bikes";
import { Card, CardBody, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { kunciTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Catat Maintenance" };

export default async function HalamanMaintenanceBaru(
  props: PageProps<"/maintenance/baru">,
) {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/maintenance");

  const params = await props.searchParams;
  const sepeda = await daftarSepeda();
  const sepedaAwal = typeof params.sepeda === "string" ? Number(params.sepeda) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Catat Maintenance"
        keterangan="Servis, ganti sparepart, dan jadwal servis berikutnya"
      />

      {sepeda.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.sepeda}
            judul="Belum ada sepeda"
            keterangan="Daftarkan sepeda lebih dulu sebelum mencatat maintenance."
            aksi={<ButtonLink href="/sepeda/baru">Tambah sepeda</ButtonLink>}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader judul="Data maintenance" />
          <CardBody>
            <MaintenanceForm
              sepeda={sepeda.map((s) => ({
                id: s.id,
                kode: s.kode,
                nama: s.nama,
                status: s.status,
              }))}
              tanggalHariIni={kunciTanggalWib(new Date())}
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

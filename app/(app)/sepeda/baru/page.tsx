import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { pilihanPemilik } from "@/lib/queries/owners";
import { Card, CardBody, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { BikeForm } from "@/components/sepeda/bike-form";

export const metadata: Metadata = { title: "Tambah Sepeda" };

export default async function HalamanSepedaBaru() {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/sepeda");

  const pemilik = await pilihanPemilik();

  return (
    <div className="space-y-4">
      <PageHeader judul="Tambah Sepeda" />

      {pemilik.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.pemilik}
            judul="Belum ada pemilik aktif"
            keterangan="Setiap sepeda harus punya pemilik untuk perhitungan bagi hasil."
            aksi={
              <ButtonLink href="/pemilik/baru" ikon={Ikon.tambah}>
                Tambah pemilik
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            judul="Data sepeda"
            keterangan="Kode yang diisi di sini menjadi isi barcode yang dicetak jadi stiker."
          />
          <CardBody>
            <BikeForm pemilik={pemilik} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

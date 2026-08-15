import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { OwnerForm } from "@/components/pemilik/owner-form";

export const metadata: Metadata = { title: "Tambah Pemilik" };

export default async function HalamanPemilikBaru() {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/pemilik");

  return (
    <div className="space-y-4">
      <PageHeader judul="Tambah Pemilik" />

      <Card>
        <CardHeader
          judul="Data pemilik"
          keterangan="Persentase menentukan pembagian omzet setiap kali sepedanya disewa."
        />
        <CardBody>
          <OwnerForm />
        </CardBody>
      </Card>
    </div>
  );
}

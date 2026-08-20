import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PemilihTema } from "@/components/ui/tema";

export const metadata: Metadata = { title: "Tampilan" };

export default async function HalamanTampilan() {
  await wajibPengguna();

  return (
    <Card>
      <CardHeader
        judul="Tema"
        keterangan="Tersimpan di perangkat ini saja, tidak mengikuti akun"
      />
      <CardBody>
        <PemilihTema />
      </CardBody>
    </Card>
  );
}

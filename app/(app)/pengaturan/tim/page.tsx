import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarPengguna } from "@/lib/pengguna/kelola";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DaftarTim, FormTambahAnggota } from "@/components/pengaturan/form-tim";

export const metadata: Metadata = { title: "Tim & Akses" };

export default async function HalamanTim() {
  const pengguna = await wajibPengguna();

  // Kasir tidak boleh membuat akun: satu akun kasir yang bocor akan cukup untuk
  // mengangkat diri sendiri menjadi admin.
  if (pengguna.peran !== "admin" && pengguna.peran !== "owner") {
    redirect("/pengaturan");
  }

  const tim = await daftarPengguna();

  return (
    <>
      <Card>
        <CardHeader judul="Tim" keterangan={`${tim.length} akun terdaftar`} />
        <CardBody className="px-4 py-3.5">
          <DaftarTim anggota={tim} idSaya={pengguna.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          judul="Tambah Anggota"
          keterangan="Serahkan kata sandi awal langsung kepada yang bersangkutan"
        />
        <CardBody>
          <FormTambahAnggota />
        </CardBody>
      </Card>
    </>
  );
}

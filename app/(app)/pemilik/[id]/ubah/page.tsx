import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { pemilikById, pemilikPunyaSepeda } from "@/lib/queries/owners";
import { hapusPemilik } from "@/lib/actions/owners";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { OwnerForm } from "@/components/pemilik/owner-form";
import { KonfirmasiAksi } from "@/components/ui/konfirmasi";

export const metadata: Metadata = { title: "Ubah Pemilik" };

export default async function HalamanUbahPemilik(
  props: PageProps<"/pemilik/[id]/ubah">,
) {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/pemilik");

  const { id } = await props.params;
  const ownerId = Number(id);
  if (!Number.isInteger(ownerId) || ownerId <= 0) notFound();

  const pemilik = await pemilikById(ownerId);
  if (!pemilik) notFound();

  const punyaSepeda = await pemilikPunyaSepeda(ownerId);

  return (
    <div className="space-y-4">
      <PageHeader judul="Ubah Pemilik" />

      <Card>
        <CardHeader judul={pemilik.nama} />
        <CardBody>
          <OwnerForm
            awal={{
              id: pemilik.id,
              nama: pemilik.nama,
              noHp: pemilik.noHp,
              alamat: pemilik.alamat,
              persentaseBagiHasil: pemilik.persentaseBagiHasil,
              // Wajib ikut. Tanpa ini, membuka halaman ubah lalu menyimpan akan
              // melepas tanda "milik sendiri" diam-diam dan mengembalikannya
              // jadi titipan 60% — seluruh omzet sepeda sendiri berpindah jadi
              // hak pihak lain tanpa ada yang menyadarinya.
              milikSendiri: pemilik.milikSendiri,
              catatan: pemilik.catatan,
              aktif: pemilik.aktif,
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          judul="Hapus pemilik"
          keterangan={
            punyaSepeda
              ? "Pemilik ini masih punya sepeda, jadi hanya akan dinonaktifkan supaya laporan lama tetap utuh."
              : "Pemilik ini belum punya sepeda dan bisa dihapus permanen."
          }
        />
        <CardBody>
          <form action={hapusPemilik}>
            <input type="hidden" name="id" value={pemilik.id} />
            <KonfirmasiAksi
              label={punyaSepeda ? "Nonaktifkan pemilik" : "Hapus pemilik"}
              judul={
                punyaSepeda
                  ? `Nonaktifkan ${pemilik.nama}?`
                  : `Hapus ${pemilik.nama}?`
              }
              keterangan={
                punyaSepeda
                  ? "Pemilik ini masih punya sepeda, jadi tidak dihapus melainkan dinonaktifkan — seluruh riwayat bagi hasilnya tetap utuh. Ia hilang dari pilihan saat menambah sepeda, dan bisa diaktifkan lagi kapan saja."
                  : "Pemilik ini belum punya sepeda, jadi datanya benar-benar dihapus dan tidak bisa dikembalikan."
              }
              labelYa={punyaSepeda ? "Nonaktifkan" : "Hapus"}
              variasi="bahaya"
              penuh
            />
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

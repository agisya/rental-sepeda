import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { sepedaById, sepedaPunyaRiwayat } from "@/lib/queries/bikes";
import { pilihanPemilik } from "@/lib/queries/owners";
import { hapusSepeda } from "@/lib/actions/bikes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BikeForm } from "@/components/sepeda/bike-form";
import { FormFotoSepeda } from "@/components/sepeda/form-foto";

export const metadata: Metadata = { title: "Ubah Sepeda" };

export default async function HalamanUbahSepeda(props: PageProps<"/sepeda/[id]/ubah">) {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/sepeda");

  const { id } = await props.params;
  const bikeId = Number(id);
  if (!Number.isInteger(bikeId) || bikeId <= 0) notFound();

  const sepeda = await sepedaById(bikeId);
  if (!sepeda) notFound();

  const [pemilik, punyaRiwayat] = await Promise.all([
    pilihanPemilik(),
    sepedaPunyaRiwayat(bikeId),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader judul="Ubah Sepeda" />

      {/* Foto lebih dulu, data sepeda sesudahnya. Dengan begitu tombol "Simpan
          perubahan" berada di bawah kolom foto, bukan di atasnya — kalau
          tombolnya lebih dulu, orang menekannya sebelum sampai ke foto dan
          fotonya terlupakan. Foto punya tombol unggah sendiri dan tersimpan
          seketika, jadi urutannya tidak mengubah cara kerja apa pun. */}
      <Card>
        <CardHeader
          judul="Foto sepeda"
          keterangan="Muncul di daftar sepeda dan pada kartu hasil scan"
        />
        <CardBody>
          <FormFotoSepeda
            bikeId={sepeda.id}
            punyaFoto={sepeda.punyaFoto}
            fotoVersi={sepeda.fotoVersi}
            nama={sepeda.nama}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader judul={`${sepeda.kode} — ${sepeda.nama}`} />
        <CardBody>
          <BikeForm
            pemilik={pemilik}
            sedangDisewa={sepeda.status === "disewa"}
            awal={{
              id: sepeda.id,
              kode: sepeda.kode,
              nama: sepeda.nama,
              jenis: sepeda.jenis,
              merk: sepeda.merk,
              tarifPerJam: sepeda.tarifPerJam,
              ownerId: sepeda.ownerId,
              status: sepeda.status,
              catatan: sepeda.catatan,
            }}
          />
        </CardBody>
      </Card>

      {sepeda.status !== "disewa" && (
        <Card>
          <CardHeader
            judul="Hapus sepeda"
            keterangan={
              punyaRiwayat
                ? "Sepeda ini punya riwayat transaksi, jadi hanya akan ditandai tidak aktif supaya laporan lama tetap utuh."
                : "Sepeda ini belum pernah disewakan dan bisa dihapus permanen."
            }
          />
          <CardBody>
            <form action={hapusSepeda}>
              <input type="hidden" name="id" value={sepeda.id} />
              <button
                type="submit"
                className="w-full rounded-control border border-danger px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft"
              >
                {punyaRiwayat ? "Tandai tidak aktif" : "Hapus sepeda"}
              </button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

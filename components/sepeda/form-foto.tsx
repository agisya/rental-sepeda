"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { unggahFotoSepeda, type StatusAksi } from "@/lib/actions/foto";
import { hapusFotoSepeda } from "@/lib/actions/foto";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PesanBerhasil, PesanGalat } from "@/components/ui/card";
import { FotoSepeda } from "./foto-sepeda";
import { Ikon } from "@/components/ui/icons";
import { KonfirmasiAksi } from "@/components/ui/konfirmasi";
import { UKURAN_MAKS_FOTO } from "@/lib/foto";

const AWAL: StatusAksi = {};

function TombolUnggah() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      penuh
      ikon={pending ? undefined : Ikon.fotoTambah}
      disabled={pending}
    >
      {pending ? "Mengunggah…" : "Unggah foto"}
    </Button>
  );
}

export function FormFotoSepeda({
  bikeId,
  punyaFoto,
  fotoVersi,
  nama,
}: {
  bikeId: number;
  punyaFoto: boolean;
  fotoVersi: number;
  nama: string;
}) {
  const [status, aksi] = useActionState(unggahFotoSepeda, AWAL);
  const maksMb = (UKURAN_MAKS_FOTO / 1024 / 1024).toFixed(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <FotoSepeda
          bikeId={bikeId}
          punyaFoto={punyaFoto}
          fotoVersi={fotoVersi}
          nama={nama}
          ukuran="lg"
        />
        <p className="text-sm text-ink-muted">
          {punyaFoto
            ? "Foto tersimpan di database, jadi ikut berpindah kalau aplikasi dipindahkan."
            : "Belum ada foto. Sepeda akan ditampilkan dengan ikon pengganti."}
        </p>
      </div>

      <form action={aksi} className="space-y-3">
        <input type="hidden" name="bikeId" value={bikeId} />

        {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
        {status.berhasil && <PesanBerhasil>{status.berhasil}</PesanBerhasil>}

        <Field
          id="foto"
          label="Pilih foto"
          petunjuk={`Format JPG, PNG, atau WebP. Maksimal ${maksMb} MB.`}
          galat={status.galatField?.foto}
        >
          {(props) => (
            <Input
              {...props}
              type="file"
              name="foto"
              accept="image/jpeg,image/png,image/webp"
            />
          )}
        </Field>

        <TombolUnggah />
      </form>

      {punyaFoto && (
        <form action={hapusFotoSepeda}>
          <input type="hidden" name="bikeId" value={bikeId} />
          <KonfirmasiAksi
            label="Hapus foto"
            judul="Hapus foto sepeda ini?"
            keterangan="Foto hilang dari daftar sepeda dan kartu hasil scan. Untuk mengembalikannya, unggah ulang dari berkas asli."
            labelYa="Hapus foto"
            variasi="kedua"
            penuh
          />
        </form>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { unggahFotoSepeda, type StatusAksi } from "@/lib/actions/foto";
import { hapusFotoSepeda } from "@/lib/actions/foto";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PesanBerhasil, PesanGalat } from "@/components/ui/card";
import { FotoSepeda } from "./foto-sepeda";
import { Ikon } from "@/components/ui/icons";
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
            <input
              {...props}
              type="file"
              name="foto"
              accept="image/jpeg,image/png,image/webp"
              className="w-full rounded-control border border-line-strong bg-surface p-2.5 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
          )}
        </Field>

        <TombolUnggah />
      </form>

      {punyaFoto && (
        <form action={hapusFotoSepeda}>
          <input type="hidden" name="bikeId" value={bikeId} />
          <button
            type="submit"
            className="w-full rounded-control border border-line-strong px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Hapus foto
          </button>
        </form>
      )}
    </div>
  );
}

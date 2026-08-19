"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { gantiKataSandi, simpanPengaturan, type StatusAksi } from "@/lib/actions/pengaturan";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";
import type { Settings } from "@/lib/db/schema";

const AWAL: StatusAksi = {};

function TombolSimpan({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : label}
    </Button>
  );
}

export function FormPengaturan({ awal }: { awal: Settings }) {
  const [status, aksi] = useActionState(simpanPengaturan, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="namaUsaha" label="Nama usaha" galat={status.galatField?.namaUsaha} wajib>
        {(props) => (
          <Input {...props} name="namaUsaha" defaultValue={awal.namaUsaha} required />
        )}
      </Field>

      <Field id="alamat" label="Alamat" galat={status.galatField?.alamat}>
        {(props) => <Input {...props} name="alamat" defaultValue={awal.alamat ?? ""} />}
      </Field>

      <Field id="noHp" label="Nomor HP" galat={status.galatField?.noHp}>
        {(props) => (
          <Input
            {...props}
            name="noHp"
            type="tel"
            inputMode="numeric"
            defaultValue={awal.noHp ?? ""}
          />
        )}
      </Field>

      <Field
        id="batasJamRental"
        label="Batas jam rental mencurigakan"
        petunjuk="Rental yang berjalan lebih lama dari ini akan ditandai di dashboard sebagai sepeda belum kembali."
        galat={status.galatField?.batasJamRental}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="batasJamRental"
            type="number"
            inputMode="numeric"
            min={1}
            max={72}
            defaultValue={awal.batasJamRental}
            required
          />
        )}
      </Field>

      <Field
        id="toleransiBookingMenit"
        label="Toleransi keterlambatan booking (menit)"
        petunjuk="Setelah lewat dari ini, booking ditandai terlewat dan boleh dihanguskan."
        galat={status.galatField?.toleransiBookingMenit}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="toleransiBookingMenit"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={1}
            defaultValue={awal.toleransiBookingMenit}
            required
          />
        )}
      </Field>

      <TombolSimpan label="Simpan pengaturan" />
    </form>
  );
}

export function FormGantiSandi() {
  const [status, aksi] = useActionState(gantiKataSandi, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field
        id="kataSandiLama"
        label="Kata sandi sekarang"
        galat={status.galatField?.kataSandiLama}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="kataSandiLama"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>

      <Field
        id="kataSandiBaru"
        label="Kata sandi baru"
        petunjuk="Minimal 8 karakter."
        galat={status.galatField?.kataSandiBaru}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="kataSandiBaru"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <Field id="ulangi" label="Ulangi kata sandi baru" galat={status.galatField?.ulangi} wajib>
        {(props) => (
          <Input
            {...props}
            name="ulangi"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <TombolSimpan label="Ganti kata sandi" />
    </form>
  );
}

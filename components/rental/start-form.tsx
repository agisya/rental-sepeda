"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { mulaiRental, type StatusAksi } from "@/lib/actions/rental";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";

const AWAL: StatusAksi = {};

function TombolMulai() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variasi="sukses"
      ukuran="lg"
      penuh
      ikon={pending ? undefined : Ikon.sepeda}
      disabled={pending}
    >
      {pending ? "Menyimpan…" : "START RENTAL"}
    </Button>
  );
}

export function StartForm({
  bikeId,
  tarifPerJam,
}: {
  bikeId: number;
  tarifPerJam: number;
}) {
  const [status, aksi] = useActionState(mulaiRental, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      <input type="hidden" name="bikeId" value={bikeId} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="namaPenyewa" label="Nama penyewa" galat={status.galatField?.namaPenyewa} wajib>
        {(props) => (
          <Input
            {...props}
            name="namaPenyewa"
            autoComplete="off"
            placeholder="Nama lengkap"
            required
          />
        )}
      </Field>

      <Field
        id="noHp"
        label="Nomor HP"
        petunjuk="Dipakai untuk mengenali pelanggan lama dan menghubungi kalau sepeda belum kembali."
        galat={status.galatField?.noHp}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="noHp"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="08xxxxxxxxxx"
            required
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="estimasiJam"
          label="Perkiraan durasi (jam)"
          petunjuk="Hanya catatan. Tagihan tetap dihitung dari waktu kembali."
          galat={status.galatField?.estimasiJam}
        >
          {(props) => (
            <Input
              {...props}
              name="estimasiJam"
              type="number"
              inputMode="numeric"
              min={1}
              max={72}
              placeholder="2"
            />
          )}
        </Field>

        <Field
          id="metodeBayar"
          label="Rencana pembayaran"
          petunjuk="Bisa diubah saat sepeda kembali."
          galat={status.galatField?.metodeBayar}
        >
          {(props) => (
            <Select {...props} name="metodeBayar" defaultValue="">
              <option value="">Belum ditentukan</option>
              <option value="tunai">Tunai</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer</option>
            </Select>
          )}
        </Field>
      </div>

      <Field
        id="jaminan"
        label="Jaminan"
        petunjuk="Contoh: KTP, SIM, kunci motor."
        galat={status.galatField?.jaminan}
      >
        {(props) => <Input {...props} name="jaminan" placeholder="KTP" />}
      </Field>

      <Field id="catatan" label="Catatan" galat={status.galatField?.catatan}>
        {(props) => (
          <Textarea {...props} name="catatan" rows={2} placeholder="Opsional" />
        )}
      </Field>

      <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-muted">
        Tarif <span className="font-medium text-ink">{rupiah(tarifPerJam)}</span>/jam.
        Durasi dibulatkan ke atas per jam, minimum 1 jam.
      </p>

      <TombolMulai />
    </form>
  );
}

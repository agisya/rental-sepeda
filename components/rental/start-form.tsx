"use client";

import { useActionState, useState } from "react";
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
  const [estimasi, setEstimasi] = useState("");

  /*
    Perkiraan biaya dari durasi yang diketik.

    Sebelumnya petugas hanya melihat tarif per jam, jadi saat penyewa bertanya
    "kalau 3 jam berapa?" jawabannya harus dihitung di kepala di depan orangnya.
    Angka ini menjawab itu.

    Sengaja disebut perkiraan, bukan tagihan: yang menentukan tetap waktu sepeda
    benar-benar kembali, dan menyebutnya "total" akan membuat penyewa merasa
    sudah disepakati.
  */
  const jam = Number(estimasi);
  const perkiraan =
    estimasi.trim() === "" || !Number.isFinite(jam) || jam <= 0
      ? null
      : Math.round(jam) * tarifPerJam;

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
        petunjuk="Untuk mengenali pelanggan lama dan menghubungi bila sepeda belum kembali."
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
          petunjuk="Hanya catatan. Tagihan dihitung dari waktu kembali."
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
              step={1}
              value={estimasi}
              onChange={(e) => setEstimasi(e.target.value)}
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

      {perkiraan === null ? (
        <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-muted">
          Tarif <span className="font-medium text-ink">{rupiah(tarifPerJam)}</span>/jam.
          Durasi dibulatkan ke atas per jam, minimum 1 jam.
        </p>
      ) : (
        <div className="rounded-control border border-line bg-surface-2 px-3.5 py-3">
          <p className="text-xs text-ink-muted">
            Perkiraan biaya untuk {Math.round(jam)} jam
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
            {rupiah(perkiraan)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {rupiah(tarifPerJam)}/jam · yang ditagih nanti dihitung dari waktu sepeda
            benar-benar kembali, bukan dari angka ini.
          </p>
        </div>
      )}

      <TombolMulai />
    </form>
  );
}

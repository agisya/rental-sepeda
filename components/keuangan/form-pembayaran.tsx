"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { catatPembayaranPemilik, type StatusAksi } from "@/lib/actions/keuangan";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";
import { rupiah } from "@/lib/format";

const AWAL: StatusAksi = {};

function TombolSimpan() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : "Catat pembayaran"}
    </Button>
  );
}

export function FormPembayaranPemilik({
  pemilik,
  tanggalHariIni,
  pemilikAwal,
}: {
  pemilik: Array<{ id: number; nama: string; sisa: number }>;
  tanggalHariIni: string;
  pemilikAwal?: number;
}) {
  const [status, aksi] = useActionState(catatPembayaranPemilik, AWAL);
  const [ownerId, setOwnerId] = useState(pemilikAwal ? String(pemilikAwal) : "");

  const dipilih = pemilik.find((p) => String(p.id) === ownerId);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="ownerId" label="Pemilik" galat={status.galatField?.ownerId} wajib>
        {(props) => (
          <Select
            {...props}
            name="ownerId"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            required
          >
            <option value="" disabled>
              Pilih pemilik
            </option>
            {pemilik.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} — sisa {rupiah(p.sisa)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tanggal" label="Tanggal" galat={status.galatField?.tanggal} wajib>
          {(props) => (
            <Input
              {...props}
              name="tanggal"
              type="date"
              defaultValue={tanggalHariIni}
              max={tanggalHariIni}
              required
            />
          )}
        </Field>

        <Field
          id="jumlah"
          label="Jumlah (Rp)"
          petunjuk={dipilih ? `Sisa saat ini ${rupiah(dipilih.sisa)}` : undefined}
          galat={status.galatField?.jumlah}
          wajib
        >
          {(props) => (
            <Input
              {...props}
              name="jumlah"
              type="number"
              inputMode="numeric"
              min={1}
              max={dipilih?.sisa || undefined}
              step={1}
              placeholder="500000"
              required
            />
          )}
        </Field>
      </div>

      <Field id="metode" label="Metode" galat={status.galatField?.metode} wajib>
        {(props) => (
          <Select {...props} name="metode" defaultValue="tunai" required>
            <option value="tunai">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
          </Select>
        )}
      </Field>

      <Field id="catatanBayar" label="Catatan" galat={status.galatField?.catatan}>
        {(props) => (
          <Textarea
            {...props}
            name="catatan"
            rows={2}
            placeholder="Opsional — misalnya setoran bagi hasil Agustus"
          />
        )}
      </Field>

      <TombolSimpan />
    </form>
  );
}

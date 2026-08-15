"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { simpanMaintenance, type StatusAksi } from "@/lib/actions/maintenance";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";

const AWAL: StatusAksi = {};

function TombolSimpan() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : "Simpan catatan"}
    </Button>
  );
}

export function MaintenanceForm({
  sepeda,
  tanggalHariIni,
  sepedaAwal,
}: {
  sepeda: Array<{ id: number; kode: string; nama: string; status: string }>;
  tanggalHariIni: string;
  sepedaAwal?: number;
}) {
  const [status, aksi] = useActionState(simpanMaintenance, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="bikeId" label="Sepeda" galat={status.galatField?.bikeId} wajib>
        {(props) => (
          <Select {...props} name="bikeId" defaultValue={sepedaAwal ?? ""} required>
            <option value="" disabled>
              Pilih sepeda
            </option>
            {sepeda.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kode} — {s.nama}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tanggal" label="Tanggal servis" galat={status.galatField?.tanggal} wajib>
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

        <Field id="jenis" label="Jenis" galat={status.galatField?.jenis} wajib>
          {(props) => (
            <Select {...props} name="jenis" defaultValue="servis" required>
              <option value="servis">Servis</option>
              <option value="sparepart">Ganti sparepart</option>
              <option value="lainnya">Lainnya</option>
            </Select>
          )}
        </Field>
      </div>

      <Field
        id="deskripsi"
        label="Pekerjaan yang dilakukan"
        galat={status.galatField?.deskripsi}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="deskripsi"
            placeholder="Ganti kampas rem depan"
            required
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="biaya" label="Biaya (Rp)" galat={status.galatField?.biaya} wajib>
          {(props) => (
            <Input
              {...props}
              name="biaya"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              defaultValue={0}
              required
            />
          )}
        </Field>

        <Field
          id="jamPakai"
          label="Jam pakai saat servis"
          petunjuk="Pengganti kilometer. Terisi otomatis dari riwayat rental."
          galat={status.galatField?.jamPakai}
        >
          {(props) => (
            <Input {...props} name="jamPakai" type="number" inputMode="numeric" min={0} />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="tanggalServisBerikutnya"
          label="Servis berikutnya"
          petunjuk="Akan muncul sebagai pengingat saat tanggalnya tiba."
          galat={status.galatField?.tanggalServisBerikutnya}
        >
          {(props) => (
            <Input {...props} name="tanggalServisBerikutnya" type="date" min={tanggalHariIni} />
          )}
        </Field>

        <Field id="mekanik" label="Mekanik" galat={status.galatField?.mekanik}>
          {(props) => <Input {...props} name="mekanik" placeholder="Nama mekanik" />}
        </Field>
      </div>

      <Field id="catatanServis" label="Catatan mekanik" galat={status.galatField?.catatan}>
        {(props) => <Textarea {...props} name="catatan" rows={2} placeholder="Opsional" />}
      </Field>

      <div className="space-y-2.5 rounded-control bg-surface-2 p-3.5">
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            name="catatKePengeluaran"
            defaultChecked
            className="mt-0.5 size-4 accent-[var(--brand)]"
          />
          <span>
            Catat biayanya sebagai pengeluaran
            <span className="block text-xs text-ink-muted">
              Supaya ikut terhitung di Laba/Rugi. Biayanya hanya dihitung sekali.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            name="tandaiServis"
            className="mt-0.5 size-4 accent-[var(--brand)]"
          />
          <span>
            Tandai sepeda sedang servis
            <span className="block text-xs text-ink-muted">
              Sepeda tidak bisa disewakan sampai statusnya dikembalikan.
            </span>
          </span>
        </label>
      </div>

      <div className="flex gap-2">
        <ButtonLink href="/maintenance" variasi="kedua" ukuran="lg" className="flex-1">
          Batal
        </ButtonLink>
        <div className="flex-1">
          <TombolSimpan />
        </div>
      </div>
    </form>
  );
}

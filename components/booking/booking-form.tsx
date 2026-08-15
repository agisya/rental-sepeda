"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { buatBooking, type StatusAksi } from "@/lib/actions/booking";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";
import { rupiah } from "@/lib/format";

const AWAL: StatusAksi = {};

type PilihanSepeda = {
  id: number;
  kode: string;
  nama: string;
  tarifPerJam: number;
};

/** Jam operasional yang wajar untuk rental sepeda. */
const JAM_PILIHAN = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00–22:00

function TombolSimpan() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : "Simpan Booking"}
    </Button>
  );
}

export function BookingForm({
  sepeda,
  tanggalMinimal,
  tanggalAwal,
  sepedaAwal,
}: {
  sepeda: PilihanSepeda[];
  tanggalMinimal: string;
  tanggalAwal: string;
  sepedaAwal?: number;
}) {
  const [status, aksi] = useActionState(buatBooking, AWAL);
  const [bikeId, setBikeId] = useState(sepedaAwal ? String(sepedaAwal) : "");
  const [durasi, setDurasi] = useState(2);

  const dipilih = sepeda.find((s) => String(s.id) === bikeId);
  const perkiraan = dipilih ? dipilih.tarifPerJam * durasi : 0;

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="bikeId" label="Sepeda" galat={status.galatField?.bikeId} wajib>
        {(props) => (
          <Select
            {...props}
            name="bikeId"
            value={bikeId}
            onChange={(e) => setBikeId(e.target.value)}
            required
          >
            <option value="" disabled>
              Pilih sepeda
            </option>
            {sepeda.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kode} — {s.nama} ({rupiah(s.tarifPerJam)}/jam)
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        id="namaPenyewa"
        label="Nama penyewa"
        galat={status.galatField?.namaPenyewa}
        wajib
      >
        {(props) => <Input {...props} name="namaPenyewa" autoComplete="off" required />}
      </Field>

      <Field id="noHp" label="Nomor HP" galat={status.galatField?.noHp} wajib>
        {(props) => (
          <Input
            {...props}
            name="noHp"
            type="tel"
            inputMode="numeric"
            placeholder="08xxxxxxxxxx"
            autoComplete="off"
            required
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="tanggal" label="Tanggal" galat={status.galatField?.tanggal} wajib>
          {(props) => (
            <Input
              {...props}
              name="tanggal"
              type="date"
              defaultValue={tanggalAwal}
              min={tanggalMinimal}
              required
            />
          )}
        </Field>

        <Field id="jam" label="Jam mulai" galat={status.galatField?.jam} wajib>
          {(props) => (
            <Select {...props} name="jam" defaultValue="9" required>
              {JAM_PILIHAN.map((j) => (
                <option key={j} value={j}>
                  {String(j).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          id="durasiJam"
          label="Durasi (jam)"
          galat={status.galatField?.durasiJam}
          wajib
        >
          {(props) => (
            <Input
              {...props}
              name="durasiJam"
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              value={durasi}
              onChange={(e) => setDurasi(Math.max(1, Number(e.target.value) || 1))}
              required
            />
          )}
        </Field>
      </div>

      <Field
        id="metodeBayar"
        label="Rencana pembayaran"
        petunjuk="Pembayaran tetap dilakukan saat sepeda dikembalikan."
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

      <Field id="catatan" label="Catatan" galat={status.galatField?.catatan}>
        {(props) => <Textarea {...props} name="catatan" rows={2} placeholder="Opsional" />}
      </Field>

      {dipilih && (
        <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-muted">
          Perkiraan biaya{" "}
          <span className="font-semibold text-ink">{rupiah(perkiraan)}</span> untuk{" "}
          {durasi} jam. Tagihan akhir dihitung dari jam kembali yang sebenarnya.
        </p>
      )}

      <div className="flex gap-2">
        <ButtonLink href="/booking" variasi="kedua" ukuran="lg" className="flex-1">
          Batal
        </ButtonLink>
        <div className="flex-1">
          <TombolSimpan />
        </div>
      </div>
    </form>
  );
}

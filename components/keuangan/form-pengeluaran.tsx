"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { simpanPengeluaran, type StatusAksi } from "@/lib/actions/keuangan";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";

const AWAL: StatusAksi = {};

const KATEGORI = [
  { nilai: "gaji", label: "Gaji" },
  { nilai: "listrik", label: "Listrik" },
  { nilai: "pdam", label: "PDAM" },
  { nilai: "maintenance", label: "Maintenance" },
  { nilai: "sparepart", label: "Sparepart" },
  { nilai: "operasional", label: "Operasional" },
  { nilai: "lainnya", label: "Lain-lain" },
];

function TombolSimpan() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : "Catat pengeluaran"}
    </Button>
  );
}

export function FormPengeluaran({ tanggalHariIni }: { tanggalHariIni: string }) {
  const [status, aksi] = useActionState(simpanPengeluaran, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

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

        <Field id="kategori" label="Kategori" galat={status.galatField?.kategori} wajib>
          {(props) => (
            <Select {...props} name="kategori" defaultValue="operasional" required>
              {KATEGORI.map((k) => (
                <option key={k.nilai} value={k.nilai}>
                  {k.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field id="keterangan" label="Keterangan" galat={status.galatField?.keterangan} wajib>
        {(props) => (
          <Input
            {...props}
            name="keterangan"
            placeholder="Bayar listrik bulan Agustus"
            required
          />
        )}
      </Field>

      <Field id="jumlah" label="Jumlah (Rp)" galat={status.galatField?.jumlah} wajib>
        {(props) => (
          <Input
            {...props}
            name="jumlah"
            type="number"
            inputMode="numeric"
            min={1}
            // step wajib 1. Peramban hanya menerima nilai berjarak kelipatan
            // step dari min, jadi step 1000 dengan min 1 membuat 9.000 ditolak
            // sementara 9.001 diterima — penolakan yang tidak masuk akal bagi
            // orang yang mengetik dan tidak menjelaskan apa pun.
            step={1}
            placeholder="250000"
            required
          />
        )}
      </Field>

      <Field
        id="metode"
        label="Dibayar dengan"
        petunjuk="Yang tunai mengurangi uang toko saat tutup toko"
        galat={status.galatField?.metode}
        wajib
      >
        {(props) => (
          <Select {...props} name="metode" defaultValue="tunai" required>
            <option value="tunai">Tunai — dari uang toko</option>
            <option value="transfer">Transfer — dari rekening</option>
            <option value="qris">QRIS</option>
          </Select>
        )}
      </Field>

      <TombolSimpan />
    </form>
  );
}

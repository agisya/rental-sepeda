"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { tutupKas, terimaSetoranKas, type StatusAksi } from "@/lib/actions/kas";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PesanBerhasil, PesanGalat } from "@/components/ui/card";
import { rupiah } from "@/lib/format";

const AWAL: StatusAksi = {};

function TombolTutup() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : "Tutup kas hari ini"}
    </Button>
  );
}

/**
 * Formulir penutupan kas.
 *
 * Jumlah yang diserahkan sengaja tidak diisi otomatis dengan angka sistem.
 * Kalau kolomnya sudah terisi angka "yang benar", orang akan menekan simpan
 * tanpa menghitung uangnya — dan selisih yang seharusnya ketahuan hari itu
 * justru tertutup rapi oleh aplikasi ini sendiri.
 */
export function FormTutupKas({
  tanggal,
  jumlahSeharusnya,
}: {
  tanggal: string;
  jumlahSeharusnya: number;
}) {
  const [status, aksi] = useActionState(tutupKas, AWAL);
  const [diserahkan, setDiserahkan] = useState("");

  const angka = Number(diserahkan);
  const selisih = diserahkan.trim() === "" || Number.isNaN(angka)
    ? null
    : angka - jumlahSeharusnya;

  return (
    <form action={aksi} className="space-y-4">
      <input type="hidden" name="tanggal" value={tanggal} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      {status.berhasil && <PesanBerhasil>{status.berhasil}</PesanBerhasil>}

      <Field
        id="jumlahDiserahkan"
        label="Uang yang diserahkan"
        petunjuk="Hitung uang fisiknya dulu, baru isi di sini"
        galat={status.galatField?.jumlahDiserahkan}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="jumlahDiserahkan"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={diserahkan}
            onChange={(e) => setDiserahkan(e.target.value)}
            placeholder="0"
            required
          />
        )}
      </Field>

      {selisih !== null && (
        <p
          className={
            selisih === 0
              ? "text-sm font-medium text-ok"
              : "text-sm font-medium text-danger"
          }
        >
          {selisih === 0
            ? "Pas dengan catatan sistem."
            : selisih > 0
              ? `Lebih ${rupiah(selisih)} dari catatan sistem.`
              : `Kurang ${rupiah(Math.abs(selisih))} dari catatan sistem.`}
        </p>
      )}

      <Field
        id="catatan"
        label="Catatan"
        petunjuk="Wajib diisi kalau ada selisih — jelaskan sebabnya selagi masih ingat"
        galat={status.galatField?.catatan}
      >
        {(props) => (
          <Textarea {...props} name="catatan" rows={2} placeholder="mis. dipakai beli ban dalam" />
        )}
      </Field>

      <TombolTutup />
    </form>
  );
}

function TombolTerima() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="sm" variasi="sukses" disabled={pending}>
      {pending ? "Menyimpan…" : "Tandai diterima"}
    </Button>
  );
}

/** Tombol bagi admin dan owner untuk menyatakan uangnya benar-benar diterima. */
export function FormTerimaSetoran({ id }: { id: number }) {
  const [status, aksi] = useActionState(terimaSetoranKas, AWAL);

  return (
    <form action={aksi} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      <TombolTerima />
    </form>
  );
}

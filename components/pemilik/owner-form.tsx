"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { simpanPemilik, type StatusAksi } from "@/lib/actions/owners";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { KotakKeterangan, PesanGalat } from "@/components/ui/card";

const AWAL: StatusAksi = {};

type NilaiAwal = {
  id?: number;
  nama?: string;
  noHp?: string;
  alamat?: string | null;
  persentaseBagiHasil?: number;
  milikSendiri?: boolean;
  catatan?: string | null;
  aktif?: boolean;
};

function TombolSimpan({ ubah }: { ubah: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : ubah ? "Simpan perubahan" : "Tambah pemilik"}
    </Button>
  );
}

export function OwnerForm({ awal }: { awal?: NilaiAwal }) {
  const [status, aksi] = useActionState(simpanPemilik, AWAL);
  const [milikSendiri, setMilikSendiri] = useState(awal?.milikSendiri ?? false);
  const ubah = Boolean(awal?.id);

  return (
    <form action={aksi} className="space-y-4">
      {awal?.id && <input type="hidden" name="id" value={awal.id} />}

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="nama" label="Nama pemilik" galat={status.galatField?.nama} wajib>
        {(props) => (
          <Input {...props} name="nama" defaultValue={awal?.nama} required autoFocus={!ubah} />
        )}
      </Field>

      <Field id="noHp" label="Nomor HP" galat={status.galatField?.noHp} wajib>
        {(props) => (
          <Input
            {...props}
            name="noHp"
            type="tel"
            inputMode="numeric"
            defaultValue={awal?.noHp}
            placeholder="08xxxxxxxxxx"
            required
          />
        )}
      </Field>

      <Field id="alamat" label="Alamat" galat={status.galatField?.alamat}>
        {(props) => <Input {...props} name="alamat" defaultValue={awal?.alamat ?? ""} />}
      </Field>

      {/* Penanda milik sendiri ditaruh SEBELUM kolom persentase, karena ia
          menentukan apakah kolom itu masih ada gunanya. Menaruhnya di bawah
          membuat orang mengisi persentase dulu lalu bingung kenapa hilang. */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line px-3.5 py-3 text-sm text-ink transition-colors hover:border-line-strong">
        <input
          type="checkbox"
          name="milikSendiri"
          checked={milikSendiri}
          onChange={(e) => setMilikSendiri(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-brand"
        />
        <span>
          Ini sepeda milik rental sendiri
          <span className="mt-0.5 block text-xs text-ink-muted">
            Seluruh omzetnya menjadi pendapatan rental, tanpa bagi hasil. Hanya boleh
            ada satu.
          </span>
        </span>
      </label>

      {milikSendiri ? (
        <KotakKeterangan>
          Bagian pemilik otomatis 0% — tidak ada yang perlu disetorkan, dan seluruh
          omzetnya masuk ke laba rental.
        </KotakKeterangan>
      ) : (
        <Field
          id="persentaseBagiHasil"
          label="Bagian pemilik (%)"
          petunjuk="Sisanya bagian rental. Contoh: 60 berarti pemilik 60%, rental 40%."
          galat={status.galatField?.persentaseBagiHasil}
          wajib
        >
          {(props) => (
            <Input
              {...props}
              name="persentaseBagiHasil"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              defaultValue={awal?.persentaseBagiHasil ?? 60}
              required
            />
          )}
        </Field>
      )}

      <Field id="catatan" label="Catatan" galat={status.galatField?.catatan}>
        {(props) => (
          <Textarea {...props} name="catatan" rows={2} defaultValue={awal?.catatan ?? ""} />
        )}
      </Field>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="aktif"
          defaultChecked={awal?.aktif ?? true}
          className="size-4 shrink-0 accent-brand"
        />
        Pemilik masih aktif
      </label>

      <KotakKeterangan className="text-xs">
        Mengubah persentase hanya berlaku untuk rental berikutnya. Transaksi yang sudah
        tercatat tetap memakai persentase saat itu.
      </KotakKeterangan>

      <div className="flex gap-2">
        <ButtonLink href="/pemilik" variasi="kedua" ukuran="lg" className="flex-1">
          Batal
        </ButtonLink>
        <div className="flex-1">
          <TombolSimpan ubah={ubah} />
        </div>
      </div>
    </form>
  );
}

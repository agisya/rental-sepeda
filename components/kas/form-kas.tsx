"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  batalkanSetoranKas,
  catatPengeluaranDariLaci,
  terimaSetoranKas,
  tutupKas,
  type StatusAksi,
} from "@/lib/actions/kas";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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

const KATEGORI = [
  { nilai: "sparepart", label: "Sparepart — ban, rantai, rem" },
  { nilai: "operasional", label: "Operasional — bensin, parkir, makan" },
  { nilai: "maintenance", label: "Servis sepeda" },
  { nilai: "listrik", label: "Listrik" },
  { nilai: "pdam", label: "PDAM" },
  { nilai: "gaji", label: "Gaji" },
  { nilai: "lainnya", label: "Lain-lain" },
] as const;

function TombolCatat() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" penuh disabled={pending}>
      {pending ? "Menyimpan…" : "Catat pengeluaran"}
    </Button>
  );
}

/**
 * Mencatat uang yang diambil dari laci.
 *
 * Metode pembayaran tidak ditanyakan. Uang yang diambil dari laci menurut
 * definisinya tunai, dan menanyakannya hanya menambah satu pilihan yang
 * jawabannya sudah pasti — sekaligus membuka jalan salah pilih yang membuat
 * setorannya tidak berkurang.
 */
export function FormPengeluaranLaci({ tanggal }: { tanggal: string }) {
  const [status, aksi] = useActionState(catatPengeluaranDariLaci, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      <input type="hidden" name="tanggal" value={tanggal} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      {status.berhasil && <PesanBerhasil>{status.berhasil}</PesanBerhasil>}

      <Field
        id="keterangan-laci"
        label="Untuk apa"
        galat={status.galatField?.keterangan}
        wajib
      >
        {(props) => (
          <Input {...props} name="keterangan" placeholder="Ban dalam MTB-004" required />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="jumlah-laci" label="Jumlah (Rp)" galat={status.galatField?.jumlah} wajib>
          {(props) => (
            <Input
              {...props}
              name="jumlah"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="25000"
              required
            />
          )}
        </Field>

        <Field id="kategori-laci" label="Kategori" galat={status.galatField?.kategori} wajib>
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

      <TombolCatat />
    </form>
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

function TombolBatal() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="sm" variasi="bahaya" disabled={pending}>
      {pending ? "Membatalkan…" : "Batalkan"}
    </Button>
  );
}

/**
 * Membatalkan penutupan yang salah ketik.
 *
 * Alasannya diketik lebih dulu, di kolom yang selalu terlihat. Pembatalan tanpa
 * alasan pada catatan uang sama saja dengan menghapusnya — dan besok tidak ada
 * yang ingat kenapa angka hari itu berubah.
 */
export function FormBatalkanSetoran({ id }: { id: number }) {
  const [status, aksi] = useActionState(batalkanSetoranKas, AWAL);

  return (
    <form action={aksi} className="space-y-2">
      <input type="hidden" name="id" value={id} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-44 flex-1">
          <Field
            id={`alasan-batal-${id}`}
            label="Alasan pembatalan"
            galat={status.galatField?.alasan}
          >
            {(props) => (
              <Input {...props} name="alasan" placeholder="Salah ketik jumlah" />
            )}
          </Field>
        </div>
        <div className="pt-7">
          <TombolBatal />
        </div>
      </div>
    </form>
  );
}

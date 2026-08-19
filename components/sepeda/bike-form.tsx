"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { simpanSepeda, type StatusAksi } from "@/lib/actions/bikes";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";

const AWAL: StatusAksi = {};

type PilihanPemilik = {
  id: number;
  nama: string;
  persentaseBagiHasil: number;
  milikSendiri: boolean;
};

type NilaiAwal = {
  id?: number;
  kode?: string;
  nama?: string;
  jenis?: string;
  merk?: string | null;
  tarifPerJam?: number;
  ownerId?: number;
  status?: string;
  catatan?: string | null;
};

const JENIS_UMUM = ["MTB", "City Bike", "Sepeda Lipat", "Sepeda Anak", "BMX", "Road Bike"];

function TombolSimpan({ ubah }: { ubah: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Menyimpan…" : ubah ? "Simpan perubahan" : "Tambah sepeda"}
    </Button>
  );
}

export function BikeForm({
  pemilik,
  awal,
  sedangDisewa = false,
}: {
  pemilik: PilihanPemilik[];
  awal?: NilaiAwal;
  sedangDisewa?: boolean;
}) {
  // Kolom foto hanya pada sepeda baru. Di halaman ubah sudah ada kartu foto
  // tersendiri yang bisa menampilkan foto sekarang dan menggantinya; dua kontrol
  // untuk hal yang sama di satu halaman hanya membingungkan.
  const [status, aksi] = useActionState(simpanSepeda, AWAL);
  const ubah = Boolean(awal?.id);

  return (
    <form action={aksi} className="space-y-4">
      {awal?.id && <input type="hidden" name="id" value={awal.id} />}

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field
        id="kode"
        label="Kode / isi barcode"
        petunjuk="Kode ini yang dicetak jadi stiker dan dibaca scanner. Contoh: MTB-023."
        galat={status.galatField?.kode}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="kode"
            defaultValue={awal?.kode}
            placeholder="MTB-023"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="uppercase"
            required
            autoFocus={!ubah}
          />
        )}
      </Field>

      <Field id="nama" label="Nama sepeda" galat={status.galatField?.nama} wajib>
        {(props) => (
          <Input
            {...props}
            name="nama"
            defaultValue={awal?.nama}
            placeholder="Polygon Xtrada 7"
            required
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="jenis" label="Jenis" galat={status.galatField?.jenis} wajib>
          {(props) => (
            <>
              <Input
                {...props}
                name="jenis"
                defaultValue={awal?.jenis}
                list="daftar-jenis"
                placeholder="MTB"
                required
              />
              <datalist id="daftar-jenis">
                {JENIS_UMUM.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field id="merk" label="Merk" galat={status.galatField?.merk}>
          {(props) => (
            <Input
              {...props}
              name="merk"
              defaultValue={awal?.merk ?? ""}
              placeholder="Polygon"
            />
          )}
        </Field>
      </div>

      <Field
        id="tarifPerJam"
        label="Tarif per jam (Rp)"
        petunjuk="Rupiah bulat tanpa titik. Contoh: 15000."
        galat={status.galatField?.tarifPerJam}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="tarifPerJam"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={awal?.tarifPerJam ?? 15000}
            required
          />
        )}
      </Field>

      <Field
        id="ownerId"
        label="Pemilik"
        petunjuk="Menentukan ke siapa bagi hasil rental sepeda ini masuk."
        galat={status.galatField?.ownerId}
        wajib
      >
        {(props) => (
          <Select {...props} name="ownerId" defaultValue={awal?.ownerId ?? ""} required>
            <option value="" disabled>
              Pilih pemilik
            </option>
            {/* Sepeda milik sendiri ditulis apa adanya, bukan sebagai "0%".
                Persentase nol menuntut orang menerjemahkannya sendiri; kalimat
                ini menyebut langsung apa artinya. */}
            {pemilik.map((p) => (
              <option key={p.id} value={p.id}>
                {p.milikSendiri
                  ? `Milik sendiri — ${p.nama} (tanpa bagi hasil)`
                  : `${p.nama} (bagi hasil ${p.persentaseBagiHasil}%)`}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        id="status"
        label="Status"
        petunjuk={
          sedangDisewa
            ? "Sepeda sedang disewa. Statusnya hanya bisa diubah setelah rental diselesaikan."
            : undefined
        }
        galat={status.galatField?.status}
        wajib
      >
        {(props) => (
          <Select
            {...props}
            name="status"
            defaultValue={awal?.status ?? "tersedia"}
            disabled={sedangDisewa}
            required
          >
            <option value="tersedia">Tersedia</option>
            {sedangDisewa && <option value="disewa">Sedang disewa</option>}
            <option value="servis">Servis</option>
            <option value="nonaktif">Tidak aktif</option>
          </Select>
        )}
      </Field>
      {sedangDisewa && <input type="hidden" name="status" value="disewa" />}

      <Field id="catatan" label="Catatan" galat={status.galatField?.catatan}>
        {(props) => (
          <Textarea
            {...props}
            name="catatan"
            rows={2}
            defaultValue={awal?.catatan ?? ""}
            placeholder="Opsional — misalnya kondisi rem atau ban"
          />
        )}
      </Field>

      {/* Foto ditaruh paling bawah, tepat sebelum tombol simpan. Kalau tombolnya
          berada di atas kolom ini, orang menekan simpan lebih dulu dan fotonya
          terlupakan — dan sesudah tersimpan tidak ada apa pun yang
          mengingatkan. */}
      {!ubah && (
        <Field
          id="foto"
          label="Foto sepeda"
          petunjuk="Boleh dilewati, tapi jauh lebih mudah dikenali kalau ada. JPG, PNG, atau WebP."
          galat={status.galatField?.foto}
        >
          {(props) => (
            <Input
              {...props}
              name="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="py-2"
            />
          )}
        </Field>
      )}

      <div className="flex gap-2">
        <ButtonLink href="/sepeda" variasi="kedua" ukuran="lg" className="flex-1">
          Batal
        </ButtonLink>
        <div className="flex-1">
          <TombolSimpan ubah={ubah} />
        </div>
      </div>
    </form>
  );
}

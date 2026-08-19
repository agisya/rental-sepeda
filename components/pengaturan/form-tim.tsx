"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  setelUlangSandiAnggota,
  tambahAnggota,
  ubahStatusAnggota,
  type StatusAksi,
} from "@/lib/actions/pengguna";
import type { RingkasanPengguna } from "@/lib/pengguna/kelola";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PesanBerhasil, PesanGalat } from "@/components/ui/card";
import { KonfirmasiAksi } from "@/components/ui/konfirmasi";
import { cn } from "@/lib/cn";

const AWAL: StatusAksi = {};

/**
 * Lencana aktif/nonaktif.
 *
 * status-badge.tsx sengaja terikat pada enum status sepeda dan rental, jadi tidak
 * bisa dipakai di sini. Bentuknya disamakan supaya tampilannya tetap satu bahasa.
 */
function LencanaAktif({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        aktif ? "bg-ok-soft text-ok" : "bg-idle-soft text-idle",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", aktif ? "bg-ok" : "bg-idle")}
      />
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}

const LABEL_PERAN: Record<RingkasanPengguna["peran"], string> = {
  admin: "Admin",
  kasir: "Kasir",
  owner: "Owner",
};

function TombolKirim({ label, sedang }: { label: string; sedang: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? sedang : label}
    </Button>
  );
}

function TombolKecil({
  label,
  sedang,
  variasi,
}: {
  label: string;
  sedang: string;
  variasi: "kedua" | "bahaya";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="sm" variasi={variasi} disabled={pending}>
      {pending ? sedang : label}
    </Button>
  );
}

export function FormTambahAnggota() {
  const [status, aksi] = useActionState(tambahAnggota, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      {status.berhasil && <PesanBerhasil>{status.berhasil}</PesanBerhasil>}

      <Field id="nama-anggota" label="Nama lengkap" galat={status.galatField?.nama} wajib>
        {(props) => <Input {...props} name="nama" autoComplete="off" required />}
      </Field>

      <Field
        id="username-anggota"
        label="Username"
        petunjuk="Huruf kecil, angka, titik, garis bawah, atau tanda hubung"
        galat={status.galatField?.username}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="username"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        )}
      </Field>

      <Field
        id="peran-anggota"
        label="Peran"
        petunjuk="Kasir tidak bisa melihat menu keuangan"
        galat={status.galatField?.peran}
        wajib
      >
        {(props) => (
          <Select {...props} name="peran" defaultValue="kasir" required>
            <option value="kasir">Kasir — operasional harian, tanpa akses keuangan</option>
            <option value="admin">Admin — semua data dan keuangan</option>
            <option value="owner">Owner — semua data dan keuangan</option>
          </Select>
        )}
      </Field>

      <Field
        id="sandi-anggota"
        label="Kata sandi awal"
        petunjuk="Minimal 8 karakter. Minta yang bersangkutan menggantinya sendiri setelah masuk."
        galat={status.galatField?.kataSandi}
        wajib
      >
        {(props) => (
          <Input {...props} name="kataSandi" type="text" autoComplete="off" required />
        )}
      </Field>

      <TombolKirim label="Tambah anggota" sedang="Menyimpan…" />
    </form>
  );
}

function FormStatus({ anggota }: { anggota: RingkasanPengguna }) {
  const [status, aksi] = useActionState(ubahStatusAnggota, AWAL);

  return (
    <form action={aksi} className="contents">
      <input type="hidden" name="id" value={anggota.id} />
      <input type="hidden" name="aktif" value={anggota.aktif ? "0" : "1"} />

      {status.galat && (
        <div className="col-span-full">
          <PesanGalat>{status.galat}</PesanGalat>
        </div>
      )}

      {/* Hanya penonaktifan yang ditanyakan. Mengaktifkan kembali tidak merugikan
          siapa pun dan mudah dibatalkan; menonaktifkan langsung mengunci orangnya
          keluar pada permintaan berikutnya — termasuk kalau ia sedang di tengah
          mencatat rental. */}
      {anggota.aktif ? (
        <KonfirmasiAksi
          label="Nonaktifkan"
          judul={`Nonaktifkan akun ${anggota.nama}?`}
          keterangan="Aksesnya terputus segera, bahkan kalau sedang membuka aplikasi. Semua catatan yang pernah ia buat tetap utuh, dan akunnya bisa diaktifkan lagi kapan saja."
          labelYa="Nonaktifkan"
          variasi="bahaya"
          ukuran="sm"
        />
      ) : (
        <TombolKecil label="Aktifkan" sedang="Menyimpan…" variasi="kedua" />
      )}
    </form>
  );
}

function FormSetelUlang({ anggota }: { anggota: RingkasanPengguna }) {
  const [status, aksi] = useActionState(setelUlangSandiAnggota, AWAL);

  return (
    <form action={aksi} className="space-y-2">
      <input type="hidden" name="id" value={anggota.id} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      {status.berhasil && <PesanBerhasil>{status.berhasil}</PesanBerhasil>}

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-48 flex-1">
          <Field
            id={`sandi-baru-${anggota.id}`}
            label="Kata sandi baru"
            galat={status.galatField?.kataSandi}
          >
            {(props) => (
              <Input
                {...props}
                name="kataSandi"
                type="text"
                autoComplete="off"
                placeholder="Minimal 8 karakter"
              />
            )}
          </Field>
        </div>
        <div className="pt-7">
          <TombolKecil label="Setel ulang" sedang="Menyimpan…" variasi="kedua" />
        </div>
      </div>
    </form>
  );
}

export function DaftarTim({
  anggota,
  idSaya,
}: {
  anggota: RingkasanPengguna[];
  idSaya: number;
}) {
  return (
    <ul className="divide-y divide-line">
      {anggota.map((orang) => (
        <li key={orang.id} className="space-y-3 px-4 py-3.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {orang.nama}
                {orang.id === idSaya && (
                  <span className="ml-2 text-xs font-normal text-ink-faint">(Anda)</span>
                )}
              </p>
              <p className="text-xs text-ink-muted">
                {orang.username} · {LABEL_PERAN[orang.peran]}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <LencanaAktif aktif={orang.aktif} />

              {/* Tombol nonaktifkan tidak ditampilkan untuk diri sendiri. Action-nya
                  juga menolaknya, tapi tombol yang pasti gagal lebih baik tidak ada. */}
              {orang.id !== idSaya && <FormStatus anggota={orang} />}
            </div>
          </div>

          <FormSetelUlang anggota={orang} />
        </li>
      ))}
    </ul>
  );
}

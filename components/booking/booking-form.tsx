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
  jamTerpakai,
}: {
  /**
   * Sepeda yang sudah dipastikan lewat scan, bukan daftar untuk dipilih.
   *
   * Memilih dari dropdown berarti mencari kode sepeda yang justru sedang
   * dipegang petugas — pekerjaan tambahan yang satu-satunya hasil mungkinnya
   * adalah salah pilih.
   */
  sepeda: PilihanSepeda;
  tanggalMinimal: string;
  tanggalAwal: string;
  /** Jam WIB yang sudah dipesan pada sepeda ini. */
  jamTerpakai: { tanggal: string; jam: number }[];
}) {
  const [status, aksi] = useActionState(buatBooking, AWAL);
  const [durasi, setDurasi] = useState(2);
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [jamMulai, setJamMulai] = useState(9);

  /*
    Jam yang sudah dipesan untuk sepeda dan tanggal yang sedang dipilih.

    Sebelumnya bentrok baru ketahuan setelah menekan simpan, lalu petugas harus
    menebak jam lain dan mencoba lagi — sambil penyewa menunggu di telepon.
  */
  const terpakai = new Set(
    jamTerpakai.filter((t) => t.tanggal === tanggal).map((t) => t.jam),
  );

  /*
    Bentrok karena durasi, bukan karena jam mulainya.

    Mematikan jam mulai yang terpakai saja tidak cukup: mulai 09:00 selama 3 jam
    tetap menabrak kalau jam 10 sudah dipesan. Jam-jam itu diperiksa di sini
    supaya terlihat sebelum disimpan, bukan setelah ditolak.
  */
  const bentrok = Array.from({ length: durasi }, (_, i) => jamMulai + i).filter((j) =>
    terpakai.has(j),
  );

  const perkiraan = sepeda.tarifPerJam * durasi;

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      {/* Sepedanya ditampilkan, bukan dipilih. Nilainya dikirim lewat kolom
          tersembunyi karena sudah dipastikan dari QR yang dipindai. */}
      <input type="hidden" name="bikeId" value={sepeda.id} />

      <div className="rounded-control border border-line bg-surface-2 px-3.5 py-3">
        <p className="text-xs text-ink-muted">Sepeda yang dipesan</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">
          {sepeda.kode} — {sepeda.nama}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {rupiah(sepeda.tarifPerJam)}/jam
        </p>
      </div>

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
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              min={tanggalMinimal}
              required
            />
          )}
        </Field>

        {/* Jam yang sudah dipesan dimatikan, bukan hanya diberi tanda. Pilihan
            yang bisa dipilih tapi pasti ditolak sama saja dengan menyuruh orang
            menebak. */}
        <Field id="jam" label="Jam mulai" galat={status.galatField?.jam} wajib>
          {(props) => (
            <Select
              {...props}
              name="jam"
              value={jamMulai}
              onChange={(e) => setJamMulai(Number(e.target.value))}
              required
            >
              {JAM_PILIHAN.map((j) => (
                <option key={j} value={j} disabled={terpakai.has(j)}>
                  {String(j).padStart(2, "0")}:00
                  {terpakai.has(j) ? " — sudah dipesan" : ""}
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

      {bentrok.length > 0 && (
        <p role="status" className="rounded-control border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          Jam {bentrok.map((j) => `${String(j).padStart(2, "0")}:00`).join(", ")} sudah
          dipesan orang lain untuk sepeda ini. Kurangi durasinya, geser jam mulainya,
          atau pilih sepeda lain.
        </p>
      )}

      {terpakai.size > 0 && bentrok.length === 0 && (
        <p className="text-sm text-ink-muted">
          Sudah dipesan pada tanggal ini:{" "}
          {[...terpakai]
            .sort((a, b) => a - b)
            .map((j) => `${String(j).padStart(2, "0")}:00`)
            .join(", ")}
          .
        </p>
      )}

      <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-muted">
        Perkiraan biaya{" "}
        <span className="font-semibold text-ink">{rupiah(perkiraan)}</span> untuk{" "}
        {durasi} jam. Tagihan akhir dihitung dari jam kembali yang sebenarnya.
      </p>

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

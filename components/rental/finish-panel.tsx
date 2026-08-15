"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { selesaikanRental, type StatusAksi } from "@/lib/actions/rental";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { BarisData, DaftarData, PesanGalat } from "@/components/ui/card";
import { Ikon } from "@/components/ui/icons";
import { hitungBiaya } from "@/lib/rental/pricing";
import { rupiah } from "@/lib/format";
import { useSekarangMs } from "@/lib/jam";
import { formatDurasi } from "@/lib/waktu";

const AWAL: StatusAksi = {};

function TombolSelesai() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variasi="bahaya"
      ukuran="lg"
      penuh
      ikon={pending ? undefined : Ikon.selesai}
      disabled={pending}
    >
      {pending ? "Menghitung…" : "SELESAIKAN RENTAL"}
    </Button>
  );
}

/**
 * Perkiraan biaya yang berjalan. Angka final tetap dihitung ulang di server saat
 * tombol ditekan — ini hanya supaya petugas bisa menyebutkan perkiraan tagihan
 * sebelum menyelesaikan rental.
 */
export function FinishPanel({
  rentalId,
  waktuMulaiISO,
  tarifPerJam,
  persentasePemilik,
  metodeBayarAwal,
}: {
  rentalId: number;
  waktuMulaiISO: string;
  tarifPerJam: number;
  persentasePemilik: number;
  metodeBayarAwal: string | null;
}) {
  const [status, aksi] = useActionState(selesaikanRental, AWAL);
  const waktuMulai = new Date(waktuMulaiISO);
  const mulaiMs = waktuMulai.getTime();

  // Saat render server dan hidrasi, jam bernilai sama dengan waktu mulai
  // sehingga tidak ada ketidakcocokan. Setelah itu barulah ikut waktu klien.
  const sekarangMs = useSekarangMs(mulaiMs);
  const berdetak = sekarangMs > mulaiMs;

  const perkiraan = hitungBiaya({
    waktuMulai,
    waktuSelesai: new Date(Math.max(sekarangMs, mulaiMs)),
    tarifPerJam,
    persentasePemilik,
  });

  return (
    <div className="space-y-4">
      {/* Perkiraan total ditonjolkan: inilah angka yang disebutkan ke penyewa
          sebelum tombol selesai ditekan. */}
      <div className="rounded-card border border-line bg-surface-2">
        <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <p className="label-bagian">Perkiraan total</p>
            <p className="angka-utama mt-1 text-ink">{rupiah(perkiraan.totalBiaya)}</p>
          </div>
          <p className="pb-1 text-right text-sm text-ink-muted">
            {berdetak ? formatDurasi(perkiraan.durasiMenit) : "Menghitung…"}
            <span className="block text-xs text-ink-faint">
              ditagih {perkiraan.durasiJamDitagih} jam
            </span>
          </p>
        </div>

        <DaftarData className="border-t border-line">
          <BarisData label={`Bagian pemilik (${persentasePemilik}%)`}>
            {rupiah(perkiraan.bagianPemilik)}
          </BarisData>
          <BarisData label="Bagian rental">{rupiah(perkiraan.bagianRental)}</BarisData>
        </DaftarData>
      </div>

      <p className="text-xs text-ink-muted">
        Angka di atas masih berjalan. Total pastinya dihitung saat tombol ditekan.
      </p>

      <form action={aksi} className="space-y-4">
        <input type="hidden" name="rentalId" value={rentalId} />

        {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

        <Field
          id="metodeBayar"
          label="Metode pembayaran"
          galat={status.galatField?.metodeBayar}
          wajib
        >
          {(props) => (
            <Select
              {...props}
              name="metodeBayar"
              defaultValue={metodeBayarAwal ?? "tunai"}
              required
            >
              <option value="tunai">Tunai</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer</option>
            </Select>
          )}
        </Field>

        <Field id="catatanSelesai" label="Catatan" galat={status.galatField?.catatan}>
          {(props) => (
            <Textarea
              {...props}
              name="catatan"
              rows={2}
              placeholder="Opsional — misalnya kondisi sepeda saat kembali"
            />
          )}
        </Field>

        <TombolSelesai />
      </form>
    </div>
  );
}

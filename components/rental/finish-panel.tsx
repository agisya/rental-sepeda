"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { selesaikanRental, type StatusAksi } from "@/lib/actions/rental";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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
 * Perkiraan biaya yang berjalan, plus keputusan denda keterlambatan.
 *
 * Angka final tetap dihitung ulang di server saat tombol ditekan — yang di sini
 * hanya supaya petugas bisa menyebutkan perkiraan tagihan lebih dulu. Satu-satunya
 * hal yang benar-benar dikirim sebagai keputusan adalah tambahan yang ditagih,
 * dan server tetap menolak kalau angkanya di atas saran.
 */
export function FinishPanel({
  rentalId,
  waktuMulaiISO,
  tarifPerJam,
  persentasePemilik,
  metodeBayarAwal,
  toleransiTelatMenit,
}: {
  rentalId: number;
  waktuMulaiISO: string;
  tarifPerJam: number;
  persentasePemilik: number;
  metodeBayarAwal: string | null;
  toleransiTelatMenit: number;
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
    toleransiMenit: toleransiTelatMenit,
  });

  const saran = perkiraan.tambahanSaran;

  // Null berarti kasir belum menyentuh kolomnya, sehingga nilainya mengikuti
  // saran yang berjalan — saran berubah tiap kali sepeda melewati blok setengah
  // jam berikutnya. Begitu ia mengetik sesuatu, keputusannya tidak pernah
  // ditimpa lagi.
  //
  // Disimpan sebagai teks, bukan angka: kolom angka yang dikosongkan sementara
  // untuk diketik ulang akan menjadi NaN kalau dipaksa jadi number, dan itu
  // membuat isinya melompat-lompat saat diketik.
  const [tambahanDiubah, setTambahanDiubah] = useState<string | null>(null);
  const tambahanTeks = tambahanDiubah ?? String(saran);

  const tambahan = Number(tambahanTeks);
  const tambahanSah = Number.isInteger(tambahan) && tambahan >= 0 && tambahan <= saran;
  const memberiPotongan = tambahanSah && tambahan < saran;

  /**
   * Angka ini hanya dikirim kalau kasir benar-benar MENURUNKANNYA.
   *
   * Kalau ia menerima saran apa adanya, kolomnya sengaja tidak diberi nama
   * sehingga tidak ikut terkirim, dan server memakai sarannya sendiri. Itu jalur
   * yang paling sering terjadi, dan skema di lib/actions/rental.ts memang sudah
   * menyiapkannya.
   *
   * Alasannya bukan kerapian. Saran di layar ini dihitung dari jam KOMPUTER
   * KASIR, sedangkan server menghitung ulang dari jamnya sendiri lalu menolak
   * angka yang melebihi sarannya. Jam komputer konter yang lebih cepat beberapa
   * menit — hal yang biasa terjadi — bisa membuat saran klien melompat satu blok
   * di depan saran server, dan penolakan itu membuat kasir tidak bisa menutup
   * rental sama sekali. Dengan tidak mengirim apa-apa saat kasir tidak mengubah
   * apa pun, selisih jam itu berhenti menjadi persoalan.
   */
  const kirimTambahan = tambahanSah && tambahan !== saran;

  const total = perkiraan.durasiJamDitagih * tarifPerJam + (tambahanSah ? tambahan : 0);

  return (
    <div className="space-y-4">
      {/* Perkiraan total ditonjolkan: inilah angka yang disebutkan ke penyewa
          sebelum tombol selesai ditekan. */}
      <div className="rounded-card border border-line bg-surface-2">
        <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <p className="label-bagian">Perkiraan total</p>
            <p className="angka-utama mt-1 text-ink">{rupiah(total)}</p>
          </div>
          <p className="pb-1 text-right text-sm text-ink-muted">
            {berdetak ? formatDurasi(perkiraan.durasiMenit) : "Menghitung…"}
            <span className="block text-xs text-ink-faint">waktu sebenarnya</span>
          </p>
        </div>

        {/* Rincian dibuka apa adanya, tidak disembunyikan di balik ketukan.
            Kasir menyebutkan angka ini ke penyewa yang sedang berdiri di depannya,
            dan penyewa berhak tahu mana uang sewa dan mana uang keterlambatan. */}
        <DaftarData className="border-t border-line">
          <BarisData label={`Sewa ${perkiraan.durasiJamDitagih} jam × ${rupiah(tarifPerJam)}`}>
            {rupiah(perkiraan.durasiJamDitagih * tarifPerJam)}
          </BarisData>
          {perkiraan.sisaMenit > 0 && (
            <BarisData label={`Lewat ${perkiraan.sisaMenit} menit`}>
              {saran === 0 ? (
                <span className="text-ok">Masih wajar</span>
              ) : (
                rupiah(tambahanSah ? tambahan : 0)
              )}
            </BarisData>
          )}
          <BarisData label={`Bagian pemilik (${persentasePemilik}%)`}>
            {rupiah(Math.floor((total * persentasePemilik) / 100))}
          </BarisData>
          <BarisData label="Bagian rental">
            {rupiah(total - Math.floor((total * persentasePemilik) / 100))}
          </BarisData>
        </DaftarData>
      </div>

      <p className="text-xs text-ink-muted">
        Angka di atas masih berjalan. Total pastinya dihitung saat tombol ditekan.
      </p>

      <form action={aksi} className="space-y-4">
        <input type="hidden" name="rentalId" value={rentalId} />

        {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

        {/* Kolom denda hanya muncul kalau memang ada yang perlu diputuskan.
            Menampilkannya pada rental yang pulang tepat waktu cuma menambah satu
            kolom yang selalu berisi nol untuk dilewati puluhan kali sehari. */}
        {saran > 0 && (
          <div className="space-y-4 rounded-card border border-warn/30 bg-warn-soft/30 p-4">
            <div>
              <p className="text-sm font-medium text-ink">
                Sepeda telat {perkiraan.sisaMenit} menit
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Saran sistem {rupiah(saran)}. Boleh diturunkan, tapi alasannya wajib
                diisi. Tidak bisa dinaikkan.
              </p>
            </div>

            <Field
              id="tambahanDitagih"
              label="Tambahan keterlambatan"
              galat={status.galatField?.tambahanDitagih}
              wajib
            >
              {(props) => (
                <Input
                  {...props}
                  // Tanpa name, kolom ini tidak ikut terkirim — lihat kirimTambahan.
                  name={kirimTambahan ? "tambahanDitagih" : undefined}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={saran}
                  step={500}
                  value={tambahanTeks}
                  onChange={(e) => setTambahanDiubah(e.target.value)}
                  required
                />
              )}
            </Field>

            {/* Angkanya sah sebagai bilangan tapi di atas batas. Diperiksa
                terpisah dari tambahanSah, yang justru sudah mensyaratkan
                nilainya tidak melebihi saran — kalau digabung, peringatan ini
                tidak akan pernah muncul. */}
            {Number.isInteger(tambahan) && tambahan > saran && (
              <PesanGalat>Tidak boleh melebihi saran {rupiah(saran)}.</PesanGalat>
            )}

            {memberiPotongan && (
              <Field
                id="alasanPotongan"
                label={`Alasan keringanan ${rupiah(saran - tambahan)}`}
                galat={status.galatField?.alasanPotongan}
                wajib
              >
                {(props) => (
                  <Input
                    {...props}
                    name="alasanPotongan"
                    placeholder="Misalnya: ban bocor di jalan"
                    maxLength={200}
                    required
                  />
                )}
              </Field>
            )}
          </div>
        )}

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

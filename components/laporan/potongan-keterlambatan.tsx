import type { PotonganKasir, RincianPotongan } from "@/lib/queries/laporan";
import { Card, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { Bagian } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import { formatTanggalJamWib } from "@/lib/waktu";

/**
 * Keringanan denda keterlambatan yang diberikan petugas pada satu periode.
 *
 * Ini bagian yang membuat seluruh pencatatan denda ada gunanya. Sistem sudah
 * menyimpan berapa yang disarankan dan berapa yang ditagih pada tiap rental
 * telat, tapi selama tidak ada yang membacanya, catatan itu tidak mencegah
 * apa pun.
 *
 * Ditulis sebagai laporan, bukan peringatan. Memberi keringanan adalah bagian
 * wajar dari pekerjaan kasir — sepeda bisa telat karena ban bocor atau hujan.
 * Yang ingin ditemukan halaman ini bukan satu keringanan, melainkan pola: satu
 * orang yang membebaskan hampir semua denda sementara rekannya tidak.
 */
export function PotonganKeterlambatan({
  perKasir,
  rincian,
}: {
  perKasir: PotonganKasir[];
  rincian: RincianPotongan[];
}) {
  const totalPotongan = perKasir.reduce((j, k) => j + k.totalPotongan, 0);
  const totalSaran = perKasir.reduce((j, k) => j + k.totalSaran, 0);

  return (
    <Bagian judul="Keringanan denda keterlambatan">
      <Card>
        <CardHeader
          judul={
            totalPotongan === 0
              ? "Tidak ada keringanan"
              : `${rupiah(totalPotongan)} tidak ditagihkan`
          }
          keterangan={
            perKasir.length === 0
              ? "Belum ada sepeda yang telat kembali pada periode ini."
              : `Dari ${rupiah(totalSaran)} denda yang disarankan sistem.`
          }
        />

        {perKasir.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.jam}
            judul="Semua sepeda kembali tepat waktu"
            keterangan="Keringanan denda akan muncul di sini beserta alasan yang ditulis petugas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="label-bagian px-4 py-2.5">
                    Petugas
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Telat
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Diringankan
                  </th>
                  <th scope="col" className="label-bagian px-2 py-2.5 text-right">
                    Disarankan
                  </th>
                  <th scope="col" className="label-bagian px-4 py-2.5 text-right">
                    Tidak ditagih
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perKasir.map((k) => (
                  <tr key={k.kasirId}>
                    <td className="px-4 py-2.5 font-medium text-ink">{k.namaKasir}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-muted">
                      {k.jumlahTelat}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-muted">
                      {k.jumlahDiberiPotongan}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-muted">
                      {rupiah(k.totalSaran)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">
                      {rupiah(k.totalPotongan)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ringkasan di atas menunjukkan ada pola; daftar ini yang bisa
          ditanyakan langsung ke orangnya. */}
      {rincian.length > 0 && (
        <Card>
          <CardHeader
            judul="Alasan yang ditulis"
            keterangan={`${rincian.length} keringanan terakhir`}
          />
          <ul className="divide-y divide-line">
            {rincian.map((r) => (
              <li key={r.rentalId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium text-ink">
                    {r.kodeSepeda} · telat {r.sisaMenit} menit
                  </p>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-ink">
                    {rupiah(r.saran - r.ditagih)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {r.namaKasir}
                  {r.waktuSelesai && ` · ${formatTanggalJamWib(r.waktuSelesai)}`} ·{" "}
                  {rupiah(r.ditagih)} dari {rupiah(r.saran)}
                </p>
                {r.alasan && (
                  <p className="mt-1 text-sm italic text-ink-muted">“{r.alasan}”</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Bagian>
  );
}

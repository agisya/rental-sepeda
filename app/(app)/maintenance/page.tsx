import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import {
  LABEL_JENIS,
  daftarMaintenance,
  ringkasanMaintenance,
  servisJatuhTempo,
} from "@/lib/queries/maintenance";
import { selesaikanServis } from "@/lib/actions/maintenance";
import { daftarSepeda } from "@/lib/queries/bikes";
import { Card, CardHeader, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import { formatTanggalWib, rentangBulanWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Maintenance" };

export default async function HalamanMaintenance() {
  const pengguna = await wajibPengguna();
  const sekarang = new Date();

  const [riwayat, ringkasan, jatuhTempo, semuaSepeda] = await Promise.all([
    daftarMaintenance({ batas: 100 }),
    ringkasanMaintenance(rentangBulanWib(sekarang)),
    servisJatuhTempo(sekarang),
    daftarSepeda({ status: "servis" }),
  ]);

  const bolehKelola = pengguna.peran !== "kasir";

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Maintenance"
        keterangan="Riwayat servis, ganti sparepart, dan jadwal berikutnya"
        aksi={
          bolehKelola && (
            <ButtonLink href="/maintenance/baru" ukuran="sm" ikon={Ikon.tambah}>
              Catat
            </ButtonLink>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Biaya bulan ini"
          ikon={Ikon.servis}
          nilai={rupiah(ringkasan.totalBiaya)}
          keterangan={`${ringkasan.jumlah} catatan · ${ringkasan.sepedaDiservis} sepeda`}
        />
        <Stat
          label="Sedang diservis"
          ikon={Ikon.servis}
          nada="info"
          nilai={semuaSepeda.length}
        />
        <Stat
          label="Jadwal jatuh tempo"
          ikon={Ikon.peringatan}
          nada={jatuhTempo.length > 0 ? "warn" : "netral"}
          nilai={jatuhTempo.length}
        />
      </div>

      {jatuhTempo.length > 0 && (
        <Card className="border-warn/40">
          <CardHeader
            className="border-warn/25"
            judul={
              <span className="flex items-center gap-2 text-warn">
                <Ikon.peringatan className="size-4" strokeWidth={2.2} aria-hidden="true" />
                {jatuhTempo.length} sepeda sudah waktunya diservis
              </span>
            }
          />
          <ul className="divide-y divide-warn/20">
            {jatuhTempo.map((s) => (
              <li key={s.bikeId}>
                <Link
                  href={`/sepeda/${s.bikeId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {s.kodeSepeda} — {s.namaSepeda}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      Dijadwalkan {s.tanggalServisBerikutnya} · terakhir:{" "}
                      {s.deskripsiTerakhir}
                    </p>
                  </div>
                  <Ikon.lanjut
                    className="size-4 shrink-0 text-ink-faint"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {semuaSepeda.length > 0 && (
        <Card>
          <CardHeader
            judul={`Sedang diservis · ${semuaSepeda.length}`}
            keterangan="Sepeda ini tidak bisa disewakan sampai statusnya dikembalikan"
          />
          <ul className="divide-y divide-line">
            {semuaSepeda.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {s.kode} — {s.nama}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{s.namaPemilik}</p>
                </div>
                {bolehKelola && (
                  <form action={selesaikanServis}>
                    <input type="hidden" name="bikeId" value={s.id} />
                    <button
                      type="submit"
                      className="min-h-9 shrink-0 rounded-control border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                    >
                      Selesai servis
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader judul={`Riwayat · ${riwayat.length}`} keterangan="100 catatan terakhir" />
        {riwayat.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.servis}
            judul="Belum ada catatan maintenance"
            keterangan="Catat servis dan penggantian sparepart di sini supaya biayanya terlacak."
            aksi={
              bolehKelola ? (
                <ButtonLink href="/maintenance/baru" ikon={Ikon.tambah}>
                  Catat maintenance
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {riwayat.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{m.deskripsi}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      <Link
                        href={`/sepeda/${m.bikeId}`}
                        className="text-brand underline-offset-2 hover:underline"
                      >
                        {m.kodeSepeda}
                      </Link>{" "}
                      — {m.namaSepeda} · {LABEL_JENIS[m.jenis]}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-ink-faint">
                      {formatTanggalWib(m.tanggal)}
                      {m.mekanik && ` · ${m.mekanik}`}
                      {m.jamPakai !== null && ` · ${m.jamPakai} jam pakai`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {rupiah(m.biaya)}
                  </span>
                </div>

                {m.tanggalServisBerikutnya && (
                  <p className="mt-1.5 text-xs text-info">
                    Servis berikutnya: {m.tanggalServisBerikutnya}
                  </p>
                )}
                {m.catatan && (
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{m.catatan}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

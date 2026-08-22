import Link from "next/link";
import type { SepedaDenganPemilik, StatistikBulanan } from "@/lib/queries/bikes";
import { BarisData, DaftarData } from "@/components/ui/card";
import { StatusSepedaBadge } from "@/components/ui/status-badge";
import { FotoSepeda } from "@/components/sepeda/foto-sepeda";
import { BarisKontak } from "@/components/ui/tombol-kontak";
import { pesanWa } from "@/lib/kontak";
import { rupiah } from "@/lib/format";

/** Kartu identitas sepeda yang muncul tepat setelah QR dibaca. */
export function BikeCard({
  sepeda,
  statistik,
}: {
  sepeda: SepedaDenganPemilik;
  statistik: StatistikBulanan;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <FotoSepeda
          bikeId={sepeda.id}
          punyaFoto={Boolean(sepeda.fotoUrl) || sepeda.punyaFoto}
          fotoUrl={sepeda.fotoUrl}
          fotoVersi={sepeda.fotoVersi}
          nama={sepeda.nama}
          ukuran="md"
        />

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-wider text-ink-muted">{sepeda.kode}</p>
          <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
            {sepeda.nama}
          </h2>
          <p className="mt-0.5 truncate text-sm text-ink-muted">
            {sepeda.jenis}
            {sepeda.merk && ` · ${sepeda.merk}`}
          </p>
        </div>

        <StatusSepedaBadge status={sepeda.status} className="shrink-0" />
      </div>

      {/* Tarif ditonjolkan karena inilah angka yang disebutkan ke penyewa. */}
      <div className="flex items-baseline gap-1.5 border-b border-line bg-surface-2 px-4 py-3">
        <span className="text-xl font-semibold tracking-tight text-ink">
          {rupiah(sepeda.tarifPerJam)}
        </span>
        <span className="text-sm text-ink-muted">per jam</span>
      </div>

      <DaftarData>
        <BarisData label="Pemilik">
          <Link
            href={`/pemilik/${sepeda.ownerId}`}
            className="text-brand underline-offset-2 hover:underline"
          >
            {sepeda.namaPemilik}
          </Link>
          <span className="ml-1.5 font-normal text-ink-muted">
            ({sepeda.persentasePemilik}%)
          </span>
        </BarisData>
        <BarisKontak
          label="No. HP pemilik"
          noHp={sepeda.noHpPemilik}
          nama={sepeda.namaPemilik}
          pesan={pesanWa.sapaan(sepeda.namaPemilik)}
        />
        <BarisData label="Rental bulan ini">{statistik.jumlahRental} kali</BarisData>
        <BarisData label="Jam bulan ini">{statistik.totalJam} jam</BarisData>
        <BarisData label="Omzet bulan ini">{rupiah(statistik.totalOmzet)}</BarisData>
      </DaftarData>

      {sepeda.catatan && (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">
          {sepeda.catatan}
        </p>
      )}
    </div>
  );
}

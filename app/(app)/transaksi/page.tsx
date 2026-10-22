import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarTransaksi } from "@/lib/queries/rentals";
import type { StatusRental } from "@/lib/db/schema";
import { Card, KeadaanKosong } from "@/components/ui/card";
import { StatusRentalBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { FormTanggal } from "@/components/ui/form-tanggal";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import {
  dariKunciTanggalWib,
  formatJamWib,
  formatTanggalWib,
  kunciTanggalWib,
  rentangHariWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Transaksi" };

const FILTER = [
  { nilai: "", label: "Semua" },
  { nilai: "berjalan", label: "Berjalan" },
  { nilai: "selesai", label: "Selesai" },
  { nilai: "batal", label: "Batal" },
];

const STATUS_SAH: StatusRental[] = ["berjalan", "selesai", "batal"];

export default async function HalamanTransaksi(props: PageProps<"/transaksi">) {
  await wajibPengguna();
  const params = await props.searchParams;

  const statusMentah = typeof params.status === "string" ? params.status : "";
  const status = STATUS_SAH.includes(statusMentah as StatusRental)
    ? (statusMentah as StatusRental)
    : undefined;

  const tanggalParam = typeof params.tanggal === "string" ? params.tanggal : "";
  const tanggal = tanggalParam ? dariKunciTanggalWib(tanggalParam) : null;

  const transaksi = await daftarTransaksi({
    status,
    rentang: tanggal ? rentangHariWib(tanggal) : undefined,
    batas: 100,
  });

  const pilihanFilter = FILTER.map((f) => {
    const q = new URLSearchParams();
    if (f.nilai) q.set("status", f.nilai);
    if (tanggalParam) q.set("tanggal", tanggalParam);
    const query = q.toString();
    return { ...f, href: query ? `/transaksi?${query}` : "/transaksi" };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Transaksi"
        keterangan={
          tanggal
            ? `${transaksi.length} transaksi pada ${formatTanggalWib(tanggal)}`
            : `${transaksi.length} transaksi terbaru`
        }
      />

      <FormTanggal
        aksi="/transaksi"
        label="Tanggal"
        nilaiAwal={tanggalParam}
        maks={kunciTanggalWib(new Date())}
        hrefReset={
          tanggalParam ? (status ? `/transaksi?status=${status}` : "/transaksi") : undefined
        }
        tersembunyi={status && <input type="hidden" name="status" value={status} />}
      />

      <FilterChips
        label="Saring menurut status"
        pilihan={pilihanFilter}
        aktif={status ?? ""}
      />

      {transaksi.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.transaksi}
            judul="Belum ada transaksi"
            keterangan="Transaksi muncul di sini setelah ada sepeda yang disewakan."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {transaksi.map((r) => (
            <Link
              key={r.id}
              href={`/transaksi/${r.id}`}
              className="flex items-start justify-between gap-3 p-4 transition-colors first:rounded-t-card last:rounded-b-card hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{r.namaPenyewa}</p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {r.kodeSepeda} — {r.namaSepeda}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-ink-faint">
                  {formatTanggalWib(r.waktuMulai)} · {formatJamWib(r.waktuMulai)}
                  {r.waktuSelesai && ` – ${formatJamWib(r.waktuSelesai)}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-ink">
                  {r.totalBiaya === null ? "—" : rupiah(r.totalBiaya)}
                </p>
                <StatusRentalBadge status={r.status} className="mt-1.5" />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

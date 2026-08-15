import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarSepeda } from "@/lib/queries/bikes";
import type { StatusSepeda } from "@/lib/db/schema";
import { Card, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusSepedaBadge } from "@/components/ui/status-badge";
import { FotoSepeda } from "@/components/sepeda/foto-sepeda";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { SearchForm } from "@/components/ui/search-form";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Data Sepeda" };

const FILTER = [
  { nilai: "", label: "Semua" },
  { nilai: "tersedia", label: "Tersedia" },
  { nilai: "disewa", label: "Disewa" },
  { nilai: "servis", label: "Servis" },
  { nilai: "nonaktif", label: "Nonaktif" },
];

const STATUS_SAH: StatusSepeda[] = ["tersedia", "disewa", "booking", "servis", "nonaktif"];

export default async function HalamanSepeda(props: PageProps<"/sepeda">) {
  const pengguna = await wajibPengguna();
  const params = await props.searchParams;

  const statusMentah = typeof params.status === "string" ? params.status : "";
  const status = STATUS_SAH.includes(statusMentah as StatusSepeda)
    ? (statusMentah as StatusSepeda)
    : undefined;
  const cari = typeof params.cari === "string" ? params.cari : "";

  const sepeda = await daftarSepeda({ status, cari });
  const bolehKelola = pengguna.peran !== "kasir";

  const pilihanFilter = FILTER.map((f) => {
    const q = new URLSearchParams();
    if (f.nilai) q.set("status", f.nilai);
    if (cari) q.set("cari", cari);
    const query = q.toString();
    return { ...f, href: query ? `/sepeda?${query}` : "/sepeda" };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Data Sepeda"
        keterangan={`${sepeda.length} sepeda${status ? ` berstatus ${status}` : ""}`}
        aksi={
          bolehKelola && (
            <ButtonLink href="/sepeda/baru" ukuran="sm" ikon={Ikon.tambah}>
              Tambah
            </ButtonLink>
          )
        }
      />

      <SearchForm
        aksi="/sepeda"
        nilaiAwal={cari}
        label="Cari sepeda"
        placeholder="Cari kode, nama sepeda, atau pemilik"
        tersembunyi={status && <input type="hidden" name="status" value={status} />}
      />

      <FilterChips
        label="Saring menurut status"
        pilihan={pilihanFilter}
        aktif={status ?? ""}
      />

      {sepeda.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.sepeda}
            judul={cari || status ? "Tidak ada yang cocok" : "Belum ada sepeda"}
            keterangan={
              cari || status
                ? "Coba ubah kata kunci atau pilih saringan Semua."
                : "Tambahkan pemilik lebih dulu, lalu daftarkan sepedanya di sini."
            }
            aksi={
              bolehKelola && !cari && !status ? (
                <ButtonLink href="/sepeda/baru" ikon={Ikon.tambah}>
                  Tambah sepeda
                </ButtonLink>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {sepeda.map((s) => (
            <Link
              key={s.id}
              href={`/sepeda/${s.id}`}
              className="flex items-center gap-3 p-4 transition-colors first:rounded-t-card last:rounded-b-card hover:bg-surface-2"
            >
              <FotoSepeda
                bikeId={s.id}
                punyaFoto={s.punyaFoto}
                fotoUrl={s.fotoUrl}
                fotoVersi={s.fotoVersi}
                nama={s.nama}
              />

              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs tracking-wider text-ink-muted">{s.kode}</p>
                <p className="truncate font-medium text-ink">{s.nama}</p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {s.namaPemilik} · {rupiah(s.tarifPerJam)}/jam
                </p>
              </div>

              <StatusSepedaBadge status={s.status} className="shrink-0" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

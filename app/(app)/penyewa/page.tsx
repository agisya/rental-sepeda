import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarPenyewa } from "@/lib/queries/renters";
import { Card, KeadaanKosong } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SearchForm } from "@/components/ui/search-form";
import { Ikon } from "@/components/ui/icons";
import { TombolKontak } from "@/components/ui/tombol-kontak";
import { pesanWa } from "@/lib/kontak";
import { rupiah } from "@/lib/format";
import { formatTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Data Penyewa" };

export default async function HalamanPenyewa(props: PageProps<"/penyewa">) {
  await wajibPengguna();
  const params = await props.searchParams;
  const cari = typeof params.cari === "string" ? params.cari : "";

  const penyewa = await daftarPenyewa(cari);

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Data Penyewa"
        keterangan={`${penyewa.length} penyewa · terdata otomatis dari transaksi`}
      />

      <SearchForm
        aksi="/penyewa"
        nilaiAwal={cari}
        label="Cari penyewa"
        placeholder="Cari nama atau nomor HP"
      />

      {penyewa.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.penyewa}
            judul={cari ? "Tidak ada yang cocok" : "Belum ada penyewa"}
            keterangan={
              cari
                ? "Coba kata kunci lain, atau kosongkan pencarian."
                : "Penyewa terdata sendiri saat rental pertamanya dimulai. Tidak perlu diinput manual."
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {penyewa.map((p) => (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium text-ink">
                    {p.nama}
                    {p.sedangMenyewa > 0 && (
                      <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-normal text-danger">
                        sedang menyewa
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-ink-muted">{p.noHp}</p>
                  <TombolKontak
                    noHp={p.noHp}
                    nama={p.nama}
                    pesan={pesanWa.sapaan(p.nama)}
                    className="mt-2"
                  />
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-ink">
                    {rupiah(p.totalBelanja)}
                  </p>
                  <p className="text-xs text-ink-muted">{p.jumlahRental}× rental</p>
                </div>
              </div>

              {p.terakhirRental && (
                <p className="mt-2 text-xs text-ink-faint">
                  Terakhir {formatTanggalWib(new Date(p.terakhirRental))}
                </p>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { LABEL_KATEGORI, labaRugi, pengeluaranPerKategori } from "@/lib/queries/keuangan";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { BarisData, Card, CardHeader, CatatanKaki, DaftarData } from "@/components/ui/card";
import { StatUtama } from "@/components/ui/stat";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { Ikon } from "@/components/ui/icons";
import { rupiah } from "@/lib/format";
import {
  akhirHariWib,
  awalHariWib,
  formatRentangTanggalWib,
  rentangBulanWib,
  rentangHariWib,
  rentangMingguWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Laba / Rugi" };

const PERIODE = [
  { nilai: "hari", label: "Hari ini" },
  { nilai: "minggu", label: "Minggu ini" },
  { nilai: "bulan", label: "Bulan ini" },
  { nilai: "tahun", label: "Tahun ini" },
];

function rentangTahunWib(waktu: Date) {
  const wib = new Date(waktu.getTime() + 7 * 60 * 60 * 1000);
  const tahun = wib.getUTCFullYear();
  const offset = 7 * 60 * 60 * 1000;
  return {
    mulai: new Date(Date.UTC(tahun, 0, 1) - offset),
    selesai: new Date(Date.UTC(tahun + 1, 0, 1) - offset),
  };
}

export default async function HalamanLabaRugi(props: PageProps<"/laba-rugi">) {
  const pengguna = await wajibPengguna();
  if (pengguna.peran === "kasir") redirect("/dashboard");

  const params = await props.searchParams;
  const pilihan = typeof params.periode === "string" ? params.periode : "bulan";
  const sekarang = new Date();

  const rentang =
    pilihan === "hari"
      ? rentangHariWib(sekarang)
      : pilihan === "minggu"
        ? rentangMingguWib(sekarang)
        : pilihan === "tahun"
          ? rentangTahunWib(sekarang)
          : rentangBulanWib(sekarang);

  const [hasil, perKategori, { namaUsaha }] = await Promise.all([
    labaRugi(rentang),
    pengeluaranPerKategori(rentang),
    ambilPengaturan(),
  ]);

  const untung = hasil.labaBersih >= 0;

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Laba / Rugi"
        keterangan={formatRentangTanggalWib(
          rentang.mulai,
          pilihan === "hari" ? akhirHariWib(awalHariWib(sekarang)) : rentang.selesai,
        )}
      />

      <FilterChips
        label="Pilih periode"
        pilihan={PERIODE.map((p) => ({ ...p, href: `/laba-rugi?periode=${p.nilai}` }))}
        aktif={pilihan}
      />

      {/* Angka utama sengaja laba bersih, bukan omzet: inilah uang yang benar-benar
          menjadi milik rental setelah bagian pemilik disisihkan dan biaya dibayar. */}
      <StatUtama
        label={untung ? "Laba bersih" : "Rugi"}
        nada={untung ? "ok" : "danger"}
        nilai={rupiah(hasil.labaBersih)}
        keterangan={`Pendapatan rental ${rupiah(hasil.pendapatanRental)} − pengeluaran ${rupiah(hasil.pengeluaran)}`}
      />

      <Card>
        <CardHeader
          judul="Rincian perhitungan"
          keterangan={`${hasil.jumlahTransaksi} transaksi selesai pada periode ini`}
        />
        <DaftarData>
          <BarisData label="Omzet kotor">{rupiah(hasil.omzetKotor)}</BarisData>
          <BarisData label="Dikurangi bagian pemilik sepeda">
            <span className="text-danger">− {rupiah(hasil.bagianPemilik)}</span>
          </BarisData>
          <BarisData label={`Pendapatan ${namaUsaha}`} tebal>
            {rupiah(hasil.pendapatanRental)}
          </BarisData>
          <BarisData label="Dikurangi pengeluaran">
            <span className="text-danger">− {rupiah(hasil.pengeluaran)}</span>
          </BarisData>
          <BarisData label="Laba bersih" tebal>
            <span className={untung ? "text-ok" : "text-danger"}>
              {rupiah(hasil.labaBersih)}
            </span>
          </BarisData>
        </DaftarData>

        <CatatanKaki>
          Laba dihitung dari pendapatan rental, bukan dari omzet kotor. Omzet kotor masih
          memuat bagian pemilik sepeda — uang yang wajib disetorkan dan bukan milik rental.
          Mengurangkan pengeluaran langsung dari omzet kotor akan membuat laba terbaca
          jauh lebih besar daripada yang sebenarnya.
        </CatatanKaki>
      </Card>

      {perKategori.length > 0 && (
        <Card>
          <CardHeader judul="Pengeluaran per kategori" />
          <ul className="divide-y divide-line">
            {perKategori.map((k) => (
              <li
                key={k.kategori}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="text-sm text-ink">{LABEL_KATEGORI[k.kategori]}</span>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {rupiah(k.jumlah)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-3">
            <Link
              href="/pengeluaran"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              Kelola pengeluaran
              <Ikon.lanjut className="size-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

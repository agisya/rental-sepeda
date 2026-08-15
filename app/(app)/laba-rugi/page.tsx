import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import { LABEL_KATEGORI, labaRugi, pengeluaranPerKategori } from "@/lib/queries/keuangan";
import { BarisData, Card, CardHeader, DaftarData } from "@/components/ui/card";
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

  const [hasil, perKategori] = await Promise.all([
    labaRugi(rentang),
    pengeluaranPerKategori(rentang),
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
      <div
        className={`rounded-card border p-5 ${
          untung ? "border-ok/30 bg-ok-soft/40" : "border-danger/30 bg-danger-soft/40"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label-bagian">{untung ? "Laba bersih" : "Rugi"}</p>
          <span
            className={`flex size-8 items-center justify-center rounded-full ${
              untung ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"
            }`}
            aria-hidden="true"
          >
            {untung ? (
              <Ikon.laporanNaik className="size-[18px]" strokeWidth={1.9} />
            ) : (
              <Ikon.pengeluaran className="size-[18px]" strokeWidth={1.9} />
            )}
          </span>
        </div>
        <p className={`angka-utama mt-2 ${untung ? "text-ok" : "text-danger"}`}>
          {rupiah(hasil.labaBersih)}
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Pendapatan rental {rupiah(hasil.pendapatanRental)} − pengeluaran{" "}
          {rupiah(hasil.pengeluaran)}
        </p>
      </div>

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
          <BarisData label="Pendapatan Rental Sepeda Garut" tebal>
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

        <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-muted">
          Laba dihitung dari pendapatan rental, bukan dari omzet kotor. Omzet kotor masih
          memuat bagian pemilik sepeda — uang yang wajib disetorkan dan bukan milik rental.
          Mengurangkan pengeluaran langsung dari omzet kotor akan membuat laba terbaca
          jauh lebih besar daripada yang sebenarnya.
        </p>
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
              className="text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              Kelola pengeluaran →
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

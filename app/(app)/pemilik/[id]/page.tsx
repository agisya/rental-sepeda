import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibPengguna } from "@/lib/auth/dal";
import {
  bagiHasilPemilikBulanIni,
  pemilikById,
  sepedaMilikPemilik,
} from "@/lib/queries/owners";
import {
  BarisData,
  Card,
  CardBody,
  CardHeader,
  DaftarData,
  KeadaanKosong,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusSepedaBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { TombolKontak } from "@/components/ui/tombol-kontak";
import { pesanWa } from "@/lib/kontak";
import { rupiah } from "@/lib/format";
import { formatTanggalWib } from "@/lib/waktu";

export const metadata: Metadata = { title: "Detail Pemilik" };

export default async function HalamanDetailPemilik(props: PageProps<"/pemilik/[id]">) {
  const pengguna = await wajibPengguna();
  const { id } = await props.params;
  const ownerId = Number(id);
  if (!Number.isInteger(ownerId) || ownerId <= 0) notFound();

  const pemilik = await pemilikById(ownerId);
  if (!pemilik) notFound();

  const [sepeda, bagiHasil] = await Promise.all([
    sepedaMilikPemilik(ownerId),
    bagiHasilPemilikBulanIni(ownerId),
  ]);

  const bolehKelola = pengguna.peran !== "kasir";

  return (
    <div className="space-y-4">
      <PageHeader
        judul={pemilik.nama}
        keterangan={
          <>
            <span className="tabular-nums">{pemilik.noHp}</span>
            {pemilik.alamat && ` · ${pemilik.alamat}`}
            <TombolKontak
              noHp={pemilik.noHp}
              nama={pemilik.nama}
              pesan={pesanWa.sapaan(pemilik.nama)}
              className="mt-2"
            />
          </>
        }
        aksi={
          bolehKelola && (
            <ButtonLink href={`/pemilik/${ownerId}/ubah`} variasi="kedua" ukuran="sm">
              Ubah
            </ButtonLink>
          )
        }
      />

      <Card>
        <CardHeader
          judul="Bagi hasil bulan ini"
          keterangan={`Sampai ${formatTanggalWib(new Date())} · bagian pemilik ${pemilik.persentaseBagiHasil}%`}
        />

        <div className="border-b border-line px-4 py-4">
          <p className="label-bagian">Bagian pemilik</p>
          <p className="angka-utama mt-1 text-ink">{rupiah(bagiHasil.bagianPemilik)}</p>
        </div>

        <DaftarData>
          <BarisData label="Jumlah rental">{bagiHasil.jumlahRental} kali</BarisData>
          <BarisData label="Total jam">{bagiHasil.totalJam} jam</BarisData>
          <BarisData label="Omzet kotor">{rupiah(bagiHasil.omzetKotor)}</BarisData>
          <BarisData label="Bagian rental">{rupiah(bagiHasil.bagianRental)}</BarisData>
        </DaftarData>

        <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
          Pencatatan pembayaran ke pemilik akan tersedia pada tahap berikutnya, di menu
          Laporan Pemilik.
        </p>
      </Card>

      <Card>
        <CardHeader judul={`Sepeda · ${sepeda.length}`} />
        {sepeda.length === 0 ? (
          <KeadaanKosong
            ikon={Ikon.sepeda}
            judul="Belum ada sepeda"
            keterangan="Pemilik ini belum punya sepeda yang terdaftar."
            aksi={
              bolehKelola ? (
                <ButtonLink href="/sepeda/baru" ukuran="sm" ikon={Ikon.tambah}>
                  Tambah sepeda
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {sepeda.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sepeda/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs tracking-wider text-ink-muted">
                      {s.kode}
                    </p>
                    <p className="truncate text-sm font-medium text-ink">{s.nama}</p>
                    <p className="text-xs text-ink-muted">{rupiah(s.tarifPerJam)}/jam</p>
                  </div>
                  <StatusSepedaBadge status={s.status} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pemilik.catatan && (
        <Card>
          <CardHeader judul="Catatan" />
          <CardBody className="text-sm leading-relaxed text-ink-muted">
            {pemilik.catatan}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

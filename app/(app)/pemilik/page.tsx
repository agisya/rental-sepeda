import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarPemilik } from "@/lib/queries/owners";
import { Card, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Ikon } from "@/components/ui/icons";
import { TombolKontak } from "@/components/ui/tombol-kontak";
import { pesanWa } from "@/lib/kontak";

export const metadata: Metadata = { title: "Data Pemilik" };

export default async function HalamanPemilik() {
  const pengguna = await wajibPengguna();
  const pemilik = await daftarPemilik();
  const bolehKelola = pengguna.peran !== "kasir";

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Data Pemilik"
        keterangan={`${pemilik.length} pemilik terdaftar`}
        aksi={
          bolehKelola && (
            <ButtonLink href="/pemilik/baru" ukuran="sm" ikon={Ikon.tambah}>
              Tambah
            </ButtonLink>
          )
        }
      />

      {pemilik.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.pemilik}
            judul="Belum ada pemilik"
            keterangan="Setiap sepeda harus punya pemilik. Tambahkan pemiliknya lebih dulu."
            aksi={
              bolehKelola ? (
                <ButtonLink href="/pemilik/baru" ikon={Ikon.tambah}>
                  Tambah pemilik
                </ButtonLink>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {pemilik.map((p) => (
            // Tombol kontak berada di luar Link pembungkus baris, karena tautan
            // di dalam tautan bukan HTML yang sah — dan pada peramban tertentu
            // ketukan pada tombolnya justru ikut membuka halaman pemiliknya.
            //
            // Pembulatan sudut pindah ke pembungkus ini. Sejak <Link> tidak lagi
            // menjadi anak langsung <Card>, ia selalu sekaligus anak pertama dan
            // terakhir dari pembungkusnya, sehingga first:/last: di sana akan
            // melengkungkan SETIAP baris, bukan hanya ujung atas dan bawah kartu.
            <div
              key={p.id}
              className="flex items-center gap-2 pr-4 first:rounded-t-card last:rounded-b-card"
            >
              <Link
                href={`/pemilik/${p.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 p-4 transition-colors hover:bg-surface-2"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted"
                  aria-hidden="true"
                >
                  <Ikon.pemilik className="size-5" strokeWidth={1.8} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-ink">
                    {p.nama}
                    {!p.aktif && (
                      <span className="shrink-0 rounded-full bg-idle-soft px-2 py-0.5 text-xs font-normal text-idle">
                        nonaktif
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {p.noHp} · {p.jumlahSepeda} sepeda
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-soft-ink">
                  {p.persentaseBagiHasil}%
                </span>
              </Link>

              <TombolKontak
                noHp={p.noHp}
                nama={p.nama}
                pesan={pesanWa.sapaan(p.nama)}
                ringkas
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

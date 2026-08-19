import type { Metadata } from "next";
import type { ReactNode } from "react";
import { wajibPengguna } from "@/lib/auth/dal";
import {
  daftarSetoran,
  rekapKasHarian,
  rincianKasHarian,
  setoranHari,
} from "@/lib/kas/kelola";
import { daftarRentalBerjalan } from "@/lib/queries/rentals";
import {
  BarisData,
  Card,
  CardBody,
  CardHeader,
  DaftarData,
  KeadaanKosong,
} from "@/components/ui/card";
import { Bagian, PageHeader } from "@/components/ui/page-header";
import { StatUtama } from "@/components/ui/stat";
import { Ikon } from "@/components/ui/icons";
import {
  FormHapusPengeluaran,
  FormPengeluaranLaci,
  FormTerimaSetoran,
  FormTutupKas,
} from "@/components/kas/form-kas";
import { rupiah } from "@/lib/format";
import {
  formatJamWib,
  formatTanggalJamWib,
  formatTanggalWib,
  kunciTanggalWib,
  rentangBulanWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Tutup Kas" };

/** Satu baris rincian: waktu, keterangan, nominal. */
function BarisRincian({
  waktu,
  utama,
  tambahan,
  nominal,
  aksi,
}: {
  waktu: Date;
  utama: string;
  tambahan?: string;
  nominal: ReactNode;
  aksi?: ReactNode;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">
          <span className="tabular-nums text-ink-muted">{formatJamWib(waktu)}</span>{" "}
          {utama}
        </p>
        {tambahan && <p className="truncate text-xs text-ink-muted">{tambahan}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-sm font-medium tabular-nums text-ink">{nominal}</p>
        {aksi}
      </div>
    </li>
  );
}

/**
 * Rincian yang terlipat.
 *
 * Angka besarnya yang dipakai tiap hari; rinciannya hanya dibuka ketika uang
 * di laci tidak cocok. Menampilkan keduanya sekaligus membuat halaman ini
 * penuh angka setiap sore, dan yang penuh angka justru berhenti dibaca.
 */
function Lipatan({
  judul,
  jumlah,
  children,
}: {
  judul: string;
  jumlah: number;
  children: ReactNode;
}) {
  if (jumlah === 0) return null;

  return (
    <details className="border-t border-line first:border-t-0">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 text-sm font-medium text-ink marker:content-['']">
        <span>{judul}</span>
        <span className="text-xs text-ink-muted">{jumlah} baris · ketuk untuk buka</span>
      </summary>
      <ul className="divide-y divide-line border-t border-line bg-surface-2/40">
        {children}
      </ul>
    </details>
  );
}

/**
 * Penutupan kas harian.
 *
 * Dibuat dua langkah: kasir menyatakan berapa yang ia serahkan, admin atau
 * owner menyatakan sudah menerimanya. Rinciannya ada di halaman yang sama
 * supaya selisih bisa ditelusuri saat itu juga — selisih yang ditunda
 * pemeriksaannya sampai besok tidak akan pernah benar-benar diperiksa.
 */
export default async function HalamanKas() {
  const pengguna = await wajibPengguna();
  const sekarang = new Date();

  const bolehMenerima = pengguna.peran === "admin" || pengguna.peran === "owner";
  const bulan = rentangBulanWib(sekarang);

  const [rekap, rincian, punyaHariIni, masihDiLuar, semua] = await Promise.all([
    rekapKasHarian(pengguna.id, sekarang),
    rincianKasHarian(pengguna.id, sekarang),
    setoranHari(pengguna.id, sekarang),
    daftarRentalBerjalan(),
    bolehMenerima ? daftarSetoran(bulan) : Promise.resolve([]),
  ]);

  const nonTunai = rincian.rentalNonTunai.reduce((total, r) => total + r.jumlah, 0);
  const jumlahBaris =
    rincian.rentalTunai.length +
    rincian.pengeluaranTunai.length +
    rincian.setoranPemilikTunai.length;

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Tutup Kas"
        keterangan={`Uang tunai Anda · ${formatTanggalWib(sekarang)}`}
      />

      {/* Sepeda yang masih di luar dulu, sebelum urusan uang. Menutup kas
          sementara sepeda belum kembali berarti hari itu belum benar-benar
          selesai, dan uang sewanya belum masuk hitungan mana pun. */}
      {masihDiLuar.length > 0 && (
        <Card className="border-warn/40 bg-warn-soft/40">
          <CardHeader
            className="border-warn/25"
            judul={
              <span className="flex items-center gap-2 text-warn">
                <Ikon.peringatan className="size-4" strokeWidth={2.2} aria-hidden="true" />
                {masihDiLuar.length} sepeda belum kembali
              </span>
            }
            keterangan="Uang sewanya belum masuk hitungan karena rentalnya belum diselesaikan"
          />
          <ul className="divide-y divide-warn/20">
            {masihDiLuar.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <p className="truncate text-sm font-medium text-ink">
                  {r.kodeSepeda} — {r.namaSepeda}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {r.namaPenyewa} · sejak {formatJamWib(r.waktuMulai)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <StatUtama
        label="Seharusnya ada di tangan Anda"
        nilai={rupiah(rekap.jumlahSeharusnya)}
        keterangan="Tunai dari rental, dikurangi yang sudah terpakai dari laci"
      />

      <Card>
        <CardHeader
          judul="Rinciannya"
          keterangan={
            jumlahBaris === 0
              ? "Belum ada transaksi tunai hari ini"
              : "Ketuk salah satu baris untuk melihat transaksinya"
          }
        />

        <DaftarData>
          <BarisData label="Rental dibayar tunai">
            {rupiah(rekap.penerimaanTunai)}
          </BarisData>
          <BarisData label="Pengeluaran dari laci">
            −{rupiah(rekap.pengeluaranTunai)}
          </BarisData>
          <BarisData label="Setoran tunai ke pemilik">
            −{rupiah(rekap.setoranPemilikTunai)}
          </BarisData>
          <BarisData label="Seharusnya" tebal>
            {rupiah(rekap.jumlahSeharusnya)}
          </BarisData>
        </DaftarData>

        {jumlahBaris > 0 && (
          <div className="border-t border-line">
            <Lipatan judul="Rental dibayar tunai" jumlah={rincian.rentalTunai.length}>
              {rincian.rentalTunai.map((r) => (
                <BarisRincian
                  key={r.id}
                  waktu={r.waktu}
                  utama={r.kodeSepeda}
                  tambahan={r.namaPenyewa}
                  nominal={rupiah(r.jumlah)}
                />
              ))}
            </Lipatan>

            <Lipatan
              judul="Pengeluaran dari laci"
              jumlah={rincian.pengeluaranTunai.length}
            >
              {rincian.pengeluaranTunai.map((p) => (
                <BarisRincian
                  key={p.id}
                  waktu={p.waktu}
                  utama={p.keterangan}
                  nominal={`−${rupiah(p.jumlah)}`}
                  // Tombol hapus hanya selama kas belum ditutup. Sesudah itu
                  // angkanya sudah dibekukan dan disepakati dua pihak.
                  aksi={!punyaHariIni && <FormHapusPengeluaran id={p.id} />}
                />
              ))}
            </Lipatan>

            <Lipatan
              judul="Setoran tunai ke pemilik"
              jumlah={rincian.setoranPemilikTunai.length}
            >
              {rincian.setoranPemilikTunai.map((s) => (
                <BarisRincian
                  key={s.id}
                  waktu={s.waktu}
                  utama={s.namaPemilik}
                  nominal={`−${rupiah(s.jumlah)}`}
                />
              ))}
            </Lipatan>
          </div>
        )}
      </Card>

      {/* Uang non-tunai tidak menuntut apa pun dari kasir, tapi tetap
          ditampilkan supaya penutupan menggambarkan seluruh hari — bukan hanya
          isi laci. Tanpa ini, hari dengan banyak QRIS terlihat sepi. */}
      {rincian.rentalNonTunai.length > 0 && (
        <Card>
          <CardHeader
            judul="Masuk tanpa uang tunai"
            keterangan="Tidak perlu Anda serahkan — hanya supaya hari ini terlihat utuh"
          />
          <DaftarData>
            <BarisData label={`QRIS & transfer · ${rincian.rentalNonTunai.length} transaksi`} tebal>
              {rupiah(nonTunai)}
            </BarisData>
          </DaftarData>
          <div className="border-t border-line">
            <Lipatan judul="Lihat transaksinya" jumlah={rincian.rentalNonTunai.length}>
              {rincian.rentalNonTunai.map((r) => (
                <BarisRincian
                  key={r.id}
                  waktu={r.waktu}
                  utama={r.kodeSepeda}
                  tambahan={`${r.namaPenyewa} · ${r.metode ?? "—"}`}
                  nominal={rupiah(r.jumlah)}
                />
              ))}
            </Lipatan>
          </div>
        </Card>
      )}

      {/* Dicatat di sini, bukan di menu Pengeluaran — menu itu memuat gaji dan
          seluruh pengeluaran usaha, dan tetap tertutup bagi kasir. Yang dibuka
          hanya uang dari lacinya sendiri. Tanpa jalan ini, ban yang dibeli
          kasir selalu muncul sebagai selisih yang tidak bisa dijelaskan. */}
      {!punyaHariIni && (
        <Card>
          <CardHeader
            judul="Ambil uang dari laci"
            keterangan="Catat begitu uangnya keluar, selagi masih ingat — langsung dikurangkan dari setoran Anda"
          />
          <CardBody>
            <FormPengeluaranLaci tanggal={kunciTanggalWib(sekarang)} />
          </CardBody>
        </Card>
      )}

      {punyaHariIni ? (
        <Card>
          <CardHeader
            judul="Kas hari ini sudah ditutup"
            keterangan={
              punyaHariIni.status === "diterima"
                ? `Diterima ${punyaHariIni.namaPenerima ?? "—"}`
                : "Menunggu admin menandai diterima"
            }
          />
          <DaftarData>
            <BarisData label="Diserahkan">{rupiah(punyaHariIni.jumlahDiserahkan)}</BarisData>
            <BarisData label="Selisih">{rupiah(punyaHariIni.selisih)}</BarisData>
            {punyaHariIni.catatan && (
              <BarisData label="Catatan">{punyaHariIni.catatan}</BarisData>
            )}
          </DaftarData>
        </Card>
      ) : (
        <Card>
          <CardHeader
            judul="Tutup kas"
            keterangan="Hitung uang fisiknya dulu, jangan menyalin angka di atas"
          />
          <CardBody>
            <FormTutupKas
              tanggal={kunciTanggalWib(sekarang)}
              jumlahSeharusnya={rekap.jumlahSeharusnya}
            />
          </CardBody>
        </Card>
      )}

      {bolehMenerima && (
        <Bagian judul="Setoran tim bulan ini">
          <Card>
            {semua.length === 0 ? (
              <KeadaanKosong
                ikon={Ikon.uang}
                judul="Belum ada penutupan kas bulan ini"
                keterangan="Setoran akan muncul di sini begitu kasir menutup kasnya."
              />
            ) : (
              <ul className="divide-y divide-line">
                {semua.map((s) => (
                  <li key={s.id} className="space-y-2 px-4 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {s.namaKasir} · {formatTanggalWib(s.tanggal)}
                        </p>
                        <p className="text-xs text-ink-muted">
                          Seharusnya {rupiah(s.jumlahSeharusnya)} · diserahkan{" "}
                          {rupiah(s.jumlahDiserahkan)}
                          {s.selisih !== 0 && (
                            <span className="font-medium text-danger">
                              {" "}
                              · selisih {rupiah(s.selisih)}
                            </span>
                          )}
                        </p>
                        {s.catatan && (
                          <p className="mt-1 text-xs text-ink-muted">{s.catatan}</p>
                        )}
                      </div>

                      {s.status === "diterima" ? (
                        <p className="shrink-0 text-xs text-ink-muted">
                          Diterima {s.namaPenerima ?? "—"}
                          {s.diterimaPada && ` · ${formatTanggalJamWib(s.diterimaPada)}`}
                        </p>
                      ) : (
                        <FormTerimaSetoran id={s.id} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Bagian>
      )}
    </div>
  );
}

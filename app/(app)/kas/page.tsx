import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarSetoran, rekapKasHarian, setoranHari } from "@/lib/kas/kelola";
import { Card, CardBody, CardHeader, DaftarData, BarisData, KeadaanKosong } from "@/components/ui/card";
import { PageHeader, Bagian } from "@/components/ui/page-header";
import { StatUtama } from "@/components/ui/stat";
import { Ikon } from "@/components/ui/icons";
import { FormTerimaSetoran, FormTutupKas } from "@/components/kas/form-kas";
import { rupiah } from "@/lib/format";
import {
  formatTanggalJamWib,
  formatTanggalWib,
  kunciTanggalWib,
  rentangBulanWib,
} from "@/lib/waktu";

export const metadata: Metadata = { title: "Tutup Kas" };

/**
 * Penutupan kas harian.
 *
 * Aplikasi sudah lama tahu berapa uang yang seharusnya masuk. Yang belum pernah
 * tercatat adalah berapa yang benar-benar berpindah tangan, dan kepada siapa.
 * Halaman ini menutup jarak itu, dan sengaja dua langkah: kasir menyatakan
 * berapa yang ia serahkan, admin atau owner menyatakan sudah menerimanya.
 */
export default async function HalamanKas() {
  const pengguna = await wajibPengguna();
  const sekarang = new Date();

  const bolehMenerima = pengguna.peran === "admin" || pengguna.peran === "owner";
  const bulan = rentangBulanWib(sekarang);

  const [rekap, punyaHariIni, semua] = await Promise.all([
    rekapKasHarian(pengguna.id, sekarang),
    setoranHari(pengguna.id, sekarang),
    bolehMenerima ? daftarSetoran(bulan) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Tutup Kas"
        keterangan={`Uang tunai Anda · ${formatTanggalWib(sekarang)}`}
      />

      <StatUtama
        label="Seharusnya ada di tangan Anda"
        nilai={rupiah(rekap.jumlahSeharusnya)}
        keterangan="Tunai dari rental, dikurangi yang sudah terpakai dari laci"
      />

      <Card>
        <CardHeader judul="Rinciannya" keterangan="Hanya yang berbentuk uang tunai" />
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
      </Card>

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

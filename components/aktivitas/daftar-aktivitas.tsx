import Link from "next/link";
import {
  LABEL_AKTIVITAS,
  URUTAN_STATUS,
  type Aktivitas,
  type StatusAktivitas,
} from "@/lib/queries/aktivitas";
import { Card, KeadaanKosong } from "@/components/ui/card";
import { Bagian } from "@/components/ui/page-header";
import { StatusAktivitasBadge } from "@/components/ui/status-badge";
import { Ikon } from "@/components/ui/icons";
import { TombolKontak } from "@/components/ui/tombol-kontak";
import { kodeBooking } from "@/lib/booking/kode";
import { pesanWa } from "@/lib/kontak";
import { rupiah } from "@/lib/format";
import { formatJamWib, formatTanggalWib, kunciTanggalWib } from "@/lib/waktu";

/**
 * Daftar tunggal untuk booking dan rental langsung.
 *
 * Dipakai apa adanya di halaman Scan QR maupun halaman Booking, dengan data yang
 * persis sama — itulah inti perubahannya. Petugas tidak perlu lagi tahu sebuah
 * sepeda "jenisnya apa" sebelum tahu harus melihat di halaman mana; keduanya
 * menampilkan seluruhnya, dan yang membedakan tiap baris cuma lencana tahapnya.
 *
 * Asal-usulnya tetap terbaca sebagai penanda kecil "dari booking" atau
 * "langsung", supaya keterangan itu tidak hilang meski bukan lagi pemisah.
 */
export function DaftarAktivitas({
  aktivitas,
  sekarang,
  judulKosong = "Belum ada aktivitas",
  keteranganKosong = "Booking dan rental yang berjalan akan muncul di sini.",
}: {
  aktivitas: Aktivitas[];
  /** Dipakai untuk menentukan baris mana yang perlu menyebutkan tanggalnya. */
  sekarang: Date;
  judulKosong?: string;
  keteranganKosong?: string;
}) {
  if (aktivitas.length === 0) {
    return (
      <Card>
        <KeadaanKosong
          ikon={Ikon.sepeda}
          judul={judulKosong}
          keterangan={keteranganKosong}
        />
      </Card>
    );
  }

  // Dikelompokkan per tahap, bukan dicampur jadi satu daftar panjang. Tiga baris
  // "sedang disewa" yang terselip di antara belasan "selesai" akan hilang dari
  // pandangan, padahal justru itu yang perlu diurus sekarang.
  const kelompok = URUTAN_STATUS.map((status) => ({
    status,
    isi: aktivitas.filter((a) => a.status === status),
  })).filter((k) => k.isi.length > 0);

  return (
    <div className="space-y-5">
      {kelompok.map((k) => (
        <Bagian key={k.status} judul={`${LABEL_AKTIVITAS[k.status]} · ${k.isi.length}`}>
          <Card>
            <ul className="divide-y divide-line">
              {k.isi.map((a) => (
                <BarisAktivitas key={a.kunci} aktivitas={a} sekarang={sekarang} />
              ))}
            </ul>
          </Card>
        </Bagian>
      ))}
    </div>
  );
}

/**
 * Tujuan tiap baris mengikuti tahapnya, bukan tabel asalnya.
 *
 * Yang sedang disewa menuju halaman scan TANPA penanda pindai: mengetuk baris
 * boleh membuka keterangannya, tapi menutup rental tetap menuntut kodenya
 * dipindai — supaya menerima uang selalu jadi tindakan yang disengaja.
 */
function tujuan(a: Aktivitas): string {
  if (a.rentalId && a.status === "disewa") {
    return `/scan?kode=${encodeURIComponent(a.kodeSepeda)}`;
  }
  if (a.rentalId) return `/transaksi/${a.rentalId}`;
  return `/booking/${a.bookingId}`;
}

/**
 * Jam saja untuk yang terjadi hari ini, jam beserta tanggalnya untuk yang tidak.
 *
 * Daftar ini memuat booking dari tanggal mana pun dan rental yang berangkat
 * kemarin, jadi baris bertuliskan "13:00 · 2 jam" tanpa tanggal tidak bisa
 * dibedakan antara nanti sore dan minggu depan. Tanggalnya hanya muncul kalau
 * memang berbeda dari hari ini, supaya baris yang mayoritas — yang hari ini —
 * tetap ringkas.
 */
function jamAtauTanggal(waktu: Date, sekarang: Date): string {
  const jam = formatJamWib(waktu);
  if (kunciTanggalWib(waktu) === kunciTanggalWib(sekarang)) return jam;
  return `${formatTanggalWib(waktu)} ${jam}`;
}

function keterangan(a: Aktivitas, sekarang: Date): string {
  if (a.status === "dibooking" || a.status === "hangus") {
    return `${jamAtauTanggal(a.waktuMulai, sekarang)} · ${a.durasiJam} jam`;
  }
  if (a.status === "disewa") return `sejak ${jamAtauTanggal(a.waktuMulai, sekarang)}`;
  if (a.waktuSelesai) return `selesai ${jamAtauTanggal(a.waktuSelesai, sekarang)}`;
  return jamAtauTanggal(a.waktuMulai, sekarang);
}

function BarisAktivitas({
  aktivitas: a,
  sekarang,
}: {
  aktivitas: Aktivitas;
  sekarang: Date;
}) {
  const perluDitelepon = a.status === "hangus";

  return (
    <li className="flex items-stretch">
      <Link
        href={tujuan(a)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {a.kodeSepeda} — {a.namaSepeda}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {a.namaPenyewa}
            {a.bookingId && ` · ${kodeBooking(a.bookingId)}`}
            {a.rentalId && (a.dariBooking ? " · dari booking" : " · langsung")}
          </p>
          <p className="mt-0.5 truncate text-xs tabular-nums text-ink-faint">
            {keterangan(a, sekarang)}
          </p>
        </div>

        {/* Uang di kanan, waktu di kiri — mengikuti kebiasaan yang sudah dipakai
            daftar-daftar lain di aplikasi ini. Perkiraan diberi tanda kurang-lebih
            supaya tidak terbaca sebagai jumlah yang sudah pasti. */}
        <div className="shrink-0 text-right">
          <StatusAktivitasBadge status={a.status} />
          {a.totalBiaya !== null && (
            <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
              {rupiah(a.totalBiaya)}
            </p>
          )}
          {a.totalBiaya === null && a.perkiraanBiaya !== null && (
            <p className="mt-1 text-sm font-medium tabular-nums text-ink-muted">
              ± {rupiah(a.perkiraanBiaya)}
            </p>
          )}
        </div>

        {!perluDitelepon && (
          <Ikon.lanjut
            className="size-4 shrink-0 text-ink-faint"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </Link>

      {/* Booking hangus satu-satunya baris yang menuntut tindakan langsung.
          Tombolnya berada di LUAR Link pembungkus baris, karena tautan di dalam
          tautan bukan HTML yang sah. */}
      {perluDitelepon && (
        <TombolKontak
          noHp={a.noHpPenyewa}
          nama={a.namaPenyewa}
          pesan={pesanWa.bookingHangus(
            a.namaPenyewa,
            a.bookingId ? kodeBooking(a.bookingId) : "",
            formatJamWib(a.waktuMulai),
          )}
          ringkas
          // Jarak diberikan lewat margin, bukan padding: tombolnya sendiri
          // berukuran tetap, dan padding tambahan membuatnya melar.
          className="mr-3 self-center"
        />
      )}
    </li>
  );
}

/** Pilihan penyaring untuk halaman yang menyediakannya. */
export const FILTER_AKTIVITAS: { nilai: string; label: string }[] = [
  { nilai: "", label: "Semua" },
  ...URUTAN_STATUS.map((s) => ({ nilai: s, label: LABEL_AKTIVITAS[s] })),
];

/** Apakah nilai penyaring ini benar-benar dikenali dan akan menyaring sesuatu. */
export function statusPenyaringSah(status: string): boolean {
  return URUTAN_STATUS.includes(status as StatusAktivitas);
}

export function saringAktivitas(daftar: Aktivitas[], status: string): Aktivitas[] {
  return statusPenyaringSah(status) ? daftar.filter((a) => a.status === status) : daftar;
}

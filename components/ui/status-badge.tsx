import type { StatusRental, StatusSepeda } from "@/lib/db/schema";
import type { StatusAktivitas } from "@/lib/queries/aktivitas";
import { cn } from "@/lib/cn";

/**
 * Lencana status.
 *
 * Warna selalu ditemani label teks, jadi petugas yang kesulitan membedakan warna
 * tetap bisa membaca statusnya. Titik bulat di depan memberi penanda visual cepat
 * tanpa mengandalkan emoji yang bentuknya berbeda di tiap perangkat.
 */

type Tampilan = { label: string; kelas: string; titik: string };

const sepeda: Record<StatusSepeda, Tampilan> = {
  tersedia: { label: "Tersedia", kelas: "bg-ok-soft text-ok", titik: "bg-ok" },
  disewa: { label: "Sedang disewa", kelas: "bg-danger-soft text-danger", titik: "bg-danger" },
  booking: { label: "Booking", kelas: "bg-warn-soft text-warn", titik: "bg-warn" },
  servis: { label: "Servis", kelas: "bg-info-soft text-info", titik: "bg-info" },
  nonaktif: { label: "Tidak aktif", kelas: "bg-idle-soft text-idle", titik: "bg-idle" },
};

const rental: Record<StatusRental, Tampilan> = {
  berjalan: { label: "Berjalan", kelas: "bg-danger-soft text-danger", titik: "bg-danger" },
  selesai: { label: "Selesai", kelas: "bg-ok-soft text-ok", titik: "bg-ok" },
  batal: { label: "Batal", kelas: "bg-idle-soft text-idle", titik: "bg-idle" },
};

/**
 * Tahap sebuah aktivitas, dipakai di daftar gabungan booking dan rental.
 *
 * Warnanya MENGIKUTI tabel `sepeda` di atas, bukan tabel tersendiri. Satu kata
 * hanya boleh punya satu warna di seluruh aplikasi: "Sedang disewa" merah di
 * mana pun ia muncul, "Sedang dibooking" kuning seperti "Booking".
 *
 * Sempat dibuat berbeda dengan alasan kedua lencana menjawab pertanyaan yang
 * berbeda. Alasan itu keliru. Bagi petugas yang melihatnya, kata yang sama
 * berwarna beda di dua halaman hanya berarti satu hal: ada yang tidak beres.
 * Biru juga sudah menjadi milik "Servis", sehingga memakainya untuk "Sedang
 * disewa" menabrak dua konvensi sekaligus.
 *
 * Yang tersisa untuk tahap baru: "Hangus" memakai abu-abu bersama "Batal",
 * karena keduanya sama-sama booking yang sudah tidak berlaku lagi. Yang
 * membedakannya labelnya, dan bahwa baris hangus membawa tombol WhatsApp.
 */
const aktivitas: Record<StatusAktivitas, Tampilan> = {
  disewa: sepeda.disewa,
  dibooking: { ...sepeda.booking, label: "Sedang dibooking" },
  hangus: { label: "Hangus", kelas: "bg-idle-soft text-idle", titik: "bg-idle" },
  selesai: rental.selesai,
  batal: rental.batal,
};

const kelasLencana =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

function LencanaStatus({ tampilan, className }: { tampilan: Tampilan; className?: string }) {
  return (
    <span className={cn(kelasLencana, tampilan.kelas, className)}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", tampilan.titik)}
      />
      {tampilan.label}
    </span>
  );
}

const nadaLencana = {
  ok: { kelas: "bg-ok-soft text-ok", titik: "bg-ok" },
  danger: { kelas: "bg-danger-soft text-danger", titik: "bg-danger" },
  warn: { kelas: "bg-warn-soft text-warn", titik: "bg-warn" },
  info: { kelas: "bg-info-soft text-info", titik: "bg-info" },
  idle: { kelas: "bg-idle-soft text-idle", titik: "bg-idle" },
  netral: { kelas: "bg-surface-2 text-ink-muted", titik: "bg-ink-faint" },
} as const;

/**
 * Lencana bebas untuk keterangan yang bukan status sepeda atau rental: jumlah
 * sepeda seorang pemilik, penyewa yang sedang menyewa, akun yang nonaktif.
 *
 * Bentuknya sama persis dengan lencana status di atas. Sebelumnya tiap halaman
 * membuat pilnya sendiri, dengan tiga ukuran dan tiga ketebalan huruf yang
 * berbeda — terlihat seperti tiga jenis benda padahal maksudnya satu.
 */
export function Lencana({
  nada = "netral",
  titik = false,
  className,
  children,
}: {
  nada?: keyof typeof nadaLencana;
  /** Titik di depan teks, untuk lencana yang memang menyatakan keadaan. */
  titik?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(kelasLencana, nadaLencana[nada].kelas, className)}>
      {titik && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", nadaLencana[nada].titik)}
        />
      )}
      {children}
    </span>
  );
}

export function StatusSepedaBadge({
  status,
  className,
}: {
  status: StatusSepeda;
  className?: string;
}) {
  return <LencanaStatus tampilan={sepeda[status]} className={className} />;
}

export function StatusRentalBadge({
  status,
  className,
}: {
  status: StatusRental;
  className?: string;
}) {
  return <LencanaStatus tampilan={rental[status]} className={className} />;
}

export function StatusAktivitasBadge({
  status,
  className,
}: {
  status: StatusAktivitas;
  className?: string;
}) {
  return <LencanaStatus tampilan={aktivitas[status]} className={className} />;
}

export const labelStatusSepeda = (status: StatusSepeda) => sepeda[status].label;
export const labelStatusRental = (status: StatusRental) => rental[status].label;

import type { StatusRental, StatusSepeda } from "@/lib/db/schema";
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

function Lencana({ tampilan, className }: { tampilan: Tampilan; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        tampilan.kelas,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", tampilan.titik)}
      />
      {tampilan.label}
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
  return <Lencana tampilan={sepeda[status]} className={className} />;
}

export function StatusRentalBadge({
  status,
  className,
}: {
  status: StatusRental;
  className?: string;
}) {
  return <Lencana tampilan={rental[status]} className={className} />;
}

export const labelStatusSepeda = (status: StatusSepeda) => sepeda[status].label;
export const labelStatusRental = (status: StatusRental) => rental[status].label;

import type { Metadata } from "next";
import Link from "next/link";
import { wajibPengguna } from "@/lib/auth/dal";
import { bookingKedaluwarsa, daftarBooking } from "@/lib/queries/bookings";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import type { StatusBooking } from "@/lib/db/schema";
import { Card, KeadaanKosong } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { Ikon } from "@/components/ui/icons";
import { kodeBooking } from "@/lib/booking/kode";
import { rupiah } from "@/lib/format";
import { formatJamWib, formatTanggalWib } from "@/lib/waktu";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Booking" };

const FILTER = [
  { nilai: "", label: "Semua" },
  { nilai: "booking", label: "Booking" },
  { nilai: "selesai", label: "Selesai" },
  { nilai: "batal", label: "Batal" },
];

const STATUS_SAH: StatusBooking[] = ["booking", "selesai", "batal"];

const GAYA_STATUS: Record<StatusBooking, string> = {
  booking: "bg-warn-soft text-warn",
  selesai: "bg-ok-soft text-ok",
  batal: "bg-idle-soft text-idle",
};

const LABEL_STATUS: Record<StatusBooking, string> = {
  booking: "Booking",
  selesai: "Selesai",
  batal: "Batal",
};

export default async function HalamanBooking(props: PageProps<"/booking">) {
  await wajibPengguna();
  const params = await props.searchParams;

  const statusMentah = typeof params.status === "string" ? params.status : "";
  const status = STATUS_SAH.includes(statusMentah as StatusBooking)
    ? (statusMentah as StatusBooking)
    : undefined;

  const [daftar, pengaturan] = await Promise.all([
    daftarBooking({ status, batas: 200 }),
    ambilPengaturan(),
  ]);

  const sekarang = new Date();
  const jumlahKedaluwarsa = daftar.filter((b) =>
    bookingKedaluwarsa(b, sekarang, pengaturan.toleransiBookingMenit),
  ).length;

  const pilihanFilter = FILTER.map((f) => ({
    ...f,
    href: f.nilai ? `/booking?status=${f.nilai}` : "/booking",
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Booking"
        keterangan={`${daftar.length} booking${status ? ` berstatus ${LABEL_STATUS[status]}` : ""}`}
        aksi={
          <ButtonLink href="/booking/baru" ukuran="sm" ikon={Ikon.tambah}>
            Tambah
          </ButtonLink>
        }
      />

      <FilterChips
        label="Saring menurut status"
        pilihan={pilihanFilter}
        aktif={status ?? ""}
      />

      {jumlahKedaluwarsa > 0 && (
        <p className="rounded-control border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          {jumlahKedaluwarsa} booking sudah lewat jam mulainya tapi belum dijemput.
          Tandai hangus lewat detail booking kalau penyewanya tidak datang.
        </p>
      )}

      {daftar.length === 0 ? (
        <Card>
          <KeadaanKosong
            ikon={Ikon.booking}
            judul="Belum ada booking"
            keterangan="Catat pesanan dari telepon atau WhatsApp supaya sepedanya terkunci."
            aksi={
              <ButtonLink href="/booking/baru" ikon={Ikon.tambah}>
                Tambah booking
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {daftar.map((b) => {
            const lewat = bookingKedaluwarsa(b, sekarang, pengaturan.toleransiBookingMenit);

            return (
              <Link
                key={b.id}
                href={`/booking/${b.id}`}
                className="flex items-start justify-between gap-3 p-4 transition-colors first:rounded-t-card last:rounded-b-card hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs tracking-wider text-ink-muted">
                    {kodeBooking(b.id)}
                  </p>
                  <p className="truncate font-medium text-ink">{b.namaPenyewa}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {b.kodeSepeda} — {b.namaSepeda}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-faint">
                    {formatTanggalWib(b.waktuMulai)} · {formatJamWib(b.waktuMulai)} ·{" "}
                    {b.durasiJam} jam
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-ink">
                    {rupiah(b.tarifPerJamSnapshot * b.durasiJam)}
                  </p>
                  <span
                    className={cn(
                      "mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-medium",
                      GAYA_STATUS[b.status],
                    )}
                  >
                    {LABEL_STATUS[b.status]}
                  </span>
                  {lewat && (
                    <span className="mt-1 block text-xs font-medium text-danger">
                      terlewat
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ikon, type NamaIkon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Sub-navigasi Pengaturan.
 *
 * Sebelumnya seluruh isi Pengaturan bertumpuk sebagai satu kolom panjang:
 * tampilan, akun, identitas usaha, ganti sandi, dan daftar tim berderet ke
 * bawah. Untuk mengganti satu kata sandi orang harus melewati semuanya, dan
 * tidak ada alamat yang bisa disimpan untuk bagian tertentu.
 *
 * Setiap bagian kini punya alamatnya sendiri, jadi bisa ditautkan langsung dan
 * kembali ke tempat yang sama setelah menyimpan.
 */

type Bagian = {
  href: string;
  label: string;
  keterangan: string;
  ikon: NamaIkon;
  /** Hanya untuk admin dan owner. */
  pengelola?: boolean;
};

export const BAGIAN_PENGATURAN: Bagian[] = [
  {
    href: "/pengaturan",
    label: "Umum",
    keterangan: "Identitas usaha dan aturan operasional",
    ikon: "pengaturan",
  },
  {
    href: "/pengaturan/akun",
    label: "Akun Saya",
    keterangan: "Data akun dan kata sandi",
    ikon: "penyewa",
  },
  {
    href: "/pengaturan/tim",
    label: "Tim & Akses",
    keterangan: "Petugas yang bisa masuk aplikasi",
    ikon: "pemilik",
    pengelola: true,
  },
  {
    href: "/pengaturan/tampilan",
    label: "Tampilan",
    keterangan: "Tema terang atau gelap",
    ikon: "tampilan",
  },
];

export function NavPengaturan({ bolehKelolaTim }: { bolehKelolaTim: boolean }) {
  const pathname = usePathname();
  const bagian = BAGIAN_PENGATURAN.filter((b) => !b.pengelola || bolehKelolaTim);

  return (
    <nav aria-label="Bagian pengaturan" className="lg:sticky lg:top-20">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {bagian.map((b) => {
          // Cocok persis, bukan awalan: "/pengaturan" adalah awalan dari semua
          // alamat lain di sini, jadi awalan akan menandai Umum selalu aktif.
          const aktif = pathname === b.href;
          const IkonBagian = Ikon[b.ikon];

          return (
            <li key={b.href} className="shrink-0 lg:shrink">
              <Link
                href={b.href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-control px-3.5 py-2 text-sm font-medium leading-tight transition-colors",
                  aktif
                    ? "bg-brand-soft text-brand-soft-ink"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <IkonBagian
                  className="size-[18px] shrink-0"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />

                {/* Keterangannya hanya di layar lebar. Di HP menu ini menjadi
                    baris yang digeser ke samping, dan dua baris teks di setiap
                    tombol membuatnya setinggi setengah layar. */}
                <span className="min-w-0">
                  {b.label}
                  <span className="hidden truncate text-xs font-normal text-ink-muted lg:block">
                    {b.keterangan}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

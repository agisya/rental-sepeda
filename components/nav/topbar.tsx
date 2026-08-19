"use client";

import { usePathname } from "next/navigation";
import { keluar } from "@/lib/actions/auth";
import type { PenggunaAktif } from "@/lib/auth/dal";
import { Ikon } from "@/components/ui/icons";
import { KonfirmasiAksi } from "@/components/ui/konfirmasi";
import { judulHalaman } from "./menu";

const LABEL_PERAN: Record<PenggunaAktif["peran"], string> = {
  admin: "Admin",
  kasir: "Kasir",
  owner: "Owner",
};

/** Dua huruf awal nama, dipakai sebagai lencana pengguna. */
function inisial(nama: string): string {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "?";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

export function Topbar({ pengguna }: { pengguna: PenggunaAktif }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand text-brand-ink lg:hidden"
            aria-hidden="true"
          >
            <Ikon.sepeda className="size-[18px]" strokeWidth={2} />
          </span>
          <h1 className="truncate text-[0.9375rem] font-semibold tracking-tight text-ink">
            {judulHalaman(pathname)}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-ink">{pengguna.nama}</p>
            <p className="text-xs leading-tight text-ink-muted">
              {LABEL_PERAN[pengguna.peran]}
            </p>
          </div>

          <span
            className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-muted"
            title={`${pengguna.nama} · ${LABEL_PERAN[pengguna.peran]}`}
          >
            {inisial(pengguna.nama)}
          </span>

          {/* Tombolnya kecil dan berdekatan dengan lencana pengguna, jadi paling
              mudah tersenggol — dan keluar di tengah shift berarti petugas harus
              mencari kata sandinya lagi sambil ada pelanggan menunggu. */}
          <form action={keluar}>
            <KonfirmasiAksi
              label="Keluar"
              judul="Keluar dari akun?"
              keterangan="Anda perlu memasukkan username dan kata sandi lagi untuk masuk kembali."
              labelYa="Keluar"
              variasi="bahaya"
              pemicuLabel="Keluar dari akun"
              pemicuKelas="flex size-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              pemicuAnak={
                <Ikon.keluar
                  className="size-[18px]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              }
            />
          </form>
        </div>
      </div>
    </header>
  );
}

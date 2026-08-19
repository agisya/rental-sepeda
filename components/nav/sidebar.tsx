"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Peran } from "@/lib/db/schema";
import { Ikon } from "@/components/ui/icons";
import { kelompokUntukPeran, menuAktif, type ItemMenu } from "./menu";

/** Satu tautan menu. Bentuknya sama baik di dalam lipatan maupun di luar. */
function TautanMenu({ item, aktif }: { item: ItemMenu; aktif: boolean }) {
  // Diambil langsung dari tabel, bukan lewat ikonMenu(): pemanggilan fungsi di
  // dalam badan komponen dibaca lint sebagai komponen yang dibuat saat render.
  const IkonMenu = Ikon[item.ikon];

  return (
    <Link
      href={item.href}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors",
        aktif
          ? "bg-brand-soft font-medium text-brand-soft-ink"
          : "text-ink-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      {/* Penanda batang di tepi kiri: status aktif tidak hanya dibedakan
          lewat warna. */}
      {aktif && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand"
        />
      )}

      <IkonMenu
        className={cn("size-[18px] shrink-0", aktif && "text-brand")}
        strokeWidth={aktif ? 2.2 : 1.8}
        aria-hidden="true"
      />

      {item.label}
    </Link>
  );
}

/**
 * Navigasi samping untuk laptop kasir. Disembunyikan di layar kecil.
 *
 * Menu disaring menurut peran supaya kasir tidak melihat menu keuangan yang
 * memang tidak boleh dibukanya. Penyaringan di sini hanya merapikan tampilan —
 * penjagaan sesungguhnya tetap ada di setiap halaman dan setiap aksi.
 */
export function Sidebar({ peran }: { peran: Peran }) {
  const pathname = usePathname();
  const kelompokMenu = kelompokUntukPeran(peran);

  return (
    <nav
      aria-label="Menu utama"
      className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block"
    >
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand text-brand-ink"
            aria-hidden="true"
          >
            <Ikon.sepeda className="size-5" strokeWidth={2} />
          </span>

          <span className="text-[0.9375rem] font-semibold leading-tight tracking-tight text-ink">
            Rental Sepeda
            <span className="block text-xs font-normal text-ink-muted">Garut</span>
          </span>
        </div>

        {/*
          Tiga bentuk, dipilih menurut isi kelompoknya sendiri:

          1. Kelompok operasional tidak pernah dilipat. Dashboard, scan, booking,
             dan transaksi dibuka berkali-kali dalam satu jam; menaruhnya di balik
             satu ketukan tambahan justru memperjauh yang paling sering dipakai.
          2. Kelompok yang setelah disaring peran hanya menyisakan satu menu
             ditampilkan sebagai tautan biasa. Melipat satu baris di balik satu
             baris lain tidak memendekkan apa pun — bagi kasir, Keuangan hanya
             berisi Tutup Toko, dan Lainnya hanya berisi Pengaturan.
          3. Sisanya dilipat, dan yang memuat halaman sedang dibuka selalu
             terbuka.

          Memakai details/summary bawaan peramban: keadaan terbuka-tertutup,
          pengoperasian lewat papan tik, dan pembacaan oleh pembaca layar sudah
          benar tanpa ditulis ulang.
        */}
        <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-6">
          {kelompokMenu.map((kelompok) => {
            const memuatHalamanIni = kelompok.item.some((m) =>
              menuAktif(pathname, m.href),
            );

            if (kelompok.selaluTampil) {
              // Tanpa judul di atasnya. Kelompok ini berada paling atas dan
              // tidak punya kembarannya yang perlu dibedakan, jadi judulnya
              // hanya menambah baris yang tidak menjelaskan apa pun. Nama
              // kelompoknya tetap ada di aria-label demi pembaca layar.
              return (
                <ul
                  key={kelompok.judul}
                  aria-label={kelompok.judul}
                  className="space-y-0.5 pb-3"
                >
                  {kelompok.item.map((m) => (
                    <li key={m.href}>
                      <TautanMenu item={m} aktif={menuAktif(pathname, m.href)} />
                    </li>
                  ))}
                </ul>
              );
            }

            if (kelompok.item.length === 1) {
              const m = kelompok.item[0];
              return (
                <TautanMenu
                  key={kelompok.judul}
                  item={m}
                  aktif={menuAktif(pathname, m.href)}
                />
              );
            }

            const IkonKelompok = Ikon[kelompok.ikon];

            return (
              /*
                key ikut berubah saat kelompoknya menjadi aktif atau berhenti
                aktif, supaya open dihitung ulang. Tanpa itu, kelompok yang tadi
                dilipat sendiri oleh pengguna tetap terlipat meskipun halaman yang
                sedang dibuka ada di dalamnya — dan menu aktifnya tidak terlihat.
              */
              <details
                key={`${kelompok.judul}:${memuatHalamanIni}`}
                open={memuatHalamanIni}
                className="group"
              >
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors marker:content-['']",
                    memuatHalamanIni
                      ? "font-medium text-ink"
                      : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <IkonKelompok
                    className={cn(
                      "size-[18px] shrink-0",
                      memuatHalamanIni && "text-brand",
                    )}
                    strokeWidth={memuatHalamanIni ? 2.2 : 1.8}
                    aria-hidden="true"
                  />

                  <span className="flex-1">{kelompok.judul}</span>

                  <Ikon.lanjut
                    className="size-4 shrink-0 transition-transform group-open:rotate-90"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </summary>

                {/* Digeser masuk supaya terbaca sebagai isi kelompok di atasnya,
                    bukan sebagai menu sejajar yang kebetulan berurutan. */}
                <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-line pl-1.5">
                  {kelompok.item.map((m) => (
                    <li key={m.href}>
                      <TautanMenu item={m} aktif={menuAktif(pathname, m.href)} />
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

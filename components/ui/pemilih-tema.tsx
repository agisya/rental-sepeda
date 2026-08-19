"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Pemilih tema: Sistem, Terang, Gelap.
 *
 * Tiga pilihan, bukan dua. "Sistem" bukan pelengkap — itulah keadaan awal semua
 * orang, dan petugas yang ponselnya berganti gelap sendiri saat malam tidak
 * perlu mengurus apa pun. Dua pilihan lain berarti memilih untuk menang atas
 * setelan sistem, ke dua arah.
 *
 * Pilihan disimpan di localStorage dan diterapkan lagi oleh skrip kecil di
 * app/layout.tsx sebelum halaman digambar. Tanpa skrip itu, halaman sempat
 * tampil terang sekejap sebelum berubah gelap — kedipan yang paling terasa
 * justru bagi orang yang memilih gelap karena silau.
 */

export const KUNCI_TEMA = "tema";

type Tema = "sistem" | "terang" | "gelap";

const PILIHAN: { nilai: Tema; label: string; ikon: typeof Sun }[] = [
  { nilai: "sistem", label: "Sistem", ikon: Monitor },
  { nilai: "terang", label: "Terang", ikon: Sun },
  { nilai: "gelap", label: "Gelap", ikon: Moon },
];

/*
  Tema adalah keadaan milik peramban, bukan milik React: ia hidup di localStorage
  dan di atribut elemen html, dan bisa berubah dari tab lain. Karena itu dibaca
  lewat useSyncExternalStore, bukan disalin ke useState di dalam efek — menyalin
  membuat React sempat menampilkan nilai yang sudah usang, lalu menimpanya.
*/

const pendengar = new Set<() => void>();

function langgan(ubah: () => void): () => void {
  pendengar.add(ubah);
  // Mengganti tema di satu tab ikut terlihat di tab lain yang sedang terbuka.
  window.addEventListener("storage", ubah);

  return () => {
    pendengar.delete(ubah);
    window.removeEventListener("storage", ubah);
  };
}

function bacaDiKlien(): Tema {
  try {
    const nilai = localStorage.getItem(KUNCI_TEMA);
    if (nilai === "terang" || nilai === "gelap") return nilai;
  } catch {
    // Penyimpanan diblokir — perlakukan seperti belum pernah memilih.
  }
  return "sistem";
}

// Server tidak tahu pilihan siapa pun, dan memang tidak perlu tahu: elemen html
// sudah disetel skrip di layout sebelum halaman digambar.
function bacaDiServer(): Tema {
  return "sistem";
}

function terapkan(tema: Tema) {
  const akar = document.documentElement;

  if (tema === "sistem") {
    delete akar.dataset.theme;
  } else {
    akar.dataset.theme = tema === "gelap" ? "dark" : "light";
  }

  try {
    if (tema === "sistem") localStorage.removeItem(KUNCI_TEMA);
    else localStorage.setItem(KUNCI_TEMA, tema);
  } catch {
    // Peramban dengan penyimpanan diblokir tetap boleh mengganti tema; hanya
    // pilihannya yang tidak bertahan setelah halaman ditutup.
  }

  pendengar.forEach((beritahu) => beritahu());
}

export function PemilihTema() {
  const tema = useSyncExternalStore(langgan, bacaDiKlien, bacaDiServer);

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className="inline-flex gap-1 rounded-control border border-line bg-surface-2 p-1"
    >
      {PILIHAN.map(({ nilai, label, ikon: IkonTema }) => {
        const aktif = tema === nilai;

        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => terapkan(nilai)}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-[0.375rem] px-3 text-sm font-medium transition-colors",
              aktif
                ? "bg-surface text-ink shadow-tempel"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <IkonTema className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

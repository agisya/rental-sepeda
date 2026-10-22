"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Ikon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  bacaTema,
  KUNCI_TEMA,
  type Tema,
  temaBerikutnya,
  WARNA_BILAH,
} from "@/lib/tema";

/**
 * Dua cara mengganti tema, satu keadaan.
 *
 * PemilihTema — dua tombol berlabel di Pengaturan. TombolTema — satu ikon yang
 * ada di setiap halaman: bilah atas aplikasi, kepala landing page, dan kepala
 * halaman masuk, daftar, serta galat. Tema adalah pilihan milik perangkat,
 * bukan milik akun, jadi orang yang belum masuk pun harus bisa menggantinya —
 * termasuk di layar login, yang paling sering dibuka di konter yang silau.
 *
 * Keduanya tinggal di berkas ini karena keduanya membaca dan menulis keadaan
 * yang sama, dan keduanya tampil bersamaan di halaman Pengaturan. Kalau
 * masing-masing punya daftar pendengarnya sendiri, menekan tombol di bilah atas
 * tidak akan menggerakkan pilihan di bawahnya — terlihat seperti tidak berfungsi.
 *
 * Pilihan disimpan di localStorage dan diterapkan lagi oleh SKRIP_TEMA di
 * <head> sebelum halaman digambar. Tanpa skrip itu, halaman sempat tampil
 * terang sekejap sebelum berubah gelap — kedipan yang paling terasa justru
 * bagi orang yang memilih gelap karena silau.
 */

/*
  Tema adalah keadaan milik peramban, bukan milik React: ia hidup di localStorage
  dan di atribut elemen html, dan bisa berubah dari tab lain. Karena itu dibaca
  lewat useSyncExternalStore, bukan disalin ke useState di dalam efek — menyalin
  membuat React sempat menampilkan nilai yang sudah usang, lalu menimpanya.
*/

const pendengar = new Set<() => void>();

function langganTema(ubah: () => void): () => void {
  pendengar.add(ubah);
  // Mengganti tema di satu tab ikut terlihat di tab lain yang sedang terbuka.
  window.addEventListener("storage", ubah);

  return () => {
    pendengar.delete(ubah);
    window.removeEventListener("storage", ubah);
  };
}

function temaDiKlien(): Tema {
  try {
    return bacaTema(localStorage.getItem(KUNCI_TEMA));
  } catch {
    // Penyimpanan diblokir — perlakukan seperti belum pernah memilih.
    return "terang";
  }
}

// Server tidak tahu pilihan siapa pun, dan memang tidak perlu tahu: elemen html
// sudah disetel skrip di layout sebelum halaman digambar, dan bawaan aplikasi
// ini selalu terang.
function temaDiServer(): Tema {
  return "terang";
}

function useTema(): Tema {
  return useSyncExternalStore(langganTema, temaDiKlien, temaDiServer);
}

/** Memasang tema ke halaman tanpa menyimpannya. */
function pasang(tema: Tema) {
  document.documentElement.dataset.theme = tema === "gelap" ? "dark" : "light";

  // Bilah alamat di HP ikut berganti. Elemen meta-nya dibuat Next dari
  // viewport.themeColor di app/layout.tsx.
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = WARNA_BILAH[tema];
    });
}

function terapkan(tema: Tema) {
  pasang(tema);

  try {
    localStorage.setItem(KUNCI_TEMA, tema);
  } catch {
    // Peramban dengan penyimpanan diblokir tetap boleh mengganti tema; hanya
    // pilihannya yang tidak bertahan setelah halaman ditutup.
  }

  pendengar.forEach((beritahu) => beritahu());
}

const PILIHAN: { nilai: Tema; label: string; ikon: typeof Ikon.temaTerang }[] = [
  { nilai: "terang", label: "Terang", ikon: Ikon.temaTerang },
  { nilai: "gelap", label: "Gelap", ikon: Ikon.temaGelap },
];

/** Pemilih tema lengkap: Terang, Gelap. Dipakai di Pengaturan. */
export function PemilihTema() {
  const tema = useTema();

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

const LABEL_TUJUAN: Record<Tema, string> = {
  terang: "Ganti ke tema terang",
  gelap: "Ganti ke tema gelap",
};

/**
 * Tombol tema satu ikon: bulan saat terang, matahari saat gelap.
 *
 * Ikonnya menunjukkan ke mana tombol ini membawa, bukan keadaan sekarang —
 * keadaan sekarang sudah terlihat dari halamannya sendiri. Satu ikon polos
 * dipilih supaya bisa duduk di kepala halaman mana pun, termasuk kepala login
 * yang hanya berisi merek, tanpa menjadi benda paling ramai di situ.
 */
export function TombolTema({ className }: { className?: string }) {
  const tema = useTema();

  /*
    Memasang ulang tema setelah React mengambil alih halaman. Di mode
    pengembangan, Strict Mode memasang ulang elemen html dan membuang atribut
    yang dipasang SKRIP_TEMA, sehingga halaman kembali terang padahal pilihan
    tersimpannya gelap. Di produksi ini tidak mengubah apa pun.

    Tombol ini ada di setiap halaman, jadi di sinilah tempat yang menjamin
    pemasangan ulang itu selalu terjadi.
  */
  useLayoutEffect(() => {
    pasang(temaDiKlien());
  }, []);

  const gelap = tema === "gelap";
  const tujuan = temaBerikutnya(tema);
  const IkonTujuan = gelap ? Ikon.temaTerang : Ikon.temaGelap;

  return (
    <button
      type="button"
      // Sakelar, bukan tombol biasa: pembaca layar menyebutkan keadaan hidup
      // atau mati, sesuatu yang tidak bisa disampaikan ikon saja.
      role="switch"
      aria-checked={gelap}
      aria-label="Tema gelap"
      title={LABEL_TUJUAN[tujuan]}
      onClick={() => terapkan(tujuan)}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <IkonTujuan className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

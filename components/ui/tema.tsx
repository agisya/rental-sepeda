"use client";

import { useSyncExternalStore } from "react";
import { Ikon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  bacaTema,
  KUNCI_TEMA,
  type Tema,
  type TemaNyata,
  temaBerikutnya,
  temaEfektif,
} from "@/lib/tema";

/**
 * Dua cara mengganti tema, satu keadaan.
 *
 * PemilihTema — tiga tombol berlabel di Pengaturan, tempat "Sistem" bisa
 * dipulihkan. TombolTema — satu ikon di bilah atas, untuk membalik terang dan
 * gelap tanpa meninggalkan halaman yang sedang dikerjakan.
 *
 * Keduanya tinggal di berkas ini karena keduanya membaca dan menulis keadaan
 * yang sama, dan keduanya tampil bersamaan di halaman Pengaturan. Kalau
 * masing-masing punya daftar pendengarnya sendiri, menekan tombol di bilah atas
 * tidak akan menggerakkan pilihan di bawahnya — terlihat seperti tidak berfungsi.
 *
 * Pilihan disimpan di localStorage dan diterapkan lagi oleh skrip kecil di
 * app/layout.tsx sebelum halaman digambar. Tanpa skrip itu, halaman sempat
 * tampil terang sekejap sebelum berubah gelap — kedipan yang paling terasa
 * justru bagi orang yang memilih gelap karena silau.
 */

/*
  Tema adalah keadaan milik peramban, bukan milik React: ia hidup di localStorage
  dan di atribut elemen html, dan bisa berubah dari tab lain. Karena itu dibaca
  lewat useSyncExternalStore, bukan disalin ke useState di dalam efek — menyalin
  membuat React sempat menampilkan nilai yang sudah usang, lalu menimpanya.

  Pilihan pengguna dan setelan sistem sengaja jadi dua langganan terpisah, bukan
  satu objek berisi keduanya. useSyncExternalStore membandingkan hasil bacaan
  dengan ===, jadi mengembalikan objek baru tiap kali dibaca membuat React
  menggambar ulang tanpa henti. Dua nilai sederhana tidak punya masalah itu.
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
    return "sistem";
  }
}

// Server tidak tahu pilihan siapa pun, dan memang tidak perlu tahu: elemen html
// sudah disetel skrip di layout sebelum halaman digambar.
function temaDiServer(): Tema {
  return "sistem";
}

function useTema(): Tema {
  return useSyncExternalStore(langganTema, temaDiKlien, temaDiServer);
}

let kueriGelap: MediaQueryList | undefined;

function mediaGelap(): MediaQueryList {
  kueriGelap ??= window.matchMedia("(prefers-color-scheme: dark)");
  return kueriGelap;
}

/*
  Setelan sistem ikut didengarkan, bukan sekadar dibaca sekali. Ponsel yang
  dijadwalkan berganti gelap saat matahari terbenam mengubahnya di tengah shift,
  dan tanpa langganan ini ikon tombol tetap menunjuk arah yang salah sampai
  halaman dimuat ulang.
*/
function langganSistem(ubah: () => void): () => void {
  const kueri = mediaGelap();
  kueri.addEventListener("change", ubah);

  return () => kueri.removeEventListener("change", ubah);
}

function sistemGelapDiKlien(): boolean {
  return mediaGelap().matches;
}

function sistemGelapDiServer(): boolean {
  return false;
}

function useSistemGelap(): boolean {
  return useSyncExternalStore(
    langganSistem,
    sistemGelapDiKlien,
    sistemGelapDiServer,
  );
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

const PILIHAN: { nilai: Tema; label: string; ikon: typeof Ikon.temaTerang }[] = [
  { nilai: "sistem", label: "Sistem", ikon: Ikon.temaSistem },
  { nilai: "terang", label: "Terang", ikon: Ikon.temaTerang },
  { nilai: "gelap", label: "Gelap", ikon: Ikon.temaGelap },
];

/** Pemilih tema lengkap: Sistem, Terang, Gelap. Dipakai di Pengaturan. */
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

const LABEL_TUJUAN: Record<TemaNyata, string> = {
  terang: "Ganti ke tema terang",
  gelap: "Ganti ke tema gelap",
};

/**
 * Sakelar tema di bilah atas: matahari di kiri, bulan di kanan, kenop bergeser.
 *
 * Jalur dan kenop memakai warna tema yang sama di kedua keadaan — jalur
 * surface-2, kenop ink. Karena kedua warna itu sendiri sudah bertukar mengikuti
 * tema, sakelarnya otomatis tampil kenop gelap di atas jalur terang saat terang,
 * dan sebaliknya saat gelap. Tidak ada warna yang perlu ditulis dua kali.
 *
 * Yang menandakan keadaan bukan hanya letak kenop, tapi juga ikon di sisinya:
 * sisi yang sedang berlaku memakai warna teks penuh, sisi lain diredupkan.
 * Letak kenop sendiri gampang salah baca — orang harus ingat mana ujung yang
 * berarti gelap, sedangkan matahari dan bulan tidak perlu diingat.
 *
 * Hanya dua arah, jadi menekannya sekali berarti keluar dari "Sistem" untuk
 * seterusnya. Itu disengaja: yang ingin kembali mengikuti setelan ponselnya
 * memilihnya di Pengaturan > Tampilan, dan itu keputusan yang jarang diambil
 * di tengah melayani pelanggan.
 */
export function TombolTema() {
  const tema = useTema();
  const sistemGelap = useSistemGelap();

  const gelap = temaEfektif(tema, sistemGelap) === "gelap";
  const tujuan = temaBerikutnya(tema, sistemGelap);

  return (
    <button
      type="button"
      // Sakelar, bukan tombol biasa: pembaca layar menyebutkan keadaan hidup
      // atau mati, sehingga letak kenop yang tak terlihat itu tetap tersampaikan.
      role="switch"
      aria-checked={gelap}
      aria-label="Tema gelap"
      title={LABEL_TUJUAN[tujuan]}
      onClick={() => terapkan(tujuan)}
      className="group flex h-9 shrink-0 items-center gap-1.5 rounded-control px-1"
    >
      <Ikon.temaTerang
        className={cn(
          "size-4 shrink-0 transition-colors",
          gelap ? "text-ink-faint" : "text-ink",
        )}
        strokeWidth={1.9}
        aria-hidden="true"
      />

      <span className="flex h-6 w-11 shrink-0 items-center rounded-full border border-line bg-surface-2 transition-colors group-hover:border-line-strong">
        {/*
          Kenop digeser dengan transform, bukan dengan mengubah margin atau
          posisi: transform tidak memaksa tata letak dihitung ulang, sehingga
          geserannya tetap mulus di ponsel kentang yang dipakai di konter.
        */}
        <span
          className={cn(
            "size-[18px] rounded-full bg-ink transition-transform duration-200 motion-reduce:transition-none",
            gelap ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </span>

      <Ikon.temaGelap
        className={cn(
          "size-4 shrink-0 transition-colors",
          gelap ? "text-ink" : "text-ink-faint",
        )}
        strokeWidth={1.9}
        aria-hidden="true"
      />
    </button>
  );
}

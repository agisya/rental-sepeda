"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Ikon } from "@/components/ui/icons";
import { CameraScanner } from "./camera-scanner";
import { normalkanKode } from "@/lib/format";

/**
 * Satu pintu masuk untuk tiga cara memasukkan kode sepeda:
 *
 *  1. Scanner USB/Bluetooth — bekerja seperti keyboard. Kolom ini menjaga fokus
 *     sendiri, jadi petugas cukup menembak barcode tanpa menyentuh layar.
 *  2. Kamera HP — dibuka lewat tombol, memuat pustaka pemindai sesuai kebutuhan.
 *  3. Ketik manual — cadangan kalau stiker barcode rusak atau kotor.
 */
export function ScannerInput({
  kodeAwal = "",
  tujuan = "/scan",
  judul = "Scan sepeda",
  keterangan = "Tembak barcode dengan scanner, atau ketik kodenya lalu tekan Enter.",
}: {
  kodeAwal?: string;
  /** Halaman yang dituju setelah kodenya didapat. Booking memakai pemindai yang
   *  sama supaya petugas tidak perlu belajar dua cara memasukkan kode sepeda. */
  tujuan?: string;
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kode, setKode] = useState(kodeAwal);
  const [kameraTerbuka, setKameraTerbuka] = useState(false);

  const cari = useCallback(
    (nilai: string) => {
      const bersih = normalkanKode(nilai);
      if (!bersih) return;
      router.push(`${tujuan}?kode=${encodeURIComponent(bersih)}`);
    },
    [router, tujuan],
  );

  // Kembalikan fokus ke kolom ini setiap kali fokus lepas ke tempat kosong,
  // supaya tembakan scanner berikutnya selalu masuk ke sini. Fokus tidak
  // direbut ketika petugas sedang mengisi kolom lain atau menekan tombol.
  useEffect(() => {
    if (kameraTerbuka) return;

    function rebutFokus() {
      const aktif = document.activeElement;
      const sedangMengisi =
        aktif instanceof HTMLInputElement ||
        aktif instanceof HTMLTextAreaElement ||
        aktif instanceof HTMLSelectElement ||
        aktif instanceof HTMLButtonElement ||
        aktif instanceof HTMLAnchorElement;

      if (!sedangMengisi) inputRef.current?.focus();
    }

    rebutFokus();
    const jeda = window.setInterval(rebutFokus, 1500);
    return () => window.clearInterval(jeda);
  }, [kameraTerbuka]);

  const dariKamera = useCallback(
    (hasil: string) => {
      setKameraTerbuka(false);
      setKode(normalkanKode(hasil));
      cari(hasil);
    },
    [cari],
  );

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4">
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
          {judul}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {keterangan}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          cari(kode);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Ikon.scan
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            name="kode"
            aria-label="Kode atau barcode sepeda"
            placeholder="Kode sepeda"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="min-h-12 w-full rounded-control border border-line-strong bg-surface py-3 pl-11 pr-3 text-base font-semibold uppercase tracking-wide text-ink transition-colors placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-faint"
          />
        </div>
        <Button type="submit" ukuran="lg" className="px-5">
          Cari
        </Button>
      </form>

      {!kameraTerbuka ? (
        <Button
          variasi="kedua"
          penuh
          ikon={Ikon.kamera}
          onClick={() => setKameraTerbuka(true)}
        >
          Scan pakai kamera
        </Button>
      ) : (
        <CameraScanner onHasil={dariKamera} onTutup={() => setKameraTerbuka(false)} />
      )}
    </div>
  );
}

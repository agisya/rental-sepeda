"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

/**
 * Pemindai barcode lewat kamera. Pustaka @zxing/browser diimpor dinamis supaya
 * tidak ikut diunduh petugas yang memakai scanner USB — pustakanya cukup besar
 * dan sebagian besar sesi tidak pernah membuka kamera.
 *
 * Butuh HTTPS. Di localhost tetap jalan; di jaringan lokal tanpa HTTPS, browser
 * akan menolak izin kamera.
 */
export function CameraScanner({
  onHasil,
  onTutup,
}: {
  onHasil: (kode: string) => void;
  onTutup: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let dibatalkan = false;

    async function mulai() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (dibatalkan) return;

        const pembaca = new BrowserMultiFormatReader();
        controls = await pembaca.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (hasil) => {
            if (!hasil) return;
            controls?.stop();
            onHasil(hasil.getText());
          },
        );

        if (dibatalkan) {
          controls.stop();
          return;
        }
        setSiap(true);
      } catch (e) {
        if (dibatalkan) return;
        const namaGalat = e instanceof Error ? e.name : "";
        setGalat(
          namaGalat === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, atau ketik kode sepedanya secara manual."
            : namaGalat === "NotFoundError"
              ? "Kamera tidak ditemukan pada perangkat ini."
              : "Kamera tidak bisa dibuka. Coba lagi atau ketik kode sepedanya secara manual.",
        );
      }
    }

    void mulai();

    return () => {
      dibatalkan = true;
      controls?.stop();
    };
  }, [onHasil]);

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="relative overflow-hidden rounded-control bg-black">
        <video
          ref={videoRef}
          className="aspect-4/3 w-full object-cover"
          playsInline
          muted
        />
        {!siap && !galat && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Membuka kamera…
          </p>
        )}
        {siap && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-control border-2 border-white/80"
          />
        )}
      </div>

      {galat ? (
        <p role="alert" className="text-sm text-danger">
          {galat}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Arahkan kamera ke barcode pada sepeda.
        </p>
      )}

      <Button variasi="kedua" penuh onClick={onTutup}>
        Tutup kamera
      </Button>
    </div>
  );
}

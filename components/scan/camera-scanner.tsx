"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pemindai barcode lewat kamera. Pustaka @zxing/browser diimpor dinamis supaya
 * tidak ikut diunduh petugas yang memakai scanner USB — pustakanya cukup besar
 * dan sebagian besar sesi tidak pernah membuka kamera.
 *
 * Butuh HTTPS. Di localhost tetap jalan; di jaringan lokal tanpa HTTPS, browser
 * akan menolak izin kamera.
 */

type Arah = "belakang" | "depan";

/**
 * Meminta kamera belakang secara tegas.
 *
 * Sebelumnya perangkatnya tidak disebut sama sekali, dan peramban memberikan
 * yang pertama ditemukannya — di ponsel hampir selalu kamera depan. Akibatnya
 * kamera terbuka dan terlihat normal, tapi yang tersorot wajah petugas, bukan
 * stiker di sepeda. Barcode tidak akan pernah terbaca, dan tidak ada pesan galat
 * apa pun yang menjelaskan kenapa.
 *
 * "ideal", bukan "exact": perangkat yang hanya punya satu kamera tetap boleh
 * memakainya daripada gagal total.
 */
function batasan(arah: Arah): MediaStreamConstraints {
  return {
    video: { facingMode: { ideal: arah === "belakang" ? "environment" : "user" } },
  };
}

/**
 * Satu sesi kamera. Dipasang ulang lewat key setiap kali arahnya berganti,
 * sehingga keadaan "siap" dan pesan galatnya ikut bersih dengan sendirinya —
 * tanpa perlu mereset state dari dalam efek.
 */
function Pratinjau({
  arah,
  onHasil,
  onGanti,
}: {
  arah: Arah;
  onHasil: (kode: string) => void;
  onGanti: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let dibatalkan = false;

    async function mulai() {
      // Peramban menolak kamera di alamat yang tidak aman, dan penolakannya
      // muncul sebagai galat yang membingungkan. Diperiksa lebih dulu supaya
      // pesannya menyebut sebab yang sebenarnya: alamatnya, bukan kameranya.
      //
      // Ini kejadian paling umum saat menguji dari HP lewat http://192.168.x.x.
      if (!window.isSecureContext) {
        setGalat(
          "Kamera hanya bisa dibuka lewat HTTPS. Alamat http:// biasa ditolak " +
            "peramban demi keamanan. Buka aplikasi lewat domain resminya, atau " +
            "ketik kode sepedanya secara manual.",
        );
        return;
      }

      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (dibatalkan) return;

        const pembaca = new BrowserMultiFormatReader();
        controls = await pembaca.decodeFromConstraints(
          batasan(arah),
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
            : namaGalat === "NotFoundError" || namaGalat === "OverconstrainedError"
              ? "Kamera itu tidak ada di perangkat ini. Coba tombol ganti kamera."
              : "Kamera tidak bisa dibuka. Coba lagi atau ketik kode sepedanya secara manual.",
        );
      }
    }

    void mulai();

    return () => {
      dibatalkan = true;
      controls?.stop();
    };
  }, [onHasil, arah]);

  return (
    <>
      <div className="relative overflow-hidden rounded-control bg-black">
        {/* 16:9, bukan 4:3. Pratinjau yang terlalu tinggi mendorong tombol di
            bawahnya keluar layar ponsel, sehingga terlihat seperti tidak ada
            tombol sama sekali. */}
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
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
            className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-control border-2 border-white/80"
          />
        )}

        {/* Menempel di pratinjau, bukan di bawahnya: inilah tombol yang dicari
            orang ketika yang tersorot ternyata wajahnya sendiri. */}
        <button
          type="button"
          onClick={onGanti}
          aria-label={
            arah === "belakang" ? "Ganti ke kamera depan" : "Ganti ke kamera belakang"
          }
          className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <SwitchCamera className="size-5" strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>

      {galat ? (
        <p role="alert" className="text-sm text-danger">
          {galat}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Arahkan kamera ke barcode pada sepeda. Memakai kamera{" "}
          {arah === "belakang" ? "belakang" : "depan"}.
        </p>
      )}
    </>
  );
}

export function CameraScanner({
  onHasil,
  onTutup,
}: {
  onHasil: (kode: string) => void;
  onTutup: () => void;
}) {
  const [arah, setArah] = useState<Arah>("belakang");

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-3">
      <Pratinjau
        key={arah}
        arah={arah}
        onHasil={onHasil}
        onGanti={() => setArah((s) => (s === "belakang" ? "depan" : "belakang"))}
      />

      <Button variasi="kedua" penuh onClick={onTutup}>
        Tutup kamera
      </Button>
    </div>
  );
}

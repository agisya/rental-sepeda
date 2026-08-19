"use client";

import { useEffect, useRef, useState } from "react";
// Tipe saja — dihapus saat kompilasi, jadi pustakanya tetap hanya diunduh
// ketika kamera benar-benar dibuka.
import type { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import type { DecodeHintType } from "@zxing/library";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Ikon } from "@/components/ui/icons";

/**
 * Pemindai barcode lewat kamera. Pustaka @zxing/browser diimpor dinamis supaya
 * tidak ikut diunduh petugas yang memakai scanner USB — pustakanya cukup besar
 * dan sebagian besar sesi tidak pernah membuka kamera.
 *
 * Butuh HTTPS. Di localhost tetap jalan; di jaringan lokal tanpa HTTPS, browser
 * akan menolak izin kamera.
 */

type Arah = "belakang" | "depan";

type RentangZoom = { min: number; max: number; langkah: number; nilai: number };

/**
 * Membaca kemampuan perbesaran kamera, kalau ada.
 *
 * zoom belum masuk tipe standar TypeScript walau sudah lama didukung Chrome di
 * Android. Perangkat yang tidak mendukungnya cukup mengembalikan null, dan
 * pengaturnya tidak ditampilkan sama sekali — lebih baik tidak ada daripada ada
 * tapi tidak melakukan apa-apa.
 */
function bacaZoom(track: MediaStreamTrack): RentangZoom | null {
  const kemampuan = track.getCapabilities?.() as
    | { zoom?: { min: number; max: number; step?: number } }
    | undefined;

  const rentang = kemampuan?.zoom;
  if (!rentang || rentang.max <= rentang.min) return null;

  const setelan = track.getSettings() as { zoom?: number };

  return {
    min: rentang.min,
    max: rentang.max,
    langkah: rentang.step && rentang.step > 0 ? rentang.step : 0.1,
    nilai: setelan.zoom ?? rentang.min,
  };
}

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
  const video: MediaTrackConstraints = {
    facingMode: { ideal: arah === "belakang" ? "environment" : "user" },

    // Resolusi diminta setinggi mungkin, dan ini bukan soal ketajaman gambar.
    // Code 128 memuat puluhan garis tipis berdampingan. Pada resolusi bawaan
    // yang sering hanya 640×480, tiap garis cuma kebagian beberapa piksel dan
    // batas antar-garis melebur — barcode-nya terlihat jelas oleh mata tapi
    // tidak akan pernah terbaca mesin. Peramban menurunkan sendiri kalau
    // perangkatnya tidak sanggup.
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };

  // focusMode belum masuk tipe standar TypeScript, padahal justru inilah yang
  // membuat kamera ponsel mau memfokus ulang pada stiker jarak dekat. Nilai di
  // dalam "advanced" diabaikan diam-diam kalau perangkatnya tidak mendukung,
  // jadi aman diminta.
  (video as { advanced?: unknown[] }).advanced = [{ focusMode: "continuous" }];

  return { video };
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
  const pembacaRef = useRef<BrowserMultiFormatReader | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);
  const [gagalAmbil, setGagalAmbil] = useState(false);
  const [zoom, setZoom] = useState<RentangZoom | null>(null);

  /**
   * Mengubah perbesaran kamera.
   *
   * Ini perbesaran sungguhan pada sensor, bukan gambar yang dibesarkan setelah
   * diambil — barcode benar-benar mendapat lebih banyak piksel. Itulah kenapa
   * ia menolong dari jarak yang sebelumnya gagal, sementara memperbesar gambar
   * hasil jepretan tidak menolong sama sekali.
   *
   * Perangkat berhak menolak nilainya; kalau ditolak, kameranya tetap jalan
   * pada perbesaran sebelumnya dan tidak ada yang perlu dilaporkan.
   */
  async function ubahZoom(nilai: number) {
    const track = trackRef.current;
    if (!track) return;

    try {
      // zoom belum ada di tipe MediaTrackConstraintSet, jadi lewat unknown.
      await track.applyConstraints({
        advanced: [{ zoom: nilai }],
      } as unknown as MediaTrackConstraints);
      setZoom((sebelum) => (sebelum ? { ...sebelum, nilai } : sebelum));
    } catch {
      // Perbesaran ditolak perangkat. Bukan kerusakan.
    }
  }

  /**
   * Membaca barcode dari bingkai yang sedang tampil, atas permintaan petugas.
   *
   * Pemindaian otomatis tetap berjalan di belakang dan biasanya lebih dulu
   * menemukan. Tombol ini ada karena pemindaian yang belum berhasil terlihat
   * persis seperti aplikasi yang menggantung: tidak ada yang bergerak, tidak ada
   * yang bisa ditekan. Menekan sesuatu dan mendapat jawaban — walau jawabannya
   * "belum terbaca" — jauh lebih baik daripada menunggu tanpa tanda.
   */
  function ambilSekarang() {
    const video = videoRef.current;
    const pembaca = pembacaRef.current;

    // videoWidth masih nol sampai bingkai pertama tiba.
    if (!video || !pembaca || !video.videoWidth) return;

    setGagalAmbil(false);

    const lebar = video.videoWidth;
    const tinggi = video.videoHeight;

    /*
      Dicoba beberapa potongan, dari seluruh bingkai lalu makin mengecil ke
      tengah.

      Barcode kecil di tengah bingkai besar lebih sulit dibaca daripada barcode
      yang sama tapi memenuhi gambar — bukan karena pikselnya berkurang, tapi
      karena pembaca menyapu baris merata ke seluruh tinggi gambar dan sebagian
      besar sapuan itu jatuh di lantai, tangan, atau sepeda. Memotong ke pita
      tengah membuat hampir semua sapuan mengenai barcode-nya.

      Inilah yang selama ini dikerjakan tangan dengan mendekatkan kamera.
    */
    const potongan = [
      { x: 0, y: 0, w: lebar, h: tinggi },
      { x: lebar * 0.1, y: tinggi * 0.3, w: lebar * 0.8, h: tinggi * 0.4 },
      { x: lebar * 0.25, y: tinggi * 0.35, w: lebar * 0.5, h: tinggi * 0.3 },
    ];

    const kanvas = document.createElement("canvas");
    const konteks = kanvas.getContext("2d");
    if (!konteks) return;

    for (const { x, y, w, h } of potongan) {
      kanvas.width = Math.round(w);
      kanvas.height = Math.round(h);
      konteks.drawImage(video, x, y, w, h, 0, 0, kanvas.width, kanvas.height);

      try {
        const hasil = pembaca.decodeFromCanvas(kanvas);
        onHasil(hasil.getText());
        return;
      } catch {
        // Potongan ini tidak memuat barcode yang terbaca. Lanjut ke berikutnya.
      }
    }

    // Tidak menemukan apa pun adalah keadaan yang lumrah saat kamera masih
    // terlalu jauh, bukan kerusakan, jadi tidak dicatat sebagai galat.
    setGagalAmbil(true);
  }

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let stream: MediaStream | undefined;
    let dibatalkan = false;

    /** Melepas kamera. Lampu indikator di perangkat baru padam setelah ini. */
    function lepaskan() {
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;

      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
    }

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
        // Keduanya diimpor dinamis. @zxing/library adalah bagian terbesarnya;
        // mengimpornya secara statis hanya untuk dua konstanta akan menariknya
        // ke bundel utama dan membebani petugas yang tidak pernah buka kamera.
        // DecodeHintType diberi nama lain supaya tidak menutupi impor tipenya
        // di atas, yang masih dibutuhkan untuk menyebut tipe Map di bawah.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType: Petunjuk }] =
          await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (dibatalkan) return;

        // Stream diminta dan dilepas sendiri, tidak diserahkan ke pustaka.
        //
        // decodeFromConstraints memeriksa apakah kamera punya senter, lalu
        // mematikannya lewat applyConstraints saat pemindaian berhenti. Pada
        // banyak ponsel Chrome menolak permintaan itu dengan "setPhotoOptions
        // failed", dan galatnya muncul sebagai galat runtime yang tidak bisa
        // kita tangkap karena terjadi di dalam pustaka.
        //
        // Senter tidak dipakai aplikasi ini sama sekali, jadi jalur itu memang
        // tidak perlu dilewati. decodeFromVideoElement hanya memindai bingkai
        // dari elemen video dan tidak menyentuh kemampuan perangkat.
        stream = await navigator.mediaDevices.getUserMedia(batasan(arah));
        if (dibatalkan) {
          lepaskan();
          return;
        }

        const video = videoRef.current;
        if (!video) {
          lepaskan();
          return;
        }

        video.srcObject = stream;

        const track = stream.getVideoTracks()[0];
        if (track) {
          trackRef.current = track;
          setZoom(bacaZoom(track));
        }

        /*
          Pemindai diberi tahu apa yang dicari, bukan dibiarkan menebak.

          Tanpa petunjuk, pembaca mencoba semua format yang ia kenal — QR,
          Data Matrix, PDF417, belasan jenis barcode garis — pada setiap
          bingkai. Waktu yang seharusnya dipakai memeriksa lebih banyak baris
          pada barcode yang benar justru habis untuk format yang tidak pernah
          dicetak aplikasi ini.

          Stiker yang dicetak selalu Code 128 (lihat halaman cetak barcode).
          Code 39 ikut disebut supaya stiker lama buatan alat lain tetap
          terbaca, tanpa membuka pintu terlalu lebar.

          TRY_HARDER menyuruh pembaca memeriksa lebih teliti: lebih banyak
          baris, dan gambar yang dibalik. Lebih lambat per bingkai, tapi
          barcode yang agak miring atau kurang tajam jadi terbaca — dan barcode
          di stiker sepeda jarang tegak lurus sempurna.
        */
        const petunjuk = new Map<DecodeHintType, unknown>([
          [Petunjuk.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]],
          [Petunjuk.TRY_HARDER, true],
        ]);

        const pembaca = new BrowserMultiFormatReader(petunjuk);
        // Disimpan supaya tombol ambil bisa memakai pembaca yang sama, bukan
        // membuat instance baru setiap kali ditekan.
        pembacaRef.current = pembaca;

        controls = await pembaca.decodeFromVideoElement(video, (hasil) => {
          if (!hasil) return;
          lepaskan();
          onHasil(hasil.getText());
        });

        if (dibatalkan) {
          lepaskan();
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
      lepaskan();
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
      ) : gagalAmbil ? (
        <p role="status" className="text-sm text-warn">
          Barcode belum terbaca.{" "}
          {zoom
            ? "Naikkan perbesaran di bawah, atau dekatkan kamera"
            : "Dekatkan kamera"}{" "}
          sampai stikernya memenuhi kotak — sisakan sedikit ruang putih di kiri dan
          kanannya. Pastikan cukup terang, lalu ambil lagi.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Arahkan ke barcode dan tunggu — biasanya terbaca sendiri. Kalau tidak,
          tekan Ambil barcode. Memakai kamera{" "}
          {arah === "belakang" ? "belakang" : "depan"}.
        </p>
      )}

      {siap && zoom && (
        <div className="space-y-1.5">
          <label
            htmlFor="zoom-kamera"
            className="flex items-center justify-between text-sm text-ink-muted"
          >
            <span>Perbesaran</span>
            <span className="font-medium text-ink">{zoom.nilai.toFixed(1)}×</span>
          </label>
          <input
            id="zoom-kamera"
            type="range"
            min={zoom.min}
            max={zoom.max}
            step={zoom.langkah}
            value={zoom.nilai}
            onChange={(e) => void ubahZoom(Number(e.target.value))}
            className="h-11 w-full accent-brand"
          />
        </div>
      )}

      {siap && (
        <Button penuh ukuran="lg" ikon={Ikon.scan} onClick={ambilSekarang}>
          Ambil barcode
        </Button>
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

"use client";

import { useEffect, useRef, useState } from "react";
// Tipe saja — dihapus saat kompilasi, jadi pustakanya tetap hanya diunduh
// ketika kamera benar-benar dibuka.
import type { BrowserMultiFormatReader } from "@zxing/browser";
import type { DecodeHintType } from "@zxing/library";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Ikon } from "@/components/ui/icons";
import { JANGKAUAN } from "@/lib/scan/jangkauan";

/**
 * Pemindai QR lewat kamera. Pustaka @zxing/browser diimpor dinamis supaya
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
 * Kalau perangkatnya tidak disebut, peramban memberi yang pertama ditemukannya —
 * di ponsel hampir selalu kamera depan. Kamera terbuka dan terlihat normal, tapi
 * yang tersorot wajah petugas, bukan stiker di sepeda.
 *
 * "ideal", bukan "exact": perangkat berkamera tunggal tetap boleh memakainya
 * daripada gagal total.
 */
function batasan(arah: Arah): MediaStreamConstraints {
  const video: MediaTrackConstraints = {
    facingMode: { ideal: arah === "belakang" ? "environment" : "user" },

    // Resolusi diminta setinggi mungkin, dan ini bukan soal ketajaman gambar.
    // QR memuat matriks modul kecil-kecil; pada resolusi bawaan yang sering
    // hanya 640×480, stiker yang dilihat dari jarak sedang menyisakan satu-dua
    // piksel per modul dan batas antar-modul melebur — QR-nya terlihat jelas
    // oleh mata tapi tidak akan pernah terbaca mesin.
    //
    // Perbandingan 16:9 juga yang diandaikan oleh angka di lib/scan/jangkauan.ts
    // saat menghitung potongan yang mendekati persegi.
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };

  // focusMode belum masuk tipe standar TypeScript, padahal justru inilah yang
  // membuat kamera ponsel mau memfokus ulang pada stiker jarak dekat. Nilai di
  // dalam "advanced" diabaikan diam-diam kalau perangkatnya tidak mendukung.
  (video as { advanced?: unknown[] }).advanced = [{ focusMode: "continuous" }];

  return { video };
}

/** Jeda antar-putaran. Cukup rapat untuk terasa langsung, cukup longgar
 *  supaya ponsel kelas menengah tidak panas dan bingkainya tidak tersendat.
 *  Satu jangkauan dibaca per putaran, jadi ketiganya terlewati di bawah
 *  setengah detik. */
const JEDA_MS = 150;

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
  const kanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);
  const [gagalAmbil, setGagalAmbil] = useState(false);

  /**
   * Membaca satu jangkauan dari bingkai yang sedang tampil.
   *
   * Mengembalikan kodenya kalau ketemu, null kalau tidak. Tidak ketemu adalah
   * keadaan yang lumrah — itu yang terjadi pada hampir semua putaran — jadi
   * tidak diperlakukan sebagai galat.
   */
  function bacaJangkauan(indeks: number): string | null {
    const video = videoRef.current;
    const pembaca = pembacaRef.current;

    // videoWidth masih nol sampai bingkai pertama tiba.
    if (!video || !pembaca || !video.videoWidth) return null;

    // Satu kanvas dipakai ulang. Membuat kanvas baru tiap putaran membebani
    // pengumpul sampah beberapa kali per detik tanpa alasan.
    const kanvas = (kanvasRef.current ??= document.createElement("canvas"));
    const konteks = kanvas.getContext("2d", { willReadFrequently: true });
    if (!konteks) return null;

    const bagian = JANGKAUAN[indeks % JANGKAUAN.length];
    const sx = video.videoWidth * bagian.x;
    const sy = video.videoHeight * bagian.y;
    const sw = video.videoWidth * bagian.w;
    const sh = video.videoHeight * bagian.h;

    kanvas.width = Math.round(sw);
    kanvas.height = Math.round(sh);
    konteks.drawImage(video, sx, sy, sw, sh, 0, 0, kanvas.width, kanvas.height);

    try {
      return pembaca.decodeFromCanvas(kanvas).getText();
    } catch {
      return null;
    }
  }

  /**
   * Membaca semua jangkauan sekaligus, atas permintaan petugas.
   *
   * Pemindaian otomatis mencoba satu jangkauan per putaran dan biasanya lebih
   * dulu menemukan. Tombol ini ada karena pemindaian yang belum berhasil
   * terlihat persis seperti aplikasi yang menggantung — dan menekan sesuatu
   * lalu mendapat jawaban, walau jawabannya "belum terbaca", jauh lebih berguna
   * daripada menunggu tanpa tanda.
   */
  function ambilSekarang() {
    setGagalAmbil(false);

    for (let i = 0; i < JANGKAUAN.length; i += 1) {
      const kode = bacaJangkauan(i);
      if (kode) {
        onHasil(kode);
        return;
      }
    }

    setGagalAmbil(true);
  }

  useEffect(() => {
    let stream: MediaStream | undefined;
    let jeda: number | undefined;
    let dibatalkan = false;

    /** Melepas kamera. Lampu indikator di perangkat baru padam setelah ini. */
    function lepaskan() {
      if (jeda !== undefined) window.clearTimeout(jeda);
      jeda = undefined;

      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;

      const video = videoRef.current;
      if (video) video.srcObject = null;
    }

    async function mulai() {
      // Peramban menolak kamera di alamat yang tidak aman, dan penolakannya
      // muncul sebagai galat yang membingungkan. Diperiksa lebih dulu supaya
      // pesannya menyebut sebab yang sebenarnya: alamatnya, bukan kameranya.
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
        //
        // DecodeHintType diberi nama lain supaya tidak menutupi impor tipenya
        // di atas, yang masih dibutuhkan untuk menyebut tipe Map di bawah.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType: Petunjuk }] =
          await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (dibatalkan) return;

        // Stream dikelola sendiri, tidak diserahkan ke pustaka. Jalur
        // decodeFromStream miliknya memeriksa senter lalu mematikannya lewat
        // applyConstraints saat berhenti, dan Chrome menolak permintaan itu di
        // banyak ponsel dengan "setPhotoOptions failed" — galat yang terjadi di
        // dalam pustaka sehingga tidak bisa ditangkap dari sini.
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
        await video.play();
        if (dibatalkan) {
          lepaskan();
          return;
        }

        /*
          Pemindai diberi tahu apa yang dicari, bukan dibiarkan menebak.

          Tanpa petunjuk ia mencoba semua format yang ia kenal — Data Matrix,
          PDF417, belasan barcode garis — pada setiap bingkai. Waktu yang
          seharusnya dipakai memeriksa QR habis untuk format yang tidak pernah
          dicetak aplikasi ini.

          Hanya QR yang disebut. Stiker Code 128 lama sengaja tidak lagi
          diterima: selama keduanya terbaca, stiker lama yang belum diganti
          tetap bekerja diam-diam, dan tidak akan pernah ada yang tahu mana
          sepeda yang stikernya masih ketinggalan. Menolaknya membuat sisa
          pekerjaan itu terlihat pada hari pertama, bukan berbulan kemudian.

          TRY_HARDER menyuruh pembaca memeriksa lebih teliti, termasuk gambar
          yang dibalik.
        */
        const petunjuk = new Map<DecodeHintType, unknown>([
          [Petunjuk.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
          [Petunjuk.TRY_HARDER, true],
        ]);

        pembacaRef.current = new BrowserMultiFormatReader(petunjuk);
        setSiap(true);

        // Putaran pemindaian: satu jangkauan per putaran, bergantian. Memakai
        // setTimeout berantai, bukan setInterval, supaya putaran berikutnya
        // baru dijadwalkan setelah yang sekarang benar-benar selesai — pada
        // ponsel yang lambat, setInterval akan menumpuk pekerjaan.
        let putaran = 0;

        function periksa() {
          if (dibatalkan) return;

          const kode = bacaJangkauan(putaran);
          putaran += 1;

          if (kode) {
            lepaskan();
            onHasil(kode);
            return;
          }

          jeda = window.setTimeout(periksa, JEDA_MS);
        }

        periksa();
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

        {/* Kotak bantu berbentuk persegi, mengikuti bentuk QR — kotak berupa
            pita lebar akan membuat orang mengarahkan HP terlalu jauh supaya
            stikernya "muat melebar", padahal yang menentukan justru tingginya.
            QR tidak wajib pas di dalamnya, karena seluruh bingkai juga tetap
            diperiksa bergantian. */}
        {siap && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-3/5 -translate-x-1/2 -translate-y-1/2 rounded-control border-2 border-white/70"
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
          QR belum terbaca. Sisakan sedikit ruang putih di sekeliling stiker,
          pastikan cukup terang, dan tahan agar tidak goyang sebentar.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Arahkan ke QR dan tunggu — biasanya terbaca sendiri. Kalau tidak, tekan
          Ambil QR. Memakai kamera {arah === "belakang" ? "belakang" : "depan"}.
        </p>
      )}

      {siap && (
        <Button penuh ukuran="lg" ikon={Ikon.scan} onClick={ambilSekarang}>
          Ambil QR
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

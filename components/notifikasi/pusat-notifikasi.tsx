"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ambilNotifikasi } from "@/lib/actions/notifikasi";
import type { NadaNotifikasi, Notifikasi } from "@/lib/notifikasi/susun";
import { Ikon } from "@/components/ui/icons";
import { TombolKontak } from "@/components/ui/tombol-kontak";
import { cn } from "@/lib/cn";

/**
 * Tumpukan popup di pojok layar.
 *
 * Sengaja TIDAK hilang sendiri. Petugas konter sering meninggalkan layar untuk
 * mengurus penyewa yang berdiri di depannya; notifikasi yang lenyap setelah
 * beberapa detik akan lewat begitu saja justru pada saat ia paling dibutuhkan.
 * Sebagai gantinya popup ini tidak pernah menghalangi apa pun — halaman di
 * belakangnya tetap bisa dipakai sepenuhnya.
 *
 * Yang sudah ditutup diingat di localStorage, bukan di database. Alasannya
 * bukan kepraktisan: tiap petugas perlu mengakui sendiri apa yang sudah ia
 * lihat. Kalau penutupan disimpan di server, petugas yang baru masuk shift
 * tidak akan pernah melihat notifikasi yang sudah ditutup rekannya.
 */

const KUNCI_SIMPANAN = "notifikasi-ditutup";
const JEDA_DETIK = 60;
/**
 * Banyaknya kartu yang boleh menumpuk sekaligus.
 *
 * Tanpa batas ini, hari yang ramai dengan sepuluh sepeda telat akan menutupi
 * seluruh layar dengan popup — dan halaman yang tidak bisa dipakai jauh lebih
 * merugikan daripada notifikasi yang tertunda. Sisanya diringkas jadi satu baris
 * yang menunjuk ke daftar, tempat semuanya memang sudah tercatat.
 */
const MAKS_TAMPIL = 3;
/** Catatan penutupan yang lebih tua dari ini dibuang supaya tidak menumpuk. */
const UMUR_CATATAN_JAM = 24;

type Ditutup = Record<string, number>;

// --- Simpanan penutupan -----------------------------------------------------
//
// Ditulis sebagai penyimpanan di luar React dan dibaca lewat useSyncExternalStore,
// bukan disalin ke useState lewat efek. localStorage memang bukan milik React:
// ia sudah ada sebelum komponen hidup, dan menyalinnya ke state hanya
// menciptakan dua sumber kebenaran yang bisa berselisih.

/** Harus satu objek tetap: React membandingkan hasil snapshot berdasar acuan. */
const KOSONG: Ditutup = {};

let cacheNilai: Ditutup = KOSONG;
let cacheMentah: string | null | undefined;
const pendengar = new Set<() => void>();

function urai(mentah: string | null): Ditutup {
  if (!mentah) return KOSONG;
  try {
    const isi = JSON.parse(mentah) as Ditutup;
    const batas = Date.now() - UMUR_CATATAN_JAM * 60 * 60 * 1000;
    // Dibersihkan saat dibaca, bukan lewat penjadwal tersendiri: kuncinya memuat
    // nomor rental yang tidak pernah dipakai ulang, jadi tanpa pembersihan
    // simpanan ini bertambah selamanya.
    return Object.fromEntries(Object.entries(isi).filter(([, waktu]) => waktu > batas));
  } catch {
    // Isi yang rusak diperlakukan seperti belum ada penutupan sama sekali.
    // Menampilkan ulang notifikasi jauh lebih aman daripada membisu.
    return KOSONG;
  }
}

/**
 * Cadangan di memori untuk peramban yang memblokir penyimpanan.
 *
 * Tanpa ini, tombol tutup mati total di jendela penyamaran atau ketika data
 * situs dimatikan: penutupannya gagal disimpan, pembacaan berikutnya
 * mengembalikan kosong, dan popupnya muncul lagi seketika. Tombol yang tidak
 * melakukan apa pun saat ditekan jauh lebih buruk daripada penutupan yang
 * hilang setelah halaman dimuat ulang.
 */
let cadanganMemori: Ditutup = KOSONG;
let simpananBisaDipakai = true;

function bacaSimpanan(): Ditutup {
  if (!simpananBisaDipakai) return cadanganMemori;

  let mentah: string | null = null;
  try {
    mentah = localStorage.getItem(KUNCI_SIMPANAN);
  } catch {
    simpananBisaDipakai = false;
    return cadanganMemori;
  }

  if (mentah !== cacheMentah) {
    cacheMentah = mentah;
    cacheNilai = urai(mentah);
  }
  return cacheNilai;
}

function berlangganan(pendengarBaru: () => void): () => void {
  pendengar.add(pendengarBaru);
  // Tab lain di komputer yang sama ikut memberi tahu lewat peristiwa storage,
  // sehingga menutup notifikasi di satu tab tidak menyisakannya di tab lain.
  const dariTabLain = () => {
    cacheMentah = undefined;
    pendengarBaru();
  };
  window.addEventListener("storage", dariTabLain);

  return () => {
    pendengar.delete(pendengarBaru);
    window.removeEventListener("storage", dariTabLain);
  };
}

/** Di server tidak ada localStorage; anggap belum ada yang pernah ditutup. */
function simpananServer(): Ditutup {
  return KOSONG;
}

function catatDitutup(kunci: string): void {
  const baru = { ...bacaSimpanan(), [kunci]: Date.now() };

  // Cadangan memori selalu diperbarui, bukan hanya saat penyimpanan gagal.
  // Dengan begitu ia sudah berisi keadaan terkini kalau penyimpanan mendadak
  // berhenti bekerja di tengah jalan.
  cadanganMemori = baru;

  if (simpananBisaDipakai) {
    try {
      localStorage.setItem(KUNCI_SIMPANAN, JSON.stringify(baru));
    } catch {
      simpananBisaDipakai = false;
    }
  }

  cacheMentah = undefined;
  pendengar.forEach((f) => f());
}

// --- Tampilan ---------------------------------------------------------------

const GAYA: Record<NadaNotifikasi, { kartu: string; titik: string; judul: string }> = {
  info: { kartu: "border-info/40", titik: "bg-info", judul: "text-info" },
  warn: { kartu: "border-warn/40", titik: "bg-warn", judul: "text-warn" },
  danger: { kartu: "border-danger/40", titik: "bg-danger", judul: "text-danger" },
};

export function PusatNotifikasi() {
  const [semua, setSemua] = useState<Notifikasi[]>([]);
  const ditutup = useSyncExternalStore(berlangganan, bacaSimpanan, simpananServer);

  useEffect(() => {
    let hidup = true;

    async function muat() {
      try {
        const hasil = await ambilNotifikasi();
        // Tanpa penjagaan ini, jawaban yang datang setelah komponen mati akan
        // memperbarui state yang sudah tidak ada.
        if (hidup) setSemua(hasil);
      } catch {
        // Jaringan konter kadang putus sebentar. Biarkan daftar lama tetap
        // tampil daripada mengosongkannya — popup yang berkedip hilang-muncul
        // lebih membingungkan daripada popup yang sedikit basi.
      }
    }

    void muat();

    // Berhenti memanggil server saat tab tidak terlihat, supaya HP petugas
    // tidak terus bekerja di dalam saku.
    const jeda = window.setInterval(() => {
      if (document.visibilityState === "visible") void muat();
    }, JEDA_DETIK * 1000);

    function saatTerlihat() {
      if (document.visibilityState === "visible") void muat();
    }

    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      hidup = false;
      window.clearInterval(jeda);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, []);

  const belumDitutup = semua.filter((n) => !(n.kunci in ditutup));

  // Sudah diurut dari yang paling genting di susunNotifikasi(), jadi yang
  // terpotong selalu yang paling ringan.
  const tampil = belumDitutup.slice(0, MAKS_TAMPIL);
  const sisa = belumDitutup.length - tampil.length;

  // Pembungkusnya SELALU ada di DOM, bahkan saat kosong. Pembaca layar hanya
  // mengumumkan perubahan pada wilayah live yang sudah diamatinya sejak awal;
  // wilayah yang baru muncul bersamaan dengan isinya membuat notifikasi pertama
  // — yang justru paling penting — lewat tanpa dibacakan sama sekali.
  return (
    <div
      // Diangkat di atas bilah navigasi bawah pada layar kecil, dan menempel di
      // pojok kanan pada layar besar.
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-end gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-0 lg:w-96"
      role="status"
      aria-live="polite"
    >
      {sisa > 0 && (
        <Link
          href="/scan"
          className="pointer-events-auto w-full max-w-sm rounded-card border border-line-strong bg-surface px-3.5 py-2.5 text-center text-xs font-medium text-ink-muted shadow-angkat transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {sisa} pemberitahuan lain — lihat daftarnya
        </Link>
      )}

      {tampil.map((n) => (
        <Kartu key={n.kunci} notifikasi={n} onTutup={() => catatDitutup(n.kunci)} />
      ))}
    </div>
  );
}

function Kartu({
  notifikasi: n,
  onTutup,
}: {
  notifikasi: Notifikasi;
  onTutup: () => void;
}) {
  const gaya = GAYA[n.nada];

  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-card border bg-surface p-3.5 shadow-angkat",
        gaya.kartu,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", gaya.titik)}
        />

        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", gaya.judul)}>{n.judul}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{n.keterangan}</p>
        </div>

        <button
          type="button"
          onClick={onTutup}
          aria-label={`Tutup notifikasi ${n.judul}`}
          className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Ikon.batal className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2.5 flex gap-2 pl-[1.125rem]">
        {/* Sengaja TIDAK ikut menutup notifikasinya. Tautan ini menuju halaman
            scan tanpa penanda pindai, jadi yang dibuka petugas cuma keterangan —
            rentalnya belum tentu bisa diselesaikan dari sana. Kalau notifikasinya
            ikut hilang, satu-satunya pengingat lenyap justru sebelum urusannya
            benar-benar tuntas. Ia hilang saat ditutup dengan sengaja, atau saat
            keadaannya memang sudah berubah. */}
        <Link
          href={n.href}
          className="flex min-h-9 flex-1 items-center justify-center rounded-control border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
        >
          Buka {n.kodeSepeda}
        </Link>
        {/* Ikon saja: kartunya sempit, dan tombol "Buka" yang perlu ruang. */}
        <TombolKontak
          noHp={n.noHpPenyewa}
          nama={n.namaPenyewa}
          pesan={n.pesanWa}
          ringkas
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { KomponenIkon } from "./icons";

/**
 * Tombol yang menanyakan dulu sebelum mengirim formulirnya.
 *
 * Dipakai hanya untuk tindakan yang sekali klik dan sulit dibatalkan. Tindakan
 * yang sudah menuntut pengetikan — pembatalan rental, pembatalan setoran,
 * pembatalan booking, semuanya wajib menulis alasan — sengaja TIDAK memakai ini:
 * mengetik alasan sudah menjadi konfirmasinya, dan menumpuk dua lapis membuat
 * orang menekan "Ya" tanpa membaca. Konfirmasi yang muncul di mana-mana berhenti
 * menjadi peringatan dan berubah jadi satu ketukan tambahan.
 *
 * Memakai elemen <dialog> bawaan peramban, bukan tiruan dari div: Escape,
 * kunci fokus, dan lapisan latar sudah benar tanpa dikerjakan ulang — dan hal
 * seperti kunci fokus paling sering terlewat pada tiruan.
 *
 * Tombol pengirimnya berada DI DALAM <dialog>, dan dialognya di dalam <form>,
 * sehingga penekanannya mengirim formulir yang sama seperti biasa. Server Action
 * di baliknya tidak perlu tahu apa pun soal dialog ini.
 */
export function KonfirmasiAksi({
  label,
  judul,
  keterangan,
  labelYa,
  labelSedang,
  variasi = "bahaya",
  ukuran = "md",
  penuh = false,
  ikon,
  pemicuAnak,
  pemicuKelas,
  pemicuLabel,
}: {
  /** Teks tombol yang terlihat di halaman. */
  label: string;
  /** Pertanyaannya. Sebut tindakannya, bukan "Apakah Anda yakin?" saja. */
  judul: string;
  /** Akibatnya kalau diteruskan. Inilah yang sebenarnya perlu dibaca. */
  keterangan: ReactNode;
  /** Teks tombol penegas. Sebut tindakannya, jangan cuma "Ya". */
  labelYa: string;
  labelSedang?: string;
  variasi?: "utama" | "bahaya" | "sukses" | "kedua";
  ukuran?: "sm" | "md" | "lg";
  penuh?: boolean;
  ikon?: KomponenIkon;
  /**
   * Isi tombol pemicu kalau bentuknya bukan tombol biasa — misalnya tombol ikon
   * di topbar. Yang boleh berbeda hanya tampilan tombolnya; perilaku dan isi
   * dialognya tetap milik komponen ini, supaya konfirmasi di seluruh aplikasi
   * berperilaku sama.
   */
  pemicuAnak?: ReactNode;
  /** Kelas untuk tombol pemicu kalau memakai pemicuAnak. */
  pemicuKelas?: string;
  /** Wajib kalau pemicuAnak hanya berupa ikon tanpa teks. */
  pemicuLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { pending } = useFormStatus();

  function buka() {
    dialogRef.current?.showModal();
  }

  return (
    <>
      {pemicuAnak ? (
        <button
          type="button"
          onClick={buka}
          disabled={pending}
          aria-label={pemicuLabel ?? label}
          title={pemicuLabel ?? label}
          className={pemicuKelas}
        >
          {pemicuAnak}
        </button>
      ) : (
        <Button
          type="button"
          variasi={variasi}
          ukuran={ukuran}
          penuh={penuh}
          ikon={ikon}
          disabled={pending}
          onClick={buka}
        >
          {pending ? (labelSedang ?? "Menyimpan…") : label}
        </Button>
      )}

      <dialog
        ref={dialogRef}
        // backdrop:bg-* mewarnai lapisan latar bawaan peramban. Tanpa itu,
        // latarnya memakai warna bawaan yang tidak mengikuti tema.
        className="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <div className="space-y-3 p-5">
          <h2 className="text-base font-semibold tracking-tight text-ink">{judul}</h2>
          <p className="text-sm leading-relaxed text-ink-muted">{keterangan}</p>

          <div className="flex gap-2 pt-1">
            {/* Batal lebih dulu dan bergaya netral. Tombol penegas yang berada
                di posisi paling mudah dijangkau justru menaikkan peluang salah
                tekan — dan itu yang seharusnya dicegah dialog ini. */}
            <Button
              type="button"
              variasi="kedua"
              className="flex-1"
              onClick={() => dialogRef.current?.close()}
            >
              Batal
            </Button>
            <Button type="submit" variasi={variasi} className="flex-1">
              {labelYa}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

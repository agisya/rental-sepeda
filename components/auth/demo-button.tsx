"use client";

import type { ComponentProps } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { masukDemo, type StatusMasuk } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { PesanGalat } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const AWAL: StatusMasuk = {};

/** Bentuknya menumpang tipe Button supaya tidak ada daftar ukuran kedua yang bisa basi. */
type Bentuk = Pick<ComponentProps<typeof Button>, "ukuran" | "penuh" | "variasi">;

function TombolCoba({ ukuran, penuh, variasi }: Bentuk) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variasi={variasi}
      ukuran={ukuran}
      penuh={penuh}
      disabled={pending}
    >
      {pending ? "Menyiapkan…" : "Coba demo"}
    </Button>
  );
}

/**
 * Jalan masuk sekali klik untuk yang sedang menilai aplikasi ini.
 *
 * Formulirnya kosong dengan sengaja: action-nya tidak membaca satu pun field, dan
 * akun yang dituju ditentukan variabel AKUN_DEMO di sisi server. Tidak ada yang
 * bisa diubah dari peramban.
 *
 * Tinggal di components/, bukan di folder rute, karena dipakai tiga tempat: nav
 * landing page yang ringkas, hero dan penutupnya yang besar, serta halaman login.
 * Semuanya wajib menyembunyikannya saat AKUN_DEMO tidak disetel — komponen ini
 * tidak memeriksa sendiri, sebab pemeriksaannya menyentuh env di sisi server
 * sementara komponen ini berjalan di peramban.
 *
 * Nilai bawaannya adalah bentuk yang dipakai halaman login sejak awal, jadi
 * pemanggilan tanpa prop menghasilkan tombol yang sama persis seperti dulu.
 */
export function DemoButton({ ukuran = "lg", penuh = true, variasi = "kedua" }: Bentuk = {}) {
  const [status, aksi] = useActionState(masukDemo, AWAL);

  return (
    <form action={aksi} className={cn("space-y-3", !penuh && "inline-block")}>
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      <TombolCoba ukuran={ukuran} penuh={penuh} variasi={variasi} />
    </form>
  );
}

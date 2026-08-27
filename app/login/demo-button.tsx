"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { masukDemo, type StatusMasuk } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { PesanGalat } from "@/components/ui/card";

const AWAL: StatusMasuk = {};

function TombolCoba() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variasi="kedua" ukuran="lg" penuh disabled={pending}>
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
 */
export function DemoButton() {
  const [status, aksi] = useActionState(masukDemo, AWAL);

  return (
    <form action={aksi} className="space-y-3">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}
      <TombolCoba />
    </form>
  );
}

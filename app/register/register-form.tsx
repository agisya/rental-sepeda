"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { daftarAdminPertama, type StatusAksi } from "@/lib/actions/pengguna";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";

const AWAL: StatusAksi = {};

function TombolBuat() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Membuat…" : "Buat akun admin"}
    </Button>
  );
}

export function RegisterForm() {
  const [status, aksi] = useActionState(daftarAdminPertama, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="nama" label="Nama lengkap" galat={status.galatField?.nama} wajib>
        {(props) => (
          <Input {...props} name="nama" autoComplete="name" autoFocus required />
        )}
      </Field>

      <Field
        id="username"
        label="Username"
        petunjuk="Huruf kecil, angka, titik, garis bawah, atau tanda hubung"
        galat={status.galatField?.username}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        )}
      </Field>

      <Field
        id="kataSandi"
        label="Kata sandi"
        petunjuk="Minimal 8 karakter"
        galat={status.galatField?.kataSandi}
        wajib
      >
        {(props) => (
          <Input
            {...props}
            name="kataSandi"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <Field id="ulangi" label="Ulangi kata sandi" galat={status.galatField?.ulangi} wajib>
        {(props) => (
          <Input
            {...props}
            name="ulangi"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <TombolBuat />
    </form>
  );
}

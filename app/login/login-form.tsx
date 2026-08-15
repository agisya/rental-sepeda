"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { masuk, type StatusMasuk } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";

const AWAL: StatusMasuk = {};

function TombolMasuk() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="lg" penuh disabled={pending}>
      {pending ? "Memeriksa…" : "Masuk"}
    </Button>
  );
}

export function LoginForm({ lanjut }: { lanjut?: string }) {
  const [status, aksi] = useActionState(masuk, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      {lanjut && <input type="hidden" name="lanjut" value={lanjut} />}

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="username" label="Username" galat={status.galatField?.username} wajib>
        {(props) => (
          <Input
            {...props}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
          />
        )}
      </Field>

      <Field id="kataSandi" label="Kata sandi" galat={status.galatField?.kataSandi} wajib>
        {(props) => (
          <Input
            {...props}
            name="kataSandi"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>

      <TombolMasuk />
    </form>
  );
}

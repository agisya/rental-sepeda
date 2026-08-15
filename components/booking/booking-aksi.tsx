"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  batalkanBooking,
  mulaiRentalDariBooking,
  type StatusAksi,
} from "@/lib/actions/booking";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PesanGalat } from "@/components/ui/card";
import { Ikon } from "@/components/ui/icons";

const AWAL: StatusAksi = {};

function TombolKirim({
  label,
  labelProses,
  variasi,
  ikon,
}: {
  label: string;
  labelProses: string;
  variasi: "sukses" | "bahaya";
  ikon?: typeof Ikon.sepeda;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variasi={variasi}
      ukuran="lg"
      penuh
      ikon={pending ? undefined : ikon}
      disabled={pending}
    >
      {pending ? labelProses : label}
    </Button>
  );
}

/** Menyerahkan sepeda ke penyewa: booking berubah menjadi rental berjalan. */
export function TombolJemput({ bookingId }: { bookingId: number }) {
  const [status, aksi] = useActionState(mulaiRentalDariBooking, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field
        id="jaminan"
        label="Jaminan"
        petunjuk="Contoh: KTP, SIM, kunci motor."
        galat={status.galatField?.jaminan}
      >
        {(props) => <Input {...props} name="jaminan" placeholder="KTP" />}
      </Field>

      <TombolKirim
        label="SERAHKAN SEPEDA"
        labelProses="Memproses…"
        variasi="sukses"
        ikon={Ikon.sepeda}
      />
    </form>
  );
}

/** Membatalkan booking dan melepaskan jam-jam yang sudah terkunci. */
export function FormBatalBooking({ bookingId }: { bookingId: number }) {
  const [status, aksi] = useActionState(batalkanBooking, AWAL);
  const [terbuka, setTerbuka] = useState(false);

  if (!terbuka) {
    return (
      <Button variasi="kedua" penuh onClick={() => setTerbuka(true)}>
        Batalkan booking
      </Button>
    );
  }

  return (
    <form action={aksi} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />

      {status.galat && <PesanGalat>{status.galat}</PesanGalat>}

      <Field id="alasan" label="Alasan pembatalan" galat={status.galatField?.alasan} wajib>
        {(props) => (
          <Input {...props} name="alasan" placeholder="Penyewa membatalkan" required />
        )}
      </Field>

      <div className="flex gap-2">
        <Button variasi="kedua" className="flex-1" onClick={() => setTerbuka(false)}>
          Urung
        </Button>
        <div className="flex-1">
          <TombolKirim
            label="Batalkan"
            labelProses="Membatalkan…"
            variasi="bahaya"
            ikon={Ikon.batal}
          />
        </div>
      </div>
    </form>
  );
}

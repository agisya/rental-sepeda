import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const gayaKontrol =
  "w-full rounded-control border border-line-strong bg-surface text-ink px-3.5 py-2.5 min-h-11 " +
  "text-base transition-colors placeholder:text-ink-faint hover:border-line-strong " +
  "disabled:opacity-60 disabled:bg-surface-2 aria-[invalid=true]:border-danger";

type PropsField = {
  /** Dipakai sebagai id kontrol sekaligus atribut for pada label. */
  id: string;
  label: string;
  petunjuk?: string;
  galat?: string | string[];
  wajib?: boolean;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: "true";
  }) => ReactNode;
};

/**
 * Membungkus satu kolom isian beserta label, petunjuk, dan pesan galatnya.
 *
 * Tidak memakai useId supaya komponen ini tetap bisa dipakai di Server Component;
 * id diberikan pemanggil dan biasanya sama dengan nama kolomnya.
 */
export function Field({ id, label, petunjuk, galat, wajib, children }: PropsField) {
  const idPetunjuk = petunjuk ? `${id}-petunjuk` : undefined;
  const pesanGalat = Array.isArray(galat) ? galat[0] : galat;
  const idGalat = pesanGalat ? `${id}-galat` : undefined;
  const describedBy = [idPetunjuk, idGalat].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {wajib && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {petunjuk && (
        <p id={idPetunjuk} className="text-xs text-ink-muted">
          {petunjuk}
        </p>
      )}

      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(pesanGalat ? { "aria-invalid": "true" as const } : {}),
      })}

      {pesanGalat && (
        <p id={idGalat} className="text-sm text-danger">
          {pesanGalat}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(gayaKontrol, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(gayaKontrol, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(gayaKontrol, "min-h-24 resize-y", className)} {...props} />;
}

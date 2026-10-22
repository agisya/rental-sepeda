import { cn } from "@/lib/cn";
import { Ikon } from "./icons";

const ukuranLambang = {
  sm: { kotak: "size-7", ikon: "size-4" },
  md: { kotak: "size-8", ikon: "size-[18px]" },
} as const;

/**
 * Lambang aplikasi: kotak hijau dengan ikon merek.
 *
 * Sebelumnya ditulis ulang di sidebar, topbar, kepala landing page, dan halaman
 * login — dengan empat ukuran kotak yang berbeda-beda. Satu komponen dengan dua
 * ukuran membuat merek terlihat sama di mana pun ia muncul.
 */
export function LambangMerek({
  ukuran = "md",
  className,
}: {
  ukuran?: keyof typeof ukuranLambang;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-control bg-brand text-brand-ink",
        ukuranLambang[ukuran].kotak,
        className,
      )}
      aria-hidden="true"
    >
      <Ikon.merek className={ukuranLambang[ukuran].ikon} strokeWidth={2} />
    </span>
  );
}

/** Lambang beserta nama aplikasi. */
export function Merek({
  namaDisembunyikanDiHp,
  className,
}: {
  /**
   * Untuk kepala yang di layar 320px harus berbagi tempat dengan beberapa
   * tombol. Namanya tetap terbaca pembaca layar.
   */
  namaDisembunyikanDiHp?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LambangMerek />
      <span
        className={cn(
          "font-display text-[0.9375rem] font-semibold tracking-tight text-ink",
          namaDisembunyikanDiHp && "sr-only sm:not-sr-only",
        )}
      >
        Rental Ku
      </span>
    </span>
  );
}

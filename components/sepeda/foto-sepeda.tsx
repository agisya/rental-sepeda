import { cn } from "@/lib/cn";
import { Ikon } from "@/components/ui/icons";

const UKURAN = {
  sm: { kotak: "size-10", ikon: "size-5" },
  md: { kotak: "size-14", ikon: "size-7" },
  lg: { kotak: "size-24", ikon: "size-10" },
} as const;

/**
 * Foto sepeda, atau ikon pengganti kalau belum ada fotonya.
 *
 * Gambar disajikan dari /api/sepeda/[id]/foto. Nomor versi ikut di alamat supaya
 * foto lama yang tersimpan di cache peramban tidak ikut tertampil setelah
 * fotonya diganti.
 *
 * Sengaja memakai <img> biasa, bukan next/image: sumbernya adalah rute milik
 * aplikasi sendiri yang sudah menyajikan ukuran apa adanya, sehingga tidak ada
 * yang bisa dioptimalkan lagi oleh pengoptimal gambar.
 */
export function FotoSepeda({
  bikeId,
  punyaFoto,
  fotoUrl,
  fotoVersi,
  nama,
  ukuran = "sm",
  className,
}: {
  bikeId: number;
  punyaFoto: boolean;
  fotoUrl?: string | null;
  fotoVersi?: number;
  nama: string;
  ukuran?: keyof typeof UKURAN;
  className?: string;
}) {
  const gaya = UKURAN[ukuran];
  const sumber = punyaFoto
    ? `/api/sepeda/${bikeId}/foto?v=${fotoVersi ?? 0}`
    : (fotoUrl ?? null);

  if (!sumber) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-faint",
          gaya.kotak,
          className,
        )}
        aria-hidden="true"
      >
        <Ikon.sepeda className={gaya.ikon} strokeWidth={1.7} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sumber}
      alt={`Foto ${nama}`}
      loading="lazy"
      decoding="async"
      className={cn(
        "shrink-0 rounded-control border border-line bg-surface-2 object-cover",
        gaya.kotak,
        className,
      )}
    />
  );
}

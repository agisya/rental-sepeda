import { tautanWa } from "@/lib/kontak";
import { BarisData } from "@/components/ui/card";
import { IkonWhatsApp } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Tombol menghubungi penyewa atau pemilik lewat WhatsApp.
 *
 * Hanya WhatsApp, tanpa tombol telepon. Di lapangan hampir semua percakapan
 * dengan penyewa memang lewat WhatsApp, dan dua tombol berdampingan di tiap
 * baris daftar membuat halaman terlihat penuh tanpa menambah kegunaan.
 *
 * Nomornya tetap ditampilkan sebagai teks di dekat tombol ini, jadi yang perlu
 * menelepon masih bisa menyalin atau membacakannya.
 *
 * Tombolnya hilang sendiri kalau nomornya tidak mungkin punya WhatsApp —
 * nomor telepon rumah, atau isi kolom yang bukan nomor sama sekali di data
 * lama. Lihat nomorWa() di lib/kontak.ts.
 */
export function TombolKontak({
  noHp,
  nama,
  pesan,
  ringkas,
  className,
}: {
  noHp: string;
  /** Dipakai pada label bantu supaya pembaca layar menyebut siapa yang dihubungi. */
  nama: string;
  /** Kalimat yang sudah terketik saat percakapan dibuka. */
  pesan?: string;
  /** Ikon saja, untuk baris daftar dan kartu notifikasi yang ruangnya sempit. */
  ringkas?: boolean;
  className?: string;
}) {
  const wa = tautanWa(noHp, pesan);
  if (!wa) return null;

  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat ${nama} lewat WhatsApp`}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface text-xs font-medium text-ink transition-colors hover:bg-surface-2",
        ringkas ? "w-9" : "px-3",
        className,
      )}
    >
      {/* Warna khas WhatsApp hanya pada lambangnya, bukan seluruh tombol.
          Tombol hijau penuh akan bertabrakan dengan hijau merek aplikasi ini
          dan membuat halaman terlihat ramai; lambang berwarna sudah cukup
          untuk dikenali seketika. */}
      <IkonWhatsApp className="size-4 shrink-0 text-[#25D366]" />
      {!ringkas && "WhatsApp"}
    </a>
  );
}

/**
 * Baris "No. HP" pada kartu rincian: nomornya tetap terbaca, tombolnya di
 * bawahnya.
 *
 * Nomornya sengaja masih ditampilkan sebagai teks. Petugas kadang perlu
 * membacakannya ke orang lain, menyalinnya, atau meneleponnya dari ponsel
 * sendiri — dan nomor yang hanya hidup di dalam tautan tidak bisa dipakai
 * untuk itu.
 */
export function BarisKontak({
  label = "No. HP",
  noHp,
  nama,
  pesan,
}: {
  label?: string;
  noHp: string;
  nama: string;
  pesan?: string;
}) {
  return (
    <BarisData label={label}>
      <div className="flex flex-col items-end gap-2">
        <span className="tabular-nums">{noHp}</span>
        <TombolKontak noHp={noHp} nama={nama} pesan={pesan} />
      </div>
    </BarisData>
  );
}

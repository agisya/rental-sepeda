import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { WARNA_BILAH } from "@/lib/tema";
import { SkripTema } from "@/components/ui/skrip-tema";
import "./globals.css";

/**
 * Tiga peran huruf, bukan satu.
 *
 * Dashboard ini dibaca dengan dua cara yang berbeda: judul dan angka besar
 * dilirik sekilas, sedangkan tabel dibaca lama dan teliti. Satu huruf untuk
 * keduanya selalu berkompromi. Jadi yang dilirik memakai huruf berkarakter,
 * yang dibaca lama memakai huruf yang paling tidak melelahkan.
 */

/* Judul, label, dan angka besar. Huruf buatan Tokotype, punya bentuk yang
   lebih berkarakter daripada Inter tanpa jadi kurang formal. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

/* Badan halaman: tabel padat, form, dan menu samping. Dipilih justru karena
   netral — huruf yang tidak menarik perhatian ke dirinya sendiri. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* Kode sepeda. Nolnya bertitik, sehingga SPD-004 tidak pernah terbaca
   SPD-OO4 saat petugas mengetik ulang dari stiker yang tercetak. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Rental Ku",
    template: "%s · Rental Ku",
  },
  description:
    "Pencatatan rental per jam atau per hari, bagi hasil pemilik, dan laporan harian.",
};

export const viewport: Viewport = {
  // Satu warna, bukan sepasang yang mengikuti prefers-color-scheme: halaman ini
  // tidak mengikuti setelan perangkat sama sekali. Bawaannya terang; bagi yang
  // memilih gelap, skrip tema dan tombol tema yang menggantinya.
  themeColor: WARNA_BILAH.terang,
  // Zoom tidak dikunci: petugas harus tetap bisa memperbesar teks.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // Skrip di bawah mengubah atribut elemen ini sebelum React sempat
      // membandingkannya dengan hasil server. Tanpa penanda ini, React
      // melaporkan ketidakcocokan yang sebenarnya memang disengaja.
      suppressHydrationWarning
    >
      <head>
        <SkripTema />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

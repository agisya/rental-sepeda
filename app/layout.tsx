import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Rental Sepeda Garut",
    template: "%s · Rental Sepeda Garut",
  },
  description:
    "Pencatatan rental sepeda per jam, bagi hasil pemilik, dan laporan harian.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f0c" },
  ],
  // Zoom tidak dikunci: petugas harus tetap bisa memperbesar teks.
  width: "device-width",
  initialScale: 1,
};

/**
 * Menerapkan tema pilihan sebelum halaman digambar.
 *
 * Harus berjalan lebih dulu daripada React, karena kalau tidak, halaman sempat
 * tampil terang sekejap lalu berubah gelap. Kedipan itu paling terasa justru
 * bagi orang yang memilih gelap karena silau.
 *
 * Sengaja sekecil mungkin dan dibungkus try: peramban dengan penyimpanan
 * diblokir cukup mengabaikannya dan mengikuti setelan sistem.
 */
const SKRIP_TEMA = `try{var t=localStorage.getItem("tema");if(t==="gelap")document.documentElement.dataset.theme="dark";else if(t==="terang")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // Skrip di bawah mengubah atribut elemen ini sebelum React sempat
      // membandingkannya dengan hasil server. Tanpa penanda ini, React
      // melaporkan ketidakcocokan yang sebenarnya memang disengaja.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

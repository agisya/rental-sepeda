/**
 * Satu-satunya tempat ikon aplikasi didefinisikan.
 *
 * Sebelumnya dipakai emoji. Emoji digambar berbeda-beda oleh tiap sistem operasi,
 * warnanya tidak bisa diselaraskan dengan tema, dan ketebalannya tidak konsisten —
 * hasilnya terlihat tidak rapi. Ikon garis di bawah ini memakai grid dan ketebalan
 * yang sama serta mengikuti warna teks induknya.
 *
 * Mengganti seluruh ikon aplikasi cukup dilakukan di berkas ini.
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  Bike,
  CalendarDays,
  Camera,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  CircleQuestionMark,
  Clock,
  Database,
  FileText,
  ImagePlus,
  Landmark,
  LayoutDashboard,
  LogOut,
  Palette,
  Phone,
  Plus,
  Printer,
  Receipt,
  ScanLine,
  Search,
  Settings2,
  SquareUserRound,
  Tag,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

export type KomponenIkon = LucideIcon;

export const Ikon = {
  dashboard: LayoutDashboard,
  scan: ScanLine,
  kamera: Camera,
  sepeda: Bike,
  pemilik: SquareUserRound,
  penyewa: Users,
  transaksi: Receipt,
  laporan: ChartColumn,
  laporanNaik: TrendingUp,
  pengeluaran: TrendingDown,
  labaRugi: FileText,
  juara: Trophy,
  fotoTambah: ImagePlus,
  pengaturan: Settings2,
  uang: Wallet,
  jam: Clock,
  booking: CalendarDays,
  servis: Wrench,
  nonaktif: Ban,
  selesai: BadgeCheck,
  peringatan: TriangleAlert,
  tidakDitemukan: CircleQuestionMark,
  cari: Search,
  telepon: Phone,
  cetak: Printer,
  label: Tag,
  tambah: Plus,
  keluar: LogOut,
  batal: X,
  lanjut: ChevronRight,
  data: Database,
  arsip: ClipboardList,
  keuangan: Landmark,
  tampilan: Palette,
} as const satisfies Record<string, LucideIcon>;

export type NamaIkon = keyof typeof Ikon;

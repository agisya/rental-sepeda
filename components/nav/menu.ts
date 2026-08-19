import type { Peran } from "@/lib/db/schema";
import { Ikon, type NamaIkon } from "@/components/ui/icons";

export type ItemMenu = {
  href: string;
  label: string;
  labelPendek: string;
  ikon: NamaIkon;
  /** Kosong berarti semua peran boleh melihatnya. */
  peran?: Peran[];
};

export type KelompokMenu = {
  judul: string;
  ikon: NamaIkon;
  /**
   * Kelompok yang tidak pernah dilipat.
   *
   * Menu operasional dibuka berkali-kali dalam satu jam. Menaruhnya di balik
   * satu ketukan tambahan membuat pekerjaan yang paling sering justru yang
   * paling jauh dijangkau.
   */
  selaluTampil?: boolean;
  item: ItemMenu[];
};

/** Menu yang hanya untuk admin dan owner, bukan kasir. */
const PENGELOLA: Peran[] = ["admin", "owner"];

/**
 * Menu dikelompokkan menurut cara pemakaiannya, bukan sekadar daftar panjang:
 * yang dipakai tiap menit di atas, data induk di tengah, laporan dan keuangan
 * di bawah.
 */
export const KELOMPOK_MENU: KelompokMenu[] = [
  {
    judul: "Operasional",
    ikon: "dashboard",
    selaluTampil: true,
    item: [
      { href: "/dashboard", label: "Dashboard", labelPendek: "Beranda", ikon: "dashboard" },
      { href: "/scan", label: "Scan Barcode", labelPendek: "Scan", ikon: "scan" },
      { href: "/booking", label: "Booking", labelPendek: "Booking", ikon: "booking" },
      { href: "/transaksi", label: "Transaksi", labelPendek: "Transaksi", ikon: "transaksi" },
    ],
  },
  {
    judul: "Data",
    ikon: "data",
    item: [
      { href: "/sepeda", label: "Data Sepeda", labelPendek: "Sepeda", ikon: "sepeda" },
      { href: "/pemilik", label: "Data Pemilik", labelPendek: "Pemilik", ikon: "pemilik" },
      { href: "/penyewa", label: "Data Penyewa", labelPendek: "Penyewa", ikon: "penyewa" },
      {
        href: "/maintenance",
        label: "Maintenance",
        labelPendek: "Servis",
        ikon: "servis",
      },
    ],
  },
  {
    judul: "Laporan",
    ikon: "arsip",
    item: [
      {
        href: "/laporan/harian",
        label: "Laporan Harian",
        labelPendek: "Harian",
        ikon: "laporan",
      },
      {
        href: "/laporan/mingguan",
        label: "Laporan Mingguan",
        labelPendek: "Mingguan",
        ikon: "laporanNaik",
      },
      {
        href: "/laporan/bulanan",
        label: "Laporan Bulanan",
        labelPendek: "Bulanan",
        ikon: "booking",
      },
      {
        href: "/laporan/pemilik",
        label: "Laporan Pemilik",
        labelPendek: "Pemilik",
        ikon: "uang",
      },
    ],
  },
  {
    judul: "Keuangan",
    ikon: "keuangan",
    item: [
      // Tanpa batasan peran: kasir justru yang paling sering membukanya, karena
      // dialah yang memegang uangnya dan yang harus menutup toko tiap hari.
      { href: "/kas", label: "Tutup Toko", labelPendek: "Tutup", ikon: "uang" },
      {
        href: "/pengeluaran",
        label: "Pengeluaran",
        labelPendek: "Keluar",
        ikon: "pengeluaran",
        peran: PENGELOLA,
      },
      {
        href: "/laba-rugi",
        label: "Laba Rugi",
        labelPendek: "Laba",
        ikon: "labaRugi",
        peran: PENGELOLA,
      },
    ],
  },
  {
    judul: "Lainnya",
    ikon: "pengaturan",
    item: [
      {
        href: "/pengaturan",
        label: "Pengaturan",
        labelPendek: "Atur",
        ikon: "pengaturan",
      },
    ],
  },
];

export const MENU: ItemMenu[] = KELOMPOK_MENU.flatMap((k) => k.item);

/** Lima menu yang muncul di bilah bawah pada layar HP. */
const URUTAN_BAWAH = ["/dashboard", "/scan", "/booking", "/transaksi", "/laporan/harian"];

export const MENU_BAWAH: ItemMenu[] = URUTAN_BAWAH.map(
  (href) => MENU.find((m) => m.href === href)!,
).filter(Boolean);

export function ikonMenu(item: ItemMenu) {
  return Ikon[item.ikon];
}

export function menuUntukPeran(peran: Peran): ItemMenu[] {
  return MENU.filter((item) => !item.peran || item.peran.includes(peran));
}

export function kelompokUntukPeran(peran: Peran): KelompokMenu[] {
  return KELOMPOK_MENU.map((k) => ({
    ...k,
    item: k.item.filter((i) => !i.peran || i.peran.includes(peran)),
  })).filter((k) => k.item.length > 0);
}

/** Menandai menu aktif, termasuk saat berada di halaman turunannya. */
export function menuAktif(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Judul halaman untuk topbar, dicari dari rute yang sedang dibuka. */
export function judulHalaman(pathname: string): string {
  const cocok = MENU.filter((m) => menuAktif(pathname, m.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];

  return cocok?.label ?? "Rental Sepeda Garut";
}

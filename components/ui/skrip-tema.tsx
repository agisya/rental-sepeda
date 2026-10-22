"use client";

import { SKRIP_TEMA } from "@/lib/tema";

/**
 * Pembawa SKRIP_TEMA ke <head>.
 *
 * Dari server ia terkirim sebagai skrip biasa, dan peramban menjalankannya
 * saat membaca HTML — sebelum apa pun digambar. Saat React menggambar ulang
 * kerangka halaman di peramban (misalnya setelah pulih dari galat), skrip yang
 * sama dirender sebagai text/plain: React tidak pernah menjalankan skrip yang
 * ia buat sendiri dan akan memperingatkannya di mode pengembangan. Tema pada
 * saat itu dipasang ulang oleh TombolTema.
 *
 * Polanya dari panduan "Preventing Flash" di dokumentasi Next.js.
 */
export function SkripTema() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }}
    />
  );
}

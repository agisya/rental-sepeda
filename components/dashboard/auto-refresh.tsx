"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Menyegarkan data server secara berkala supaya dashboard tetap menunjukkan
 * kondisi terkini ketika ada dua petugas yang bekerja bersamaan.
 *
 * Penyegaran dihentikan saat tab tidak terlihat, supaya HP petugas tidak terus
 * memanggil server di dalam saku.
 */
export function AutoRefresh({ detik = 60 }: { detik?: number }) {
  const router = useRouter();

  useEffect(() => {
    const jeda = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, detik * 1000);

    function saatTerlihat() {
      if (document.visibilityState === "visible") router.refresh();
    }

    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      window.clearInterval(jeda);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [router, detik]);

  return null;
}

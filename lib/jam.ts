"use client";

import { useSyncExternalStore } from "react";

/**
 * Jam yang berdetak, diperlakukan sebagai sumber data di luar React.
 *
 * Ini pola yang tepat untuk waktu berjalan: useSyncExternalStore memberi React
 * nilai server saat hidrasi lalu beralih ke nilai klien, sehingga tidak ada
 * ketidakcocokan hidrasi dan tidak perlu memanggil setState di dalam efek.
 */

const INTERVAL_MS = 30_000;

let sekarangMs = Date.now();
const pelanggan = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function berlangganan(beriTahu: () => void): () => void {
  pelanggan.add(beriTahu);

  if (timer === undefined) {
    timer = setInterval(() => {
      sekarangMs = Date.now();
      for (const p of pelanggan) p();
    }, INTERVAL_MS);
  }

  return () => {
    pelanggan.delete(beriTahu);
    if (pelanggan.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * Waktu sekarang dalam milidetik, diperbarui tiap 30 detik.
 *
 * @param nilaiServer Nilai yang dipakai saat render di server dan saat hidrasi.
 *   Biasanya waktu mulai rental, supaya tampilan awal server dan klien sama.
 */
export function useSekarangMs(nilaiServer: number): number {
  return useSyncExternalStore(
    berlangganan,
    () => sekarangMs,
    () => nilaiServer,
  );
}

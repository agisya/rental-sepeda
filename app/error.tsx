"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/ui/error-view";

/**
 * Penjaga terakhir untuk rute di luar grup (app), terutama halaman login.
 * Tanpa ini, kegagalan koneksi database di halaman login muncul sebagai galat
 * mentah di layar petugas.
 */
export default function GalatAkar({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col justify-center">
      <ErrorView error={error} reset={reset} />
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/ui/error-view";
import { KerangkaPublik } from "@/components/ui/kerangka-publik";

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
    <KerangkaPublik>
      <ErrorView error={error} reset={reset} tingkat="h1" />
    </KerangkaPublik>
  );
}

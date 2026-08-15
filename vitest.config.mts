import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const akar = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": akar,
      // Penanda "server-only" melempar galat kalau diimpor di luar Next.
      // Untuk pengujian, modulnya diganti berkas kosong.
      "server-only": fileURLToPath(new URL("./test/server-only-kosong.ts", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // PGlite memuat WASM Postgres; beri waktu lebih longgar dari bawaan.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

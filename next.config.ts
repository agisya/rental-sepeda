import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Menghasilkan .next/standalone berisi server beserta dependensi yang
  // benar-benar dipakai. Image Docker jadi jauh lebih kecil karena tidak perlu
  // menyalin seluruh node_modules.
  output: "standalone",

  // PGlite membawa berkas WASM Postgres. Bundler tidak boleh mencoba
  // memaketkannya; biarkan Node memuatnya langsung dari node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;

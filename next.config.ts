import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite membawa berkas WASM Postgres. Bundler tidak boleh mencoba
  // memaketkannya; biarkan Node memuatnya langsung dari node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;

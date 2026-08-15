// Pengganti paket "server-only" saat pengujian di Node biasa.
// Paket aslinya sengaja melempar galat kalau diimpor di luar lingkungan server
// Next.js, dan itu justru menghalangi uji integrasi.
export {};

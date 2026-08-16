# Image produksi Rental Sepeda Garut.
#
# Dibangun bertahap supaya image akhirnya hanya berisi yang benar-benar
# dijalankan: tanpa kode sumber TypeScript, tanpa dependensi pengembangan,
# tanpa riwayat git.

# --- Tahap 1: dependensi -----------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Hanya berkas manifes yang disalin lebih dulu. Selama package.json dan
# package-lock.json tidak berubah, lapisan npm ci ini dipakai ulang dari cache
# sehingga build berikutnya jauh lebih cepat.
COPY package.json package-lock.json ./
RUN npm ci

# --- Tahap 2: build ----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build tidak menyentuh database sama sekali: koneksi dibuat saat pertama
# dipakai, bukan saat modul diimpor. Karena itu DATABASE_URL tidak dibutuhkan
# di sini, dan kredensial produksi tidak perlu masuk ke proses build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Tahap 3: runtime --------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Berjalan sebagai pengguna biasa, bukan root. Kalau suatu saat ada celah di
# aplikasi, kerusakannya terbatas.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Keluaran standalone sudah memuat server Node beserta dependensi yang benar-benar
# dipakai, jadi node_modules penuh tidak perlu ikut.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Berkas migrasi adalah data, bukan kode, sehingga tidak ikut terbawa penelusuran
# dependensi. Dibutuhkan karena migrasi dijalankan saat server menyala lewat
# instrumentation.ts.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

# Dokploy dan Docker memakai ini untuk tahu container sudah siap. Rute
# /api/health ikut memeriksa koneksi database, sehingga DATABASE_URL yang salah
# ketahuan sebagai container tidak sehat, bukan sebagai kegagalan saat petugas
# mencoba login.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

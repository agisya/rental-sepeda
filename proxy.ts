import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE_SESI, dekripsiSesi } from "@/lib/auth/token";

/**
 * Pengalihan optimistik saja — cuma membaca cookie, tidak menyentuh database.
 * Proxy berjalan di setiap permintaan termasuk prefetch, jadi query database di
 * sini akan memperlambat seluruh aplikasi. Otorisasi sebenarnya ada di
 * lib/auth/dal.ts.
 *
 * Sejak Next.js 16, berkas ini bernama proxy.ts (dulu middleware.ts).
 */

// /register dipakai membuat akun admin pertama pada instance yang baru dideploy,
// jadi ia harus bisa dibuka tanpa sesi. Halamannya sendiri mengalihkan ke /login
// begitu tabel pengguna berisi — pemeriksaan itu menyentuh database, sehingga
// tidak boleh dilakukan di sini.
const RUTE_PUBLIK = ["/login", "/register"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rutePublik = RUTE_PUBLIK.includes(path);

  const token = req.cookies.get(NAMA_COOKIE_SESI)?.value;
  const sesi = await dekripsiSesi(token);

  if (!sesi && !rutePublik) {
    const tujuan = new URL("/login", req.nextUrl);
    // Simpan halaman yang dituju supaya setelah login pengguna kembali ke sana.
    if (path !== "/") tujuan.searchParams.set("lanjut", path + req.nextUrl.search);
    return NextResponse.redirect(tujuan);
  }

  if (sesi && rutePublik) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (sesi && path === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)$).*)"],
};

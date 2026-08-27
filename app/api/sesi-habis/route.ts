import { NextResponse, type NextRequest } from "next/server";
import { hapusCookieSesi } from "@/lib/auth/session";

/**
 * Membuang cookie sesi yang sudah tidak ada penggunanya, lalu mengantar ke /login.
 *
 * Ada karena pembagian tugas di Next: cookie hanya boleh ditulis dari Server Function
 * atau Route Handler, sementara Server Component cuma boleh membacanya. Halaman yang
 * mendapati sesinya basi — lewat wajibPengguna() di lib/auth/dal.ts — tidak bisa
 * membereskan sendiri, dan mengalihkannya langsung ke /login membuat proxy.ts
 * memantulkannya kembali ke /dashboard karena cookienya masih terlihat sah. Itulah
 * putaran yang dulu membuat aplikasi tidak bisa dibuka sama sekali.
 *
 * Rute ini tidak memeriksa apa pun dan tidak butuh pemeriksaan: menghapus cookie
 * milik diri sendiri selalu boleh, dan yang tidak punya cookie pun tidak dirugikan.
 */
export async function GET(req: NextRequest) {
  await hapusCookieSesi();

  const tujuan = new URL("/login", req.nextUrl);

  // Dibawa terus supaya pengguna kembali ke halaman yang dituju setelah login ulang,
  // sama seperti pengalihan biasa dari proxy.ts.
  const lanjut = req.nextUrl.searchParams.get("lanjut");
  if (lanjut && lanjut.startsWith("/") && !lanjut.startsWith("//")) {
    tujuan.searchParams.set("lanjut", lanjut);
  }

  return NextResponse.redirect(tujuan);
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Pemeriksaan kesehatan untuk Dokploy dan Docker.
 *
 * Sengaja ikut menyentuh database dengan query paling murah yang ada. Tanpa itu,
 * rute ini hanya membuktikan proses Node masih hidup — padahal aplikasi yang
 * kehilangan koneksi database sudah tidak berguna dan seharusnya ditandai tidak
 * sehat supaya deploy yang salah konfigurasi ketahuan langsung, bukan setelah
 * petugas gagal login.
 *
 * Tidak butuh sesi: isinya tidak memuat data apa pun selain status.
 */
export async function GET() {
  const mulai = Date.now();

  try {
    await db.execute(sql`select 1`);

    return Response.json(
      { status: "sehat", database: "terhubung", ms: Date.now() - mulai },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (galat) {
    console.error("Pemeriksaan kesehatan gagal:", galat);

    return Response.json(
      { status: "bermasalah", database: "gagal terhubung" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

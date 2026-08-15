import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bikes } from "@/lib/db/schema";
import { ambilSesi } from "@/lib/auth/dal";

/**
 * Menyajikan foto sepeda yang tersimpan di database.
 *
 * Rute ini butuh sesi seperti halaman lain: katalog publik tidak dibangun, jadi
 * foto pun tidak perlu bisa diakses siapa saja. proxy.ts tidak menjaga alamat
 * berawalan /api, sehingga pemeriksaan sesi harus dilakukan di sini.
 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  if (!(await ambilSesi())) {
    return new Response("Tidak diizinkan", { status: 401 });
  }

  const { id } = await props.params;
  const bikeId = Number(id);
  if (!Number.isInteger(bikeId) || bikeId <= 0) {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  const [sepeda] = await db
    .select({
      fotoData: bikes.fotoData,
      fotoTipe: bikes.fotoTipe,
      fotoVersi: bikes.fotoVersi,
    })
    .from(bikes)
    .where(eq(bikes.id, bikeId))
    .limit(1);

  if (!sepeda?.fotoData || !sepeda.fotoTipe) {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  return new Response(new Uint8Array(sepeda.fotoData), {
    headers: {
      "Content-Type": sepeda.fotoTipe,
      "Content-Length": String(sepeda.fotoData.length),
      // Alamat gambar selalu membawa nomor versi, jadi isinya untuk satu alamat
      // tidak pernah berubah dan aman disimpan lama di cache peramban.
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: `"sepeda-${bikeId}-v${sepeda.fotoVersi}"`,
      // Mencegah peramban menebak-nebak jenis berkas dan menjalankannya.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

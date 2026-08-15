import { SignJWT, jwtVerify } from "jose";
import type { Peran } from "@/lib/db/schema";

/**
 * Enkripsi dan verifikasi token sesi. Sengaja dipisah dari session.ts dan tidak
 * mengimpor "server-only" maupun next/headers, karena proxy.ts berjalan di
 * runtime Edge yang tidak boleh menyentuh modul khusus Node.
 */

export const NAMA_COOKIE_SESI = "sesi";
export const MASA_BERLAKU_HARI = 7;
export const MASA_BERLAKU_MS = MASA_BERLAKU_HARI * 24 * 60 * 60 * 1000;

export type IsiSesi = {
  userId: number;
  username: string;
  nama: string;
  peran: Peran;
};

function kunciRahasia(): Uint8Array {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia || rahasia.length < 32) {
    throw new Error(
      "SESSION_SECRET belum diisi atau kurang dari 32 karakter. Lihat .env.example.",
    );
  }
  return new TextEncoder().encode(rahasia);
}

export async function enkripsiSesi(isi: IsiSesi): Promise<string> {
  return new SignJWT({ ...isi })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MASA_BERLAKU_HARI}d`)
    .sign(kunciRahasia());
}

/**
 * Mengembalikan null untuk token yang rusak, kedaluwarsa, atau ditandatangani
 * kunci lain. Sengaja tidak melempar galat supaya cookie basi cukup membuat
 * pengguna diarahkan ke halaman login, bukan memunculkan halaman error.
 */
export async function dekripsiSesi(token: string | undefined): Promise<IsiSesi | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, kunciRahasia(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.nama !== "string" ||
      typeof payload.peran !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      nama: payload.nama,
      peran: payload.peran as Peran,
    };
  } catch {
    return null;
  }
}

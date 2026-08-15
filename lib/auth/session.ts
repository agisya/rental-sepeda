import "server-only";

import { cookies } from "next/headers";
import {
  MASA_BERLAKU_MS,
  NAMA_COOKIE_SESI,
  dekripsiSesi,
  enkripsiSesi,
  type IsiSesi,
} from "./token";

export type { IsiSesi };

export async function buatCookieSesi(isi: IsiSesi): Promise<void> {
  const token = await enkripsiSesi(isi);
  const gudangCookie = await cookies();

  gudangCookie.set(NAMA_COOKIE_SESI, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + MASA_BERLAKU_MS),
    path: "/",
  });
}

export async function hapusCookieSesi(): Promise<void> {
  const gudangCookie = await cookies();
  gudangCookie.delete(NAMA_COOKIE_SESI);
}

export async function bacaSesi(): Promise<IsiSesi | null> {
  const gudangCookie = await cookies();
  return dekripsiSesi(gudangCookie.get(NAMA_COOKIE_SESI)?.value);
}

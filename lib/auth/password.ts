import { compare, hash } from "bcryptjs";

const PUTARAN = 10;

export function hashKataSandi(kataSandi: string): Promise<string> {
  return hash(kataSandi, PUTARAN);
}

export function cocokkanKataSandi(
  kataSandi: string,
  hashTersimpan: string,
): Promise<boolean> {
  return compare(kataSandi, hashTersimpan);
}

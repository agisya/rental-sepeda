/** Penggabung className sederhana. Nilai palsu diabaikan. */
export function cn(...bagian: Array<string | false | null | undefined>): string {
  return bagian.filter(Boolean).join(" ");
}

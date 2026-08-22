/**
 * Menyusun tautan WhatsApp dari nomor HP yang tersimpan.
 *
 * Nomor disimpan dalam bentuk lokal (0812…) karena itu yang diketik dan dibaca
 * orang di lapangan, sedangkan wa.me menuntut bentuk internasional tanpa tanda
 * plus (62812…). Penerjemahannya dikumpulkan di sini supaya tidak ditulis ulang
 * di sembilan tempat dengan sembilan cara yang sedikit berbeda.
 *
 * Murni: tanpa database, tanpa jam sistem, tanpa impor apa pun.
 */

/**
 * Nomor HP Indonesia dalam bentuk yang diterima wa.me, atau null kalau nomornya
 * tidak mungkin punya WhatsApp.
 *
 * Kolom nomor bertipe teks bebas, jadi data lama bisa berisi apa saja — termasuk
 * nomor telepon rumah Garut (0265…) yang tidak akan pernah menerima WhatsApp.
 * Untuk itu null dikembalikan supaya tombolnya disembunyikan; tombol yang
 * membuka percakapan kosong lebih membingungkan daripada tombol yang tidak ada.
 */
export function nomorWa(noHp: string | null | undefined): string | null {
  if (!noHp) return null;

  const angka = noHp.replace(/[^\d+]/g, "");
  let internasional: string;

  if (angka.startsWith("+62")) internasional = "62" + angka.slice(3);
  else if (angka.startsWith("62")) internasional = angka;
  else if (angka.startsWith("0")) internasional = "62" + angka.slice(1);
  // Sebagian orang menulis nomornya tanpa angka nol di depan.
  else if (angka.startsWith("8")) internasional = "62" + angka;
  else return null;

  // Panjangnya sengaja dicerminkan PERSIS dari noHpWa di lib/validasi.ts, yang
  // menerima /^08\d{8,12}$/ alias 10–14 angka lokal. Bentuk internasionalnya
  // membuang satu angka nol di depan dan menambah "62", sehingga menjadi
  // 628 diikuti 8–12 angka.
  //
  // Kedua batas itu harus sama. Kalau di sini lebih sempit, nomor yang diterima
  // aplikasi saat disimpan akan kehilangan tombol WhatsApp-nya tanpa penjelasan;
  // kalau lebih longgar, nomor yang ditolak aplikasi tetap ditawari tautan yang
  // pasti mati.
  return /^628\d{8,12}$/.test(internasional) ? internasional : null;
}

/** Tautan WhatsApp, atau null kalau nomornya tidak bisa dipakai. */
export function tautanWa(noHp: string | null | undefined, pesan?: string): string | null {
  const nomor = nomorWa(noHp);
  if (!nomor) return null;

  const dasar = `https://wa.me/${nomor}`;
  return pesan ? `${dasar}?text=${encodeURIComponent(pesan)}` : dasar;
}

/**
 * Kalimat pembuka yang sudah terketik saat percakapan dibuka.
 *
 * wa.me hanya MENGISI kolom ketik, tidak mengirim, jadi kasir tetap bisa
 * menyunting atau membatalkannya. Yang dibeli di sini adalah waktu: saat konter
 * ramai dan sepeda telat, mengetik kode sepeda dan jamnya dari nol justru
 * dilakukan pada saat paling tidak sempat.
 *
 * Nada sengaja bertanya, bukan menagih. Sepeda telat paling sering karena ban
 * bocor atau hujan, dan pesan pertama yang terdengar menuduh menyulitkan
 * percakapan yang belum tentu perlu sulit.
 */
export const pesanWa = {
  sepedaTelat: (nama: string, kodeSepeda: string) =>
    `Halo ${nama}, sepeda ${kodeSepeda} yang Anda sewa sudah melewati perkiraan waktu sewa. Apakah masih dalam perjalanan?`,

  bookingJemput: (nama: string, kodeBooking: string, kodeSepeda: string, jam: string) =>
    `Halo ${nama}, booking ${kodeBooking} untuk sepeda ${kodeSepeda} pukul ${jam} sudah bisa diambil. Kami tunggu ya.`,

  bookingHangus: (nama: string, kodeBooking: string, jam: string) =>
    `Halo ${nama}, booking ${kodeBooking} pukul ${jam} belum diambil sampai sekarang. Apakah masih jadi?`,

  /** Untuk halaman yang tidak punya konteks apa pun, seperti daftar penyewa. */
  sapaan: (nama: string) => `Halo ${nama},`,
};

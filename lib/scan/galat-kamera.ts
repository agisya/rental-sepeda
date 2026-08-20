/**
 * Menyusun pesan untuk galat yang muncul saat membuka kamera.
 *
 * Dipisah dari komponennya karena isinya keputusan, bukan tampilan: sebab yang
 * sama bisa berarti hal berbeda tergantung dari alamat mana aplikasi dibuka,
 * dan itu perlu diuji tanpa membuka kamera sungguhan.
 */

export type Alamat = {
  /** location.protocol, mis. "https:". */
  protokol: string;
  /** location.hostname, tanpa porta. */
  hostname: string;
};

/**
 * Menebak apakah alamat ini kemungkinan memakai sertifikat buatan sendiri.
 *
 * Cirinya alamat IP mentah ber-HTTPS — bentuk yang dihasilkan `npm run dev:hp`
 * saat menguji dari HP di jaringan lokal. Sertifikat untuk alamat semacam itu
 * tidak bisa diterbitkan otoritas mana pun, jadi selalu buatan sendiri.
 *
 * localhost sengaja tidak dihitung: peramban sudah menganggapnya alamat aman
 * tanpa sertifikat apa pun, sehingga jebakannya tidak berlaku di sana.
 *
 * Hanya IPv4 yang dikenali. IPv6 mentah ditulis dalam kurung siku dan praktis
 * tidak pernah dipakai untuk menguji di jaringan rumah; salah tebak di sana
 * hanya berarti pesannya kembali seperti semula, bukan menyesatkan.
 */
function sertifikatBuatanSendiri({ protokol, hostname }: Alamat): boolean {
  return protokol === "https:" && /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

const KETIK_MANUAL = "ketik kode sepedanya secara manual.";

/**
 * Pesan untuk galat yang dilempar getUserMedia.
 *
 * Namanya diambil dari properti `name`, bukan dari `message`, karena pesan
 * bawaan peramban berbeda-beda antar-mesin dan sebagian menyebut istilah yang
 * tidak berarti apa pun bagi petugas.
 */
export function pesanGalatKamera(namaGalat: string, alamat: Alamat): string {
  if (namaGalat === "NotAllowedError") {
    /*
      Dua sebab yang menghasilkan galat yang sama persis, dan peramban tidak
      menyediakan cara membedakannya dari dalam halaman: izin yang pernah
      ditolak, dan sertifikat yang tidak dipercaya. Yang kedua paling sering
      terjadi saat menguji dari HP, dan paling menyesatkan — peramban tidak
      pernah bertanya soal izin, jadi orang yang disuruh membuka pengaturan
      akan menemukan izinnya memang belum pernah diminta, lalu buntu di situ.

      Karena tidak bisa dibedakan, keduanya disebutkan — tapi yang soal
      sertifikat hanya di alamat yang memang mungkin memakainya, supaya petugas
      di konter tidak membaca penjelasan yang tidak berlaku baginya.
    */
    if (sertifikatBuatanSendiri(alamat)) {
      return (
        "Kamera ditolak peramban. Di alamat uji coba seperti ini, sebabnya " +
        "biasanya sertifikat buatan sendiri: melewati peringatan sertifikat " +
        "membuat halamannya terbuka, tapi kamera tetap ditolak. Uji kamera " +
        "lewat alamat resmi aplikasi. Kalau memang izinnya yang pernah " +
        "ditolak, nyalakan lagi di pengaturan situs pada peramban — atau " +
        KETIK_MANUAL
      );
    }

    return (
      "Izin kamera ditolak. Aktifkan izin kamera di pengaturan situs pada " +
      "peramban, atau " +
      KETIK_MANUAL
    );
  }

  if (namaGalat === "NotFoundError" || namaGalat === "OverconstrainedError") {
    // "Coba ganti kamera" saja adalah jalan buntu di perangkat yang memang
    // tidak punya kamera sama sekali — dan itu justru perangkat yang paling
    // mungkin melempar galat ini.
    return (
      "Kamera itu tidak ada di perangkat ini. Coba tombol ganti kamera, atau " +
      KETIK_MANUAL
    );
  }

  return "Kamera tidak bisa dibuka. Coba lagi atau " + KETIK_MANUAL;
}

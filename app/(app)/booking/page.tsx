import type { Metadata } from "next";
import { wajibPengguna } from "@/lib/auth/dal";
import { daftarAktivitas } from "@/lib/queries/aktivitas";
import { ambilPengaturan } from "@/lib/queries/pengaturan";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/ui/filter-chips";
import { Ikon } from "@/components/ui/icons";
import {
  DaftarAktivitas,
  FILTER_AKTIVITAS,
  saringAktivitas,
  statusPenyaringSah,
} from "@/components/aktivitas/daftar-aktivitas";

export const metadata: Metadata = { title: "Booking" };

/**
 * Halaman ini dan halaman Scan QR menampilkan daftar yang sama persis.
 *
 * Dulu keduanya berbeda isi: booking hanya memuat pemesanan, scan hanya memuat
 * rental langsung. Petugas jadi harus tahu lebih dulu sebuah sepeda "jenisnya
 * apa" sebelum tahu harus mencarinya di mana — padahal yang ia pedulikan cuma
 * sepeda ini sekarang ada di tahap apa. Jenisnya sekarang turun jadi penanda
 * kecil pada tiap baris, dan tahapnya yang naik jadi lencana.
 *
 * Yang membedakan kedua halaman tinggal titik masuknya: di sini ada penyaring
 * dan tombol tambah booking, di sana ada kotak scan.
 */
export default async function HalamanBooking(props: PageProps<"/booking">) {
  await wajibPengguna();
  const params = await props.searchParams;
  const status = typeof params.status === "string" ? params.status : "";

  const pengaturan = await ambilPengaturan();
  const sekarang = new Date();
  const semua = await daftarAktivitas(sekarang, pengaturan.toleransiBookingMenit);
  // Tautan lama memakai nilai status yang sekarang tidak dikenal lagi (mis.
  // ?status=booking, yang kini bernama dibooking). saringAktivitas sengaja
  // mengembalikan semuanya untuk nilai asing — tapi judul halaman tidak boleh
  // ikut mengaku "tersaring" saat itu terjadi.
  const tersaring = statusPenyaringSah(status);
  const daftar = saringAktivitas(semua, status);

  const pilihanFilter = FILTER_AKTIVITAS.map((f) => ({
    ...f,
    href: f.nilai ? `/booking?status=${f.nilai}` : "/booking",
  }));

  const hangus = semua.filter((a) => a.status === "hangus").length;

  return (
    <div className="space-y-4">
      <PageHeader
        judul="Booking & rental"
        keterangan={`${daftar.length} aktivitas${tersaring ? " tersaring" : " hari ini"}`}
        aksi={
          <ButtonLink href="/booking/baru" ukuran="sm" ikon={Ikon.tambah}>
            Tambah
          </ButtonLink>
        }
      />

      {/* Nilai asing tidak boleh menyalakan salah satu chip: chip yang menyala
          sambil menampilkan seluruh baris justru menyesatkan. */}
      <FilterChips
        label="Saring menurut tahap"
        pilihan={pilihanFilter}
        aktif={tersaring ? status : ""}
      />

      {hangus > 0 && (
        <p className="rounded-control border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          {hangus} booking sudah lewat jam mulainya tapi belum dijemput. Tandai hangus
          lewat detail booking kalau penyewanya tidak datang.
        </p>
      )}

      <DaftarAktivitas
        aktivitas={daftar}
        sekarang={sekarang}
        judulKosong={tersaring ? "Tidak ada yang cocok" : "Belum ada aktivitas"}
        keteranganKosong={
          tersaring
            ? "Coba pilih tahap lain, atau lihat semuanya."
            : "Catat pesanan dari telepon atau WhatsApp supaya sepedanya terkunci."
        }
      />
    </div>
  );
}

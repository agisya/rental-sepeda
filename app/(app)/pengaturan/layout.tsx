import { wajibPengguna } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { NavPengaturan } from "@/components/pengaturan/nav-pengaturan";

/**
 * Kerangka Pengaturan: daftar bagian di kiri, isinya di kanan.
 *
 * Di layar HP menunya menjadi baris yang bisa digeser di atas isi, bukan kolom
 * — kolom selebar itu akan memakan setengah layar dan menyisakan sedikit ruang
 * untuk yang sebenarnya sedang dikerjakan.
 */
export default async function LayoutPengaturan({
  children,
}: LayoutProps<"/pengaturan">) {
  const pengguna = await wajibPengguna();
  const bolehKelolaTim = pengguna.peran === "admin" || pengguna.peran === "owner";

  return (
    <div className="space-y-5">
      <PageHeader judul="Pengaturan" keterangan="Identitas usaha, akun, dan tampilan aplikasi" />

      <div className="grid gap-5 lg:grid-cols-[15rem_1fr] lg:items-start">
        <NavPengaturan bolehKelolaTim={bolehKelolaTim} />
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}

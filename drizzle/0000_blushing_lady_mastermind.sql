CREATE TYPE "public"."jenis_maintenance" AS ENUM('servis', 'sparepart', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."kategori_pengeluaran" AS ENUM('gaji', 'listrik', 'pdam', 'maintenance', 'sparepart', 'operasional', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."metode_bayar" AS ENUM('tunai', 'qris', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."peran" AS ENUM('admin', 'kasir', 'owner');--> statement-breakpoint
CREATE TYPE "public"."status_booking" AS ENUM('booking', 'selesai', 'batal');--> statement-breakpoint
CREATE TYPE "public"."status_rental" AS ENUM('berjalan', 'selesai', 'batal');--> statement-breakpoint
CREATE TYPE "public"."status_sepeda" AS ENUM('tersedia', 'disewa', 'booking', 'servis', 'nonaktif');--> statement-breakpoint
CREATE TABLE "bikes" (
	"id" serial PRIMARY KEY NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"jenis" text NOT NULL,
	"merk" text,
	"foto_url" text,
	"foto_data" "bytea",
	"foto_tipe" text,
	"foto_versi" integer DEFAULT 0 NOT NULL,
	"tarif_per_jam" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"status" "status_sepeda" DEFAULT 'tersedia' NOT NULL,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bikes_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "booking_slots" (
	"booking_id" integer NOT NULL,
	"bike_id" integer NOT NULL,
	"jam" timestamp with time zone NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bike_id" integer NOT NULL,
	"renter_id" integer NOT NULL,
	"dicatat_oleh" integer NOT NULL,
	"waktu_mulai" timestamp with time zone NOT NULL,
	"durasi_jam" integer NOT NULL,
	"tarif_per_jam_snapshot" integer NOT NULL,
	"metode_bayar" "metode_bayar",
	"status" "status_booking" DEFAULT 'booking' NOT NULL,
	"rental_id" integer,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" timestamp with time zone NOT NULL,
	"kategori" "kategori_pengeluaran" NOT NULL,
	"keterangan" text NOT NULL,
	"jumlah" integer NOT NULL,
	"maintenance_id" integer,
	"dicatat_oleh" integer NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenances" (
	"id" serial PRIMARY KEY NOT NULL,
	"bike_id" integer NOT NULL,
	"tanggal" timestamp with time zone NOT NULL,
	"jenis" "jenis_maintenance" DEFAULT 'servis' NOT NULL,
	"deskripsi" text NOT NULL,
	"biaya" integer DEFAULT 0 NOT NULL,
	"jam_pakai" integer,
	"tanggal_servis_berikutnya" date,
	"mekanik" text,
	"catatan" text,
	"dicatat_oleh" integer NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"tanggal" timestamp with time zone NOT NULL,
	"jumlah" integer NOT NULL,
	"metode" "metode_bayar" DEFAULT 'tunai' NOT NULL,
	"catatan" text,
	"dicatat_oleh" integer NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"no_hp" text NOT NULL,
	"alamat" text,
	"persentase_bagi_hasil" integer DEFAULT 60 NOT NULL,
	"catatan" text,
	"aktif" boolean DEFAULT true NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" serial PRIMARY KEY NOT NULL,
	"bike_id" integer NOT NULL,
	"renter_id" integer NOT NULL,
	"kasir_id" integer NOT NULL,
	"owner_id_snapshot" integer NOT NULL,
	"tarif_per_jam_snapshot" integer NOT NULL,
	"persentase_pemilik_snapshot" integer NOT NULL,
	"waktu_mulai" timestamp with time zone NOT NULL,
	"waktu_selesai" timestamp with time zone,
	"estimasi_jam" integer,
	"durasi_menit" integer,
	"durasi_jam_ditagih" integer,
	"total_biaya" integer,
	"bagian_pemilik" integer,
	"bagian_rental" integer,
	"metode_bayar" "metode_bayar",
	"status" "status_rental" DEFAULT 'berjalan' NOT NULL,
	"jaminan" text,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renters" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"no_hp" text NOT NULL,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renters_no_hp_unique" UNIQUE("no_hp")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"nama_usaha" text DEFAULT 'Rental Sepeda Garut' NOT NULL,
	"alamat" text,
	"no_hp" text,
	"batas_jam_rental" integer DEFAULT 12 NOT NULL,
	"toleransi_booking_menit" integer DEFAULT 60 NOT NULL,
	"diperbarui_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"nama" text NOT NULL,
	"peran" "peran" DEFAULT 'kasir' NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_maintenance_id_maintenances_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_payments" ADD CONSTRAINT "owner_payments_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_payments" ADD CONSTRAINT "owner_payments_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_renter_id_renters_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."renters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_kasir_id_users_id_fk" FOREIGN KEY ("kasir_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_owner_id_snapshot_owners_id_fk" FOREIGN KEY ("owner_id_snapshot") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bikes_owner_idx" ON "bikes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "bikes_status_idx" ON "bikes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_slots_satu_pemesan_per_jam" ON "booking_slots" USING btree ("bike_id","jam") WHERE "booking_slots"."aktif";--> statement-breakpoint
CREATE INDEX "booking_slots_jam_idx" ON "booking_slots" USING btree ("jam");--> statement-breakpoint
CREATE INDEX "booking_slots_booking_idx" ON "booking_slots" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_rental_unik" ON "bookings" USING btree ("rental_id") WHERE "bookings"."rental_id" is not null;--> statement-breakpoint
CREATE INDEX "bookings_waktu_mulai_idx" ON "bookings" USING btree ("waktu_mulai");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_bike_idx" ON "bookings" USING btree ("bike_id");--> statement-breakpoint
CREATE INDEX "expenses_tanggal_idx" ON "expenses" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "expenses_kategori_idx" ON "expenses" USING btree ("kategori");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_maintenance_unik" ON "expenses" USING btree ("maintenance_id") WHERE "expenses"."maintenance_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenances_bike_idx" ON "maintenances" USING btree ("bike_id");--> statement-breakpoint
CREATE INDEX "maintenances_tanggal_idx" ON "maintenances" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "owner_payments_owner_idx" ON "owner_payments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "owner_payments_tanggal_idx" ON "owner_payments" USING btree ("tanggal");--> statement-breakpoint
CREATE UNIQUE INDEX "rentals_satu_berjalan_per_sepeda" ON "rentals" USING btree ("bike_id") WHERE "rentals"."status" = 'berjalan';--> statement-breakpoint
CREATE INDEX "rentals_waktu_mulai_idx" ON "rentals" USING btree ("waktu_mulai");--> statement-breakpoint
CREATE INDEX "rentals_waktu_selesai_idx" ON "rentals" USING btree ("waktu_selesai");--> statement-breakpoint
CREATE INDEX "rentals_status_idx" ON "rentals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rentals_owner_snapshot_idx" ON "rentals" USING btree ("owner_id_snapshot");
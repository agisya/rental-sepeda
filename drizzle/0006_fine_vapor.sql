CREATE TYPE "public"."satuan_sewa" AS ENUM('jam', 'hari');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"satuan" "satuan_sewa" NOT NULL,
	"toleransi_telat_menit" integer NOT NULL,
	"batas_berjalan_satuan" integer NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_nama_unique" UNIQUE("nama")
);

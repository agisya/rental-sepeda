ALTER TABLE "rentals" ADD COLUMN "tambahan_saran" integer;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "tambahan_ditagih" integer;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "alasan_potongan" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "toleransi_telat_menit" integer DEFAULT 5 NOT NULL;
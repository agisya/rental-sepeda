CREATE TYPE "public"."status_setoran" AS ENUM('menunggu', 'diterima');--> statement-breakpoint
CREATE TABLE "cash_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" timestamp with time zone NOT NULL,
	"kasir_id" integer NOT NULL,
	"penerimaan_tunai" integer NOT NULL,
	"pengeluaran_tunai" integer NOT NULL,
	"setoran_pemilik_tunai" integer NOT NULL,
	"jumlah_seharusnya" integer NOT NULL,
	"jumlah_diserahkan" integer NOT NULL,
	"selisih" integer NOT NULL,
	"catatan" text,
	"status" "status_setoran" DEFAULT 'menunggu' NOT NULL,
	"diterima_oleh" integer,
	"diterima_pada" timestamp with time zone,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "metode" "metode_bayar" DEFAULT 'tunai' NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "dibatalkan_oleh" integer;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "dibatalkan_pada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "alasan_batal" text;--> statement-breakpoint
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_kasir_id_users_id_fk" FOREIGN KEY ("kasir_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_diterima_oleh_users_id_fk" FOREIGN KEY ("diterima_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_deposits_kasir_tanggal_unik" ON "cash_deposits" USING btree ("kasir_id","tanggal");--> statement-breakpoint
CREATE INDEX "cash_deposits_tanggal_idx" ON "cash_deposits" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "cash_deposits_status_idx" ON "cash_deposits" USING btree ("status");--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_dibatalkan_oleh_users_id_fk" FOREIGN KEY ("dibatalkan_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
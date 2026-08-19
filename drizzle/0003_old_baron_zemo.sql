ALTER TYPE "public"."status_setoran" ADD VALUE 'dibatalkan';--> statement-breakpoint
DROP INDEX "cash_deposits_kasir_tanggal_unik";--> statement-breakpoint
ALTER TABLE "cash_deposits" ADD COLUMN "dibatalkan_oleh" integer;--> statement-breakpoint
ALTER TABLE "cash_deposits" ADD COLUMN "dibatalkan_pada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cash_deposits" ADD COLUMN "alasan_batal" text;--> statement-breakpoint
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_dibatalkan_oleh_users_id_fk" FOREIGN KEY ("dibatalkan_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_deposits_kasir_tanggal_unik" ON "cash_deposits" USING btree ("kasir_id","tanggal") WHERE "cash_deposits"."dibatalkan_pada" is null;
-- CATATAN: satu-satunya pernyataan yang ditulis tangan di berkas ini.
--
-- Pelaksana timesheet berpindah dari `users` (pengguna sistem) ke `partners`
-- (pegawai). Tidak ada pemetaan yang sah dari pengguna ke pegawai — keduanya
-- master yang berbeda — sehingga baris lama tidak dapat dibawa serta. Tanpa
-- pengosongan ini, `ADD COLUMN pegawai_id uuid NOT NULL` di bawah akan gagal
-- pada tabel yang sudah berisi.
--
-- Cadangkan tabel ini lebih dulu bila ada jam kerja yang masih diperlukan.
DELETE FROM "timesheets";--> statement-breakpoint
CREATE TYPE "public"."satuan_tarif" AS ENUM('harian', 'jam');--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_tarif_tidak_negatif_ck";--> statement-breakpoint
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_jam_positif_ck";--> statement-breakpoint
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_tarif_tidak_negatif_ck";--> statement-breakpoint
ALTER TABLE "timesheets" DROP CONSTRAINT "timesheets_pengguna_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "timesheets_pengguna_idx";--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "is_pegawai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "tarif" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "satuan_tarif" "satuan_tarif" DEFAULT 'harian' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD COLUMN "proyek_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "so_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD COLUMN "proyek_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "syarat_pembayaran_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD COLUMN "syarat_pembayaran_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "proyek_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "laba_kotor_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "total_hari_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "pegawai_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "wo_id" uuid;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "kuantitas" numeric(18, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "tarif" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "satuan_tarif" "satuan_tarif" DEFAULT 'harian' NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets" ADD COLUMN "dicatat_oleh" uuid;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_proyek_id_projects_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_so_id_sales_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_proyek_id_projects_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_syarat_pembayaran_id_payment_terms_id_fk" FOREIGN KEY ("syarat_pembayaran_id") REFERENCES "public"."payment_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_syarat_pembayaran_id_payment_terms_id_fk" FOREIGN KEY ("syarat_pembayaran_id") REFERENCES "public"."payment_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_proyek_id_projects_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_pegawai_id_partners_id_fk" FOREIGN KEY ("pegawai_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_wo_id_work_orders_id_fk" FOREIGN KEY ("wo_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_pegawai_idx" ON "partners" USING btree ("is_pegawai");--> statement-breakpoint
CREATE INDEX "purchase_orders_so_idx" ON "purchase_orders" USING btree ("so_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_proyek_idx" ON "vendor_bill_lines" USING btree ("proyek_id");--> statement-breakpoint
CREATE INDEX "work_orders_proyek_idx" ON "work_orders" USING btree ("proyek_id");--> statement-breakpoint
CREATE INDEX "timesheets_pegawai_idx" ON "timesheets" USING btree ("pegawai_id");--> statement-breakpoint
CREATE INDEX "timesheets_wo_idx" ON "timesheets" USING btree ("wo_id");--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "tarif_per_jam";--> statement-breakpoint
ALTER TABLE "timesheets" DROP COLUMN "pengguna_id";--> statement-breakpoint
ALTER TABLE "timesheets" DROP COLUMN "jam";--> statement-breakpoint
ALTER TABLE "timesheets" DROP COLUMN "tarif_per_jam";--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_tarif_tidak_negatif_ck" CHECK ("partners"."tarif" >= 0);--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_kuantitas_wajar_ck" CHECK ("timesheets"."kuantitas" > 0 AND "timesheets"."kuantitas" <= CASE WHEN "timesheets"."satuan_tarif" = 'jam' THEN 24 ELSE 1 END);--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_tarif_tidak_negatif_ck" CHECK ("timesheets"."tarif" >= 0);
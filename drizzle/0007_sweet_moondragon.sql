CREATE TYPE "public"."status_perintah_produksi" AS ENUM('draft', 'dikonfirmasi', 'selesai', 'dibatalkan');--> statement-breakpoint
ALTER TYPE "public"."tipe_operasi" ADD VALUE IF NOT EXISTS 'konsumsi_produksi';--> statement-breakpoint
ALTER TYPE "public"."tipe_operasi" ADD VALUE IF NOT EXISTS 'hasil_produksi';--> statement-breakpoint
CREATE TABLE "bill_of_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"produk_id" uuid NOT NULL,
	"kuantitas" numeric(18, 6) DEFAULT '1' NOT NULL,
	"uom_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"catatan" text,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_of_materials_kuantitas_positif_ck" CHECK ("bill_of_materials"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "bom_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bom_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"catatan" text,
	CONSTRAINT "bom_lines_kuantitas_positif_ck" CHECK ("bom_lines"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "work_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wo_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"kuantitas_dikonsumsi" numeric(18, 6) DEFAULT '0' NOT NULL,
	"catatan" text,
	CONSTRAINT "work_order_lines_kuantitas_positif_ck" CHECK ("work_order_lines"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"status" "status_perintah_produksi" DEFAULT 'draft' NOT NULL,
	"produk_id" uuid NOT NULL,
	"bom_id" uuid,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"tanggal_target" date,
	"lokasi_sumber_id" uuid NOT NULL,
	"lokasi_tujuan_id" uuid NOT NULL,
	"biaya_tenaga_kerja" numeric(18, 2) DEFAULT '0' NOT NULL,
	"biaya_overhead" numeric(18, 2) DEFAULT '0' NOT NULL,
	"referensi" text,
	"catatan" text,
	"operasi_konsumsi_id" uuid,
	"operasi_hasil_id" uuid,
	"jurnal_biaya_id" uuid,
	"harga_pokok_satuan" numeric(18, 6),
	"dikonfirmasi_pada" timestamp with time zone,
	"dikonfirmasi_oleh" uuid,
	"diselesaikan_pada" timestamp with time zone,
	"diselesaikan_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_kuantitas_positif_ck" CHECK ("work_orders"."kuantitas" > 0),
	CONSTRAINT "work_orders_biaya_tidak_negatif_ck" CHECK ("work_orders"."biaya_tenaga_kerja" >= 0 AND "work_orders"."biaya_overhead" >= 0),
	CONSTRAINT "work_orders_lokasi_berbeda_ck" CHECK ("work_orders"."lokasi_sumber_id" <> "work_orders"."lokasi_tujuan_id")
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "akun_barang_dalam_proses_id" uuid;--> statement-breakpoint
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bom_id_bill_of_materials_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bill_of_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_wo_id_work_orders_id_fk" FOREIGN KEY ("wo_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_bom_id_bill_of_materials_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bill_of_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_lokasi_sumber_id_locations_id_fk" FOREIGN KEY ("lokasi_sumber_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_lokasi_tujuan_id_locations_id_fk" FOREIGN KEY ("lokasi_tujuan_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_operasi_konsumsi_id_stock_operations_id_fk" FOREIGN KEY ("operasi_konsumsi_id") REFERENCES "public"."stock_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_operasi_hasil_id_stock_operations_id_fk" FOREIGN KEY ("operasi_hasil_id") REFERENCES "public"."stock_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_jurnal_biaya_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_biaya_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_dikonfirmasi_oleh_users_id_fk" FOREIGN KEY ("dikonfirmasi_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_diselesaikan_oleh_users_id_fk" FOREIGN KEY ("diselesaikan_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_of_materials_kode_unik" ON "bill_of_materials" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "bill_of_materials_produk_idx" ON "bill_of_materials" USING btree ("produk_id");--> statement-breakpoint
CREATE INDEX "bom_lines_bom_idx" ON "bom_lines" USING btree ("bom_id");--> statement-breakpoint
CREATE INDEX "work_order_lines_wo_idx" ON "work_order_lines" USING btree ("wo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_nomor_unik" ON "work_orders" USING btree ("nomor") WHERE "work_orders"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "work_orders_tanggal_status_idx" ON "work_orders" USING btree ("tanggal","status");--> statement-breakpoint
CREATE INDEX "work_orders_produk_idx" ON "work_orders" USING btree ("produk_id");--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_barang_dalam_proses_id_accounts_id_fk" FOREIGN KEY ("akun_barang_dalam_proses_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
CREATE TYPE "public"."status_pembayaran" AS ENUM('draft', 'diposting', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."status_pembelian" AS ENUM('permintaan', 'dikonfirmasi', 'selesai', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."status_tagihan" AS ENUM('draft', 'diposting', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."tipe_tagihan" AS ENUM('tagihan', 'nota_debit');--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid NOT NULL,
	"deskripsi" text NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"harga_satuan" numeric(18, 6) NOT NULL,
	"tax_id" uuid,
	"kuantitas_diterima" numeric(18, 6) DEFAULT '0' NOT NULL,
	"kuantitas_ditagih" numeric(18, 6) DEFAULT '0' NOT NULL,
	CONSTRAINT "purchase_order_lines_kuantitas_positif_ck" CHECK ("purchase_order_lines"."kuantitas" > 0),
	CONSTRAINT "purchase_order_lines_harga_ck" CHECK ("purchase_order_lines"."harga_satuan" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"status" "status_pembelian" DEFAULT 'permintaan' NOT NULL,
	"partner_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"tanggal_diharapkan" date,
	"lokasi_tujuan_id" uuid NOT NULL,
	"syarat_pembayaran_id" uuid,
	"mata_uang_id" text DEFAULT 'IDR' NOT NULL,
	"referensi" text,
	"catatan" text,
	"dikonfirmasi_pada" timestamp with time zone,
	"dikonfirmasi_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid,
	"po_line_id" uuid,
	"deskripsi" text NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid,
	"harga_satuan" numeric(18, 6) NOT NULL,
	"tax_id" uuid,
	"akun_id" uuid NOT NULL,
	CONSTRAINT "vendor_bill_lines_kuantitas_positif_ck" CHECK ("vendor_bill_lines"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"tipe" "tipe_tagihan" DEFAULT 'tagihan' NOT NULL,
	"status" "status_tagihan" DEFAULT 'draft' NOT NULL,
	"partner_id" uuid NOT NULL,
	"po_id" uuid,
	"tanggal" date NOT NULL,
	"tanggal_jatuh_tempo" date,
	"referensi_pemasok" text,
	"mata_uang_id" text DEFAULT 'IDR' NOT NULL,
	"kurs" numeric(18, 6) DEFAULT '1' NOT NULL,
	"catatan" text,
	"jurnal_entry_id" uuid,
	"diposting_pada" timestamp with time zone,
	"diposting_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pembayaran_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"jumlah" numeric(18, 2) NOT NULL,
	CONSTRAINT "vendor_payment_allocations_jumlah_positif_ck" CHECK ("vendor_payment_allocations"."jumlah" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"status" "status_pembayaran" DEFAULT 'draft' NOT NULL,
	"partner_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"akun_kas_id" uuid NOT NULL,
	"jumlah" numeric(18, 2) NOT NULL,
	"referensi" text,
	"catatan" text,
	"jurnal_entry_id" uuid,
	"diposting_pada" timestamp with time zone,
	"diposting_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_payments_jumlah_positif_ck" CHECK ("vendor_payments"."jumlah" > 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_lokasi_tujuan_id_locations_id_fk" FOREIGN KEY ("lokasi_tujuan_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_syarat_pembayaran_id_payment_terms_id_fk" FOREIGN KEY ("syarat_pembayaran_id") REFERENCES "public"."payment_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_dikonfirmasi_oleh_users_id_fk" FOREIGN KEY ("dikonfirmasi_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_bill_id_vendor_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_po_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("po_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_akun_id_accounts_id_fk" FOREIGN KEY ("akun_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_diposting_oleh_users_id_fk" FOREIGN KEY ("diposting_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_pembayaran_id_vendor_payments_id_fk" FOREIGN KEY ("pembayaran_id") REFERENCES "public"."vendor_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_bill_id_vendor_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_akun_kas_id_accounts_id_fk" FOREIGN KEY ("akun_kas_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_diposting_oleh_users_id_fk" FOREIGN KEY ("diposting_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_order_lines_po_idx" ON "purchase_order_lines" USING btree ("po_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_nomor_unik" ON "purchase_orders" USING btree ("nomor") WHERE "purchase_orders"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_orders_partner_idx" ON "purchase_orders" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_tanggal_idx" ON "purchase_orders" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_bill_idx" ON "vendor_bill_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_bills_nomor_unik" ON "vendor_bills" USING btree ("nomor") WHERE "vendor_bills"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendor_bills_status_idx" ON "vendor_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendor_bills_partner_idx" ON "vendor_bills" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_po_idx" ON "vendor_bills" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_tanggal_idx" ON "vendor_bills" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_pembayaran_idx" ON "vendor_payment_allocations" USING btree ("pembayaran_id");--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_bill_idx" ON "vendor_payment_allocations" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_payments_nomor_unik" ON "vendor_payments" USING btree ("nomor") WHERE "vendor_payments"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendor_payments_partner_idx" ON "vendor_payments" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_tanggal_idx" ON "vendor_payments" USING btree ("tanggal");
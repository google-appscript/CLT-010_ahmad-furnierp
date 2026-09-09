CREATE TYPE "public"."status_penjualan" AS ENUM('penawaran', 'dikonfirmasi', 'selesai', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."tipe_faktur" AS ENUM('faktur', 'nota_kredit');--> statement-breakpoint
CREATE TABLE "customer_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid,
	"so_line_id" uuid,
	"deskripsi" text NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid,
	"harga_satuan" numeric(18, 6) NOT NULL,
	"tax_id" uuid,
	"akun_id" uuid NOT NULL,
	CONSTRAINT "customer_invoice_lines_kuantitas_positif_ck" CHECK ("customer_invoice_lines"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"tipe" "tipe_faktur" DEFAULT 'faktur' NOT NULL,
	"status" "status_tagihan" DEFAULT 'draft' NOT NULL,
	"partner_id" uuid NOT NULL,
	"so_id" uuid,
	"tanggal" date NOT NULL,
	"tanggal_jatuh_tempo" date,
	"referensi" text,
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
CREATE TABLE "customer_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pembayaran_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"jumlah" numeric(18, 2) NOT NULL,
	CONSTRAINT "customer_payment_allocations_jumlah_positif_ck" CHECK ("customer_payment_allocations"."jumlah" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_payments" (
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
	CONSTRAINT "customer_payments_jumlah_positif_ck" CHECK ("customer_payments"."jumlah" > 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tanggal" date NOT NULL,
	"asal" text DEFAULT 'manual' NOT NULL,
	"catatan" text,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"so_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid NOT NULL,
	"deskripsi" text NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"harga_satuan" numeric(18, 6) NOT NULL,
	"tax_id" uuid,
	"kuantitas_dikirim" numeric(18, 6) DEFAULT '0' NOT NULL,
	"kuantitas_difakturkan" numeric(18, 6) DEFAULT '0' NOT NULL,
	CONSTRAINT "sales_order_lines_kuantitas_positif_ck" CHECK ("sales_order_lines"."kuantitas" > 0),
	CONSTRAINT "sales_order_lines_harga_ck" CHECK ("sales_order_lines"."harga_satuan" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"status" "status_penjualan" DEFAULT 'penawaran' NOT NULL,
	"partner_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"tanggal_pengiriman" date,
	"lokasi_asal_id" uuid NOT NULL,
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
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_so_line_id_sales_order_lines_id_fk" FOREIGN KEY ("so_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_akun_id_accounts_id_fk" FOREIGN KEY ("akun_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_so_id_sales_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_diposting_oleh_users_id_fk" FOREIGN KEY ("diposting_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_pembayaran_id_customer_payments_id_fk" FOREIGN KEY ("pembayaran_id") REFERENCES "public"."customer_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_akun_kas_id_accounts_id_fk" FOREIGN KEY ("akun_kas_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_diposting_oleh_users_id_fk" FOREIGN KEY ("diposting_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_so_id_sales_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_lokasi_asal_id_locations_id_fk" FOREIGN KEY ("lokasi_asal_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_syarat_pembayaran_id_payment_terms_id_fk" FOREIGN KEY ("syarat_pembayaran_id") REFERENCES "public"."payment_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_dikonfirmasi_oleh_users_id_fk" FOREIGN KEY ("dikonfirmasi_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_invoice_lines_invoice_idx" ON "customer_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_invoices_nomor_unik" ON "customer_invoices" USING btree ("nomor") WHERE "customer_invoices"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_invoices_status_idx" ON "customer_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_invoices_partner_idx" ON "customer_invoices" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_so_idx" ON "customer_invoices" USING btree ("so_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_tanggal_idx" ON "customer_invoices" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "customer_payment_allocations_pembayaran_idx" ON "customer_payment_allocations" USING btree ("pembayaran_id");--> statement-breakpoint
CREATE INDEX "customer_payment_allocations_invoice_idx" ON "customer_payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_payments_nomor_unik" ON "customer_payments" USING btree ("nomor") WHERE "customer_payments"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_payments_partner_idx" ON "customer_payments" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "customer_payments_tanggal_idx" ON "customer_payments" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "sales_order_lines_so_idx" ON "sales_order_lines" USING btree ("so_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_nomor_unik" ON "sales_orders" USING btree ("nomor") WHERE "sales_orders"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_orders_partner_idx" ON "sales_orders" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "sales_orders_tanggal_idx" ON "sales_orders" USING btree ("tanggal");
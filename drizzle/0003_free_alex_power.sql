CREATE TYPE "public"."kategori_uom" AS ENUM('satuan', 'berat', 'panjang', 'luas', 'volume', 'waktu');--> statement-breakpoint
CREATE TYPE "public"."status_operasi" AS ENUM('draft', 'selesai', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."tipe_lokasi" AS ENUM('internal', 'pemasok', 'pelanggan', 'penyesuaian', 'rusak', 'produksi', 'transit');--> statement-breakpoint
CREATE TYPE "public"."tipe_operasi" AS ENUM('penerimaan', 'pengiriman', 'transfer', 'barang_rusak', 'opname');--> statement-breakpoint
CREATE TYPE "public"."tipe_produk" AS ENUM('disimpan', 'jasa', 'konsumsi');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"tipe" "tipe_lokasi" NOT NULL,
	"parent_id" uuid,
	"warehouse_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packing_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packing_list_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"nomor_koli" text NOT NULL,
	"produk_id" uuid NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"berat_kg" numeric(18, 3),
	"catatan" text,
	CONSTRAINT "packing_list_items_kuantitas_positif_ck" CHECK ("packing_list_items"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "packing_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text NOT NULL,
	"operasi_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"akun_persediaan_id" uuid NOT NULL,
	"akun_hpp_id" uuid NOT NULL,
	"akun_selisih_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"tipe" "tipe_produk" DEFAULT 'disimpan' NOT NULL,
	"kategori_id" uuid NOT NULL,
	"uom_id" uuid NOT NULL,
	"barcode" text,
	"harga_jual" numeric(18, 2) DEFAULT '0' NOT NULL,
	"harga_pokok_rata_rata" numeric(18, 6) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_harga_tidak_negatif_ck" CHECK ("products"."harga_jual" >= 0 AND "products"."harga_pokok_rata_rata" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operasi_id" uuid,
	"produk_id" uuid NOT NULL,
	"lokasi_asal_id" uuid NOT NULL,
	"lokasi_tujuan_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"harga_pokok_satuan" numeric(18, 6) DEFAULT '0' NOT NULL,
	"nilai_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_moves_kuantitas_positif_ck" CHECK ("stock_moves"."kuantitas" > 0),
	CONSTRAINT "stock_moves_lokasi_berbeda_ck" CHECK ("stock_moves"."lokasi_asal_id" <> "stock_moves"."lokasi_tujuan_id")
);
--> statement-breakpoint
CREATE TABLE "stock_operation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operasi_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"produk_id" uuid NOT NULL,
	"kuantitas" numeric(18, 6) NOT NULL,
	"uom_id" uuid NOT NULL,
	"harga_satuan" numeric(18, 6),
	"catatan" text,
	CONSTRAINT "stock_operation_lines_kuantitas_positif_ck" CHECK ("stock_operation_lines"."kuantitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"tipe" "tipe_operasi" NOT NULL,
	"tanggal" date NOT NULL,
	"status" "status_operasi" DEFAULT 'draft' NOT NULL,
	"lokasi_asal_id" uuid NOT NULL,
	"lokasi_tujuan_id" uuid NOT NULL,
	"partner_id" uuid,
	"referensi" text,
	"catatan" text,
	"jurnal_entry_id" uuid,
	"sumber_tipe" text,
	"sumber_id" uuid,
	"diselesaikan_pada" timestamp with time zone,
	"diselesaikan_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"kategori" "kategori_uom" NOT NULL,
	"faktor" numeric(18, 6) DEFAULT '1' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "uoms_faktor_positif_ck" CHECK ("uoms"."faktor" > 0)
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"alamat" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_list_items" ADD CONSTRAINT "packing_list_items_packing_list_id_packing_lists_id_fk" FOREIGN KEY ("packing_list_id") REFERENCES "public"."packing_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_list_items" ADD CONSTRAINT "packing_list_items_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_lists" ADD CONSTRAINT "packing_lists_operasi_id_stock_operations_id_fk" FOREIGN KEY ("operasi_id") REFERENCES "public"."stock_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_akun_persediaan_id_accounts_id_fk" FOREIGN KEY ("akun_persediaan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_akun_hpp_id_accounts_id_fk" FOREIGN KEY ("akun_hpp_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_akun_selisih_id_accounts_id_fk" FOREIGN KEY ("akun_selisih_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_kategori_id_product_categories_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_operasi_id_stock_operations_id_fk" FOREIGN KEY ("operasi_id") REFERENCES "public"."stock_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_lokasi_asal_id_locations_id_fk" FOREIGN KEY ("lokasi_asal_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_lokasi_tujuan_id_locations_id_fk" FOREIGN KEY ("lokasi_tujuan_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operation_lines" ADD CONSTRAINT "stock_operation_lines_operasi_id_stock_operations_id_fk" FOREIGN KEY ("operasi_id") REFERENCES "public"."stock_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operation_lines" ADD CONSTRAINT "stock_operation_lines_produk_id_products_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operation_lines" ADD CONSTRAINT "stock_operation_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_lokasi_asal_id_locations_id_fk" FOREIGN KEY ("lokasi_asal_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_lokasi_tujuan_id_locations_id_fk" FOREIGN KEY ("lokasi_tujuan_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_diselesaikan_oleh_users_id_fk" FOREIGN KEY ("diselesaikan_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_kode_unik" ON "locations" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "locations_tipe_idx" ON "locations" USING btree ("tipe");--> statement-breakpoint
CREATE INDEX "locations_warehouse_idx" ON "locations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "packing_list_items_list_idx" ON "packing_list_items" USING btree ("packing_list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packing_lists_nomor_unik" ON "packing_lists" USING btree ("nomor");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_kode_unik" ON "product_categories" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "products_kode_unik" ON "products" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "products_kategori_idx" ON "products" USING btree ("kategori_id");--> statement-breakpoint
CREATE INDEX "stock_moves_produk_idx" ON "stock_moves" USING btree ("produk_id");--> statement-breakpoint
CREATE INDEX "stock_moves_tanggal_idx" ON "stock_moves" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "stock_moves_operasi_idx" ON "stock_moves" USING btree ("operasi_id");--> statement-breakpoint
CREATE INDEX "stock_moves_asal_idx" ON "stock_moves" USING btree ("lokasi_asal_id");--> statement-breakpoint
CREATE INDEX "stock_moves_tujuan_idx" ON "stock_moves" USING btree ("lokasi_tujuan_id");--> statement-breakpoint
CREATE INDEX "stock_operation_lines_operasi_idx" ON "stock_operation_lines" USING btree ("operasi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_operations_nomor_unik" ON "stock_operations" USING btree ("nomor") WHERE "stock_operations"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "stock_operations_tanggal_status_idx" ON "stock_operations" USING btree ("tanggal","status");--> statement-breakpoint
CREATE INDEX "stock_operations_tipe_idx" ON "stock_operations" USING btree ("tipe");--> statement-breakpoint
CREATE INDEX "stock_operations_sumber_idx" ON "stock_operations" USING btree ("sumber_tipe","sumber_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uoms_kode_unik" ON "uoms" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_kode_unik" ON "warehouses" USING btree ("kode");
CREATE TYPE "public"."metode_depresiasi" AS ENUM('garis_lurus', 'saldo_menurun_ganda');--> statement-breakpoint
CREATE TYPE "public"."status_aset" AS ENUM('draft', 'berjalan', 'selesai', 'dilepas');--> statement-breakpoint
CREATE TYPE "public"."status_depresiasi" AS ENUM('draft', 'diposting');--> statement-breakpoint
CREATE TABLE "asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"akun_aset_id" uuid NOT NULL,
	"akun_akumulasi_id" uuid,
	"akun_beban_id" uuid,
	"dapat_didepresiasi" boolean DEFAULT true NOT NULL,
	"metode_bawaan" "metode_depresiasi" DEFAULT 'garis_lurus' NOT NULL,
	"masa_manfaat_bulan_bawaan" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "asset_categories_masa_manfaat_positif_ck" CHECK ("asset_categories"."masa_manfaat_bulan_bawaan" > 0),
	CONSTRAINT "asset_categories_akun_depresiasi_ck" CHECK ("asset_categories"."dapat_didepresiasi" = false
        OR ("asset_categories"."akun_akumulasi_id" IS NOT NULL AND "asset_categories"."akun_beban_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "depreciation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aset_id" uuid NOT NULL,
	"urutan" integer NOT NULL,
	"tanggal" date NOT NULL,
	"status" "status_depresiasi" DEFAULT 'draft' NOT NULL,
	"nilai" numeric(18, 2) NOT NULL,
	"akumulasi" numeric(18, 2) NOT NULL,
	"nilai_buku" numeric(18, 2) NOT NULL,
	"jurnal_entry_id" uuid,
	"diposting_pada" timestamp with time zone,
	"diposting_oleh" uuid,
	CONSTRAINT "depreciation_lines_nilai_positif_ck" CHECK ("depreciation_lines"."nilai" > 0)
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"kategori_id" uuid NOT NULL,
	"status" "status_aset" DEFAULT 'draft' NOT NULL,
	"tanggal_perolehan" date NOT NULL,
	"tanggal_mulai_depresiasi" date NOT NULL,
	"nilai_perolehan" numeric(18, 2) NOT NULL,
	"nilai_residu" numeric(18, 2) DEFAULT '0' NOT NULL,
	"masa_manfaat_bulan" integer NOT NULL,
	"metode" "metode_depresiasi" DEFAULT 'garis_lurus' NOT NULL,
	"partner_id" uuid,
	"referensi" text,
	"catatan" text,
	"tanggal_pelepasan" date,
	"nilai_pelepasan" numeric(18, 2),
	"jurnal_pelepasan_id" uuid,
	"dijalankan_pada" timestamp with time zone,
	"dijalankan_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_assets_nilai_perolehan_positif_ck" CHECK ("fixed_assets"."nilai_perolehan" > 0),
	CONSTRAINT "fixed_assets_residu_masuk_akal_ck" CHECK ("fixed_assets"."nilai_residu" >= 0 AND "fixed_assets"."nilai_residu" < "fixed_assets"."nilai_perolehan"),
	CONSTRAINT "fixed_assets_masa_manfaat_positif_ck" CHECK ("fixed_assets"."masa_manfaat_bulan" > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_akun_aset_id_accounts_id_fk" FOREIGN KEY ("akun_aset_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_akun_akumulasi_id_accounts_id_fk" FOREIGN KEY ("akun_akumulasi_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_akun_beban_id_accounts_id_fk" FOREIGN KEY ("akun_beban_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_aset_id_fixed_assets_id_fk" FOREIGN KEY ("aset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_diposting_oleh_users_id_fk" FOREIGN KEY ("diposting_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_kategori_id_asset_categories_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."asset_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_jurnal_pelepasan_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_pelepasan_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_dijalankan_oleh_users_id_fk" FOREIGN KEY ("dijalankan_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_categories_kode_unik" ON "asset_categories" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "depreciation_lines_urutan_unik" ON "depreciation_lines" USING btree ("aset_id","urutan");--> statement-breakpoint
CREATE INDEX "depreciation_lines_tanggal_status_idx" ON "depreciation_lines" USING btree ("tanggal","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_assets_kode_unik" ON "fixed_assets" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "fixed_assets_kategori_idx" ON "fixed_assets" USING btree ("kategori_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets" USING btree ("status");
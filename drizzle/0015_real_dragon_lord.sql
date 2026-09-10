CREATE TYPE "public"."periode_bagi_hasil" AS ENUM('bulanan', 'kuartalan', 'tahunan');--> statement-breakpoint
CREATE TYPE "public"."status_bagi_hasil" AS ENUM('terbuka', 'terkunci');--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"akun_modal_id" uuid NOT NULL,
	"akun_prive_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periode_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"persentase" numeric(9, 4) NOT NULL,
	CONSTRAINT "ownership_shares_persentase_ck" CHECK ("ownership_shares"."persentase" > 0 AND "ownership_shares"."persentase" <= 100)
);
--> statement-breakpoint
CREATE TABLE "profit_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"tipe" "periode_bagi_hasil" NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"status" "status_bagi_hasil" DEFAULT 'terkunci' NOT NULL,
	"laba_bersih" numeric(18, 2) NOT NULL,
	"jurnal_entry_id" uuid,
	"ownership_periode_id" uuid,
	"dikunci_pada" timestamp with time zone,
	"dikunci_oleh" uuid
);
--> statement-breakpoint
CREATE TABLE "profit_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profit_period_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"persentase" numeric(9, 4) NOT NULL,
	"jumlah" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "akun_laba_berjalan_id" uuid;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "periode_bagi_hasil" "periode_bagi_hasil" DEFAULT 'tahunan' NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_akun_modal_id_accounts_id_fk" FOREIGN KEY ("akun_modal_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_akun_prive_id_accounts_id_fk" FOREIGN KEY ("akun_prive_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_shares" ADD CONSTRAINT "ownership_shares_periode_id_ownership_periods_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."ownership_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_shares" ADD CONSTRAINT "ownership_shares_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_periods" ADD CONSTRAINT "profit_periods_jurnal_entry_id_journal_entries_id_fk" FOREIGN KEY ("jurnal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_periods" ADD CONSTRAINT "profit_periods_ownership_periode_id_ownership_periods_id_fk" FOREIGN KEY ("ownership_periode_id") REFERENCES "public"."ownership_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_periods" ADD CONSTRAINT "profit_periods_dikunci_oleh_users_id_fk" FOREIGN KEY ("dikunci_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_shares" ADD CONSTRAINT "profit_shares_profit_period_id_profit_periods_id_fk" FOREIGN KEY ("profit_period_id") REFERENCES "public"."profit_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_shares" ADD CONSTRAINT "profit_shares_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "owners_kode_unik" ON "owners" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "ownership_periods_mulai_idx" ON "ownership_periods" USING btree ("tanggal_mulai");--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_shares_unik" ON "ownership_shares" USING btree ("periode_id","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profit_periods_kode_unik" ON "profit_periods" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "profit_periods_rentang_idx" ON "profit_periods" USING btree ("tanggal_mulai","tanggal_selesai");--> statement-breakpoint
CREATE UNIQUE INDEX "profit_shares_unik" ON "profit_shares" USING btree ("profit_period_id","owner_id");--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_laba_berjalan_id_accounts_id_fk" FOREIGN KEY ("akun_laba_berjalan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
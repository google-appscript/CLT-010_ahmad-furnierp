CREATE TABLE "journal_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"deskripsi" text,
	"journal_id" uuid NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "akun_tenaga_kerja_langsung_id" uuid;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "akun_overhead_pabrik_id" uuid;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "akun_laba_pelepasan_aset_id" uuid;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "akun_rugi_pelepasan_aset_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_mappings" ADD CONSTRAINT "journal_mappings_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_mappings_kode_unik" ON "journal_mappings" USING btree ("kode");--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_tenaga_kerja_langsung_id_accounts_id_fk" FOREIGN KEY ("akun_tenaga_kerja_langsung_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_overhead_pabrik_id_accounts_id_fk" FOREIGN KEY ("akun_overhead_pabrik_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_laba_pelepasan_aset_id_accounts_id_fk" FOREIGN KEY ("akun_laba_pelepasan_aset_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_rugi_pelepasan_aset_id_accounts_id_fk" FOREIGN KEY ("akun_rugi_pelepasan_aset_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
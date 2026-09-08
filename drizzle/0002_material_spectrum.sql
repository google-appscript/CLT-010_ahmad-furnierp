CREATE TYPE "public"."status_entri" AS ENUM('draft', 'diposting', 'dibatalkan');--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text,
	"journal_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"referensi" text,
	"keterangan" text,
	"status" "status_entri" DEFAULT 'draft' NOT NULL,
	"mata_uang_id" text NOT NULL,
	"kurs" numeric(18, 6) DEFAULT '1' NOT NULL,
	"partner_id" uuid,
	"sumber_tipe" text,
	"sumber_id" uuid,
	"membalik_entry_id" uuid,
	"diposting_pada" timestamp with time zone,
	"diposting_oleh" uuid,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"account_id" uuid NOT NULL,
	"partner_id" uuid,
	"label" text NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"kredit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"nilai_mata_uang" numeric(18, 6),
	"mata_uang_id" text,
	"tax_id" uuid,
	"project_id" uuid,
	"rekonsiliasi_id" uuid,
	CONSTRAINT "journal_items_debit_kredit_ck" CHECK ("journal_items"."debit" >= 0 AND "journal_items"."kredit" >= 0 AND NOT ("journal_items"."debit" > 0 AND "journal_items"."kredit" > 0))
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_diposting_oleh_users_id_fk" FOREIGN KEY ("diposting_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_nomor_unik" ON "journal_entries" USING btree ("nomor") WHERE "journal_entries"."nomor" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "journal_entries_tanggal_status_idx" ON "journal_entries" USING btree ("tanggal","status");--> statement-breakpoint
CREATE INDEX "journal_entries_sumber_idx" ON "journal_entries" USING btree ("sumber_tipe","sumber_id");--> statement-breakpoint
CREATE INDEX "journal_entries_journal_idx" ON "journal_entries" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "journal_items_entry_idx" ON "journal_items" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_items_account_idx" ON "journal_items" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "journal_items_partner_idx" ON "journal_items" USING btree ("partner_id");
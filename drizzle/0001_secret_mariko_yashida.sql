CREATE TABLE "currencies" (
	"kode" text PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"simbol" text NOT NULL,
	"desimal" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode_mata_uang" text NOT NULL,
	"tanggal" date NOT NULL,
	"kurs" numeric(18, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"tipe_akun" "tipe_akun" NOT NULL,
	"mata_uang_id" text,
	"dapat_direkonsiliasi" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"catatan" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"tipe" "tipe_jurnal" NOT NULL,
	"sequence_id" uuid NOT NULL,
	"akun_default_debit_id" uuid,
	"akun_default_kredit_id" uuid,
	"mata_uang_id" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"tipe" "tipe_partner" DEFAULT 'badan' NOT NULL,
	"is_pelanggan" boolean DEFAULT false NOT NULL,
	"is_pemasok" boolean DEFAULT false NOT NULL,
	"npwp" text,
	"nik" text,
	"alamat" text,
	"kota" text,
	"provinsi" text,
	"kode_pos" text,
	"telepon" text,
	"email" text,
	"kontak_person" text,
	"syarat_pembayaran_id" uuid,
	"akun_piutang_id" uuid,
	"akun_utang_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"jumlah_hari" integer DEFAULT 0 NOT NULL,
	"catatan" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"ruang_lingkup" "ruang_lingkup_pajak" NOT NULL,
	"tarif" numeric(9, 4) NOT NULL,
	"harga_termasuk_pajak" boolean DEFAULT false NOT NULL,
	"is_pemotongan" boolean DEFAULT false NOT NULL,
	"akun_pajak_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"npwp" text,
	"alamat" text,
	"kota" text,
	"provinsi" text,
	"kode_pos" text,
	"telepon" text,
	"email" text,
	"logo_url" text,
	"mata_uang_fungsional" text DEFAULT 'IDR' NOT NULL,
	"bulan_awal_tahun_buku" integer DEFAULT 1 NOT NULL,
	"tanggal_kunci_buku" date,
	"tanggal_kunci_pajak" date,
	"akun_laba_ditahan_id" uuid,
	"akun_selisih_kurs_untung_id" uuid,
	"akun_selisih_kurs_rugi_id" uuid,
	"akun_pembulatan_id" uuid,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"status" "status_tahun_buku" DEFAULT 'terbuka' NOT NULL,
	"entry_penutup_id" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"prefix" text NOT NULL,
	"panjang_digit" integer DEFAULT 4 NOT NULL,
	"nomor_berikut" integer DEFAULT 1 NOT NULL,
	"reset" "reset_urutan" DEFAULT 'tahunan' NOT NULL,
	"tahun_terakhir" integer,
	"bulan_terakhir" integer
);
--> statement-breakpoint
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_kode_mata_uang_currencies_kode_fk" FOREIGN KEY ("kode_mata_uang") REFERENCES "public"."currencies"("kode") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_akun_default_debit_id_accounts_id_fk" FOREIGN KEY ("akun_default_debit_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_akun_default_kredit_id_accounts_id_fk" FOREIGN KEY ("akun_default_kredit_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_mata_uang_id_currencies_kode_fk" FOREIGN KEY ("mata_uang_id") REFERENCES "public"."currencies"("kode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_syarat_pembayaran_id_payment_terms_id_fk" FOREIGN KEY ("syarat_pembayaran_id") REFERENCES "public"."payment_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_akun_piutang_id_accounts_id_fk" FOREIGN KEY ("akun_piutang_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_akun_utang_id_accounts_id_fk" FOREIGN KEY ("akun_utang_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_akun_pajak_id_accounts_id_fk" FOREIGN KEY ("akun_pajak_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_laba_ditahan_id_accounts_id_fk" FOREIGN KEY ("akun_laba_ditahan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_selisih_kurs_untung_id_accounts_id_fk" FOREIGN KEY ("akun_selisih_kurs_untung_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_selisih_kurs_rugi_id_accounts_id_fk" FOREIGN KEY ("akun_selisih_kurs_rugi_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_akun_pembulatan_id_accounts_id_fk" FOREIGN KEY ("akun_pembulatan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "currency_rates_unik" ON "currency_rates" USING btree ("kode_mata_uang","tanggal");--> statement-breakpoint
CREATE INDEX "currency_rates_pencarian_idx" ON "currency_rates" USING btree ("kode_mata_uang","tanggal");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_kode_unik" ON "accounts" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "accounts_tipe_idx" ON "accounts" USING btree ("tipe_akun");--> statement-breakpoint
CREATE UNIQUE INDEX "journals_kode_unik" ON "journals" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_kode_unik" ON "partners" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "partners_pelanggan_idx" ON "partners" USING btree ("is_pelanggan");--> statement-breakpoint
CREATE INDEX "partners_pemasok_idx" ON "partners" USING btree ("is_pemasok");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_terms_nama_unik" ON "payment_terms" USING btree ("nama");--> statement-breakpoint
CREATE UNIQUE INDEX "taxes_kode_unik" ON "taxes" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_years_nama_unik" ON "fiscal_years" USING btree ("nama");--> statement-breakpoint
CREATE UNIQUE INDEX "sequences_kode_unik" ON "sequences" USING btree ("kode");
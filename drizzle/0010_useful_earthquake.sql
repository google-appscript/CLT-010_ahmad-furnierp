CREATE TYPE "public"."status_proyek" AS ENUM('draft', 'berjalan', 'selesai', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."status_tugas" AS ENUM('belum_mulai', 'berjalan', 'selesai', 'dibatalkan');--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyek_id" uuid NOT NULL,
	"urutan" integer DEFAULT 1 NOT NULL,
	"nama" text NOT NULL,
	"deskripsi" text,
	"status" "status_tugas" DEFAULT 'belum_mulai' NOT NULL,
	"penanggung_jawab_id" uuid,
	"tanggal_mulai" date,
	"tenggat" date,
	"estimasi_jam" numeric(18, 2) DEFAULT '0' NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_tasks_estimasi_tidak_negatif_ck" CHECK ("project_tasks"."estimasi_jam" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"so_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"status" "status_proyek" DEFAULT 'draft' NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_target" date,
	"tanggal_selesai" date,
	"manajer_id" uuid,
	"tarif_per_jam" numeric(18, 2) DEFAULT '0' NOT NULL,
	"catatan" text,
	"dibuat_oleh" uuid,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_tarif_tidak_negatif_ck" CHECK ("projects"."tarif_per_jam" >= 0)
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyek_id" uuid NOT NULL,
	"tugas_id" uuid,
	"pengguna_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"jam" numeric(18, 2) NOT NULL,
	"tarif_per_jam" numeric(18, 2) DEFAULT '0' NOT NULL,
	"deskripsi" text NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timesheets_jam_positif_ck" CHECK ("timesheets"."jam" > 0 AND "timesheets"."jam" <= 24),
	CONSTRAINT "timesheets_tarif_tidak_negatif_ck" CHECK ("timesheets"."tarif_per_jam" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_proyek_id_projects_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_penanggung_jawab_id_users_id_fk" FOREIGN KEY ("penanggung_jawab_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_so_id_sales_orders_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manajer_id_users_id_fk" FOREIGN KEY ("manajer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_proyek_id_projects_id_fk" FOREIGN KEY ("proyek_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_tugas_id_project_tasks_id_fk" FOREIGN KEY ("tugas_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_pengguna_id_users_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_tasks_proyek_idx" ON "project_tasks" USING btree ("proyek_id");--> statement-breakpoint
CREATE INDEX "project_tasks_status_idx" ON "project_tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_kode_unik" ON "projects" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_so_unik" ON "projects" USING btree ("so_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "timesheets_proyek_tanggal_idx" ON "timesheets" USING btree ("proyek_id","tanggal");--> statement-breakpoint
CREATE INDEX "timesheets_pengguna_idx" ON "timesheets" USING btree ("pengguna_id");--> statement-breakpoint
ALTER TABLE "journal_items" ADD CONSTRAINT "journal_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
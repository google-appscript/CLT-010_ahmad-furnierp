ALTER TYPE "public"."status_proyek" ADD VALUE IF NOT EXISTS 'terkunci' BEFORE 'dibatalkan';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pendapatan_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "harga_pokok_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "beban_lain_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "biaya_tenaga_kerja_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "total_jam_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "laba_final" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "dikunci_pada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "dikunci_oleh" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_dikunci_oleh_users_id_fk" FOREIGN KEY ("dikunci_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
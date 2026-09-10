CREATE TABLE "filter_tersimpan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"kunci_daftar" text NOT NULL,
	"nama" text NOT NULL,
	"kriteria" jsonb NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "filter_tersimpan" ADD CONSTRAINT "filter_tersimpan_pengguna_id_users_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
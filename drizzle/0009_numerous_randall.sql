CREATE TABLE "sequence_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"tahun" integer NOT NULL,
	"bulan" integer NOT NULL,
	"nomor_berikut" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sequence_periods" ADD CONSTRAINT "sequence_periods_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sequence_periods_unik" ON "sequence_periods" USING btree ("sequence_id","tahun","bulan");--> statement-breakpoint
-- Pencacah yang sedang berjalan dipindahkan ke periode terakhir yang dipakainya,
-- agar penomoran berlanjut mulus dan tidak mengulang nomor yang sudah terbit.
INSERT INTO "sequence_periods" ("sequence_id", "tahun", "bulan", "nomor_berikut")
SELECT
  "id",
  CASE WHEN "reset" = 'tidak_pernah' THEN 0 ELSE "tahun_terakhir" END,
  CASE WHEN "reset" = 'bulanan' THEN COALESCE("bulan_terakhir", 0) ELSE 0 END,
  "nomor_berikut"
FROM "sequences"
WHERE "tahun_terakhir" IS NOT NULL;--> statement-breakpoint
-- Setelah dipindahkan, kolom ini kembali berarti "nomor pertama tiap periode".
UPDATE "sequences" SET "nomor_berikut" = 1;--> statement-breakpoint
ALTER TABLE "sequences" DROP COLUMN "tahun_terakhir";--> statement-breakpoint
ALTER TABLE "sequences" DROP COLUMN "bulan_terakhir";
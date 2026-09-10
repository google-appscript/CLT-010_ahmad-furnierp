CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"deskripsi" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_item_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"cost_center_id" uuid NOT NULL,
	"persentase" numeric(9, 4) NOT NULL,
	"nilai" numeric(18, 2) NOT NULL,
	CONSTRAINT "journal_item_cost_allocations_persentase_ck" CHECK ("journal_item_cost_allocations"."persentase" > 0 AND "journal_item_cost_allocations"."persentase" <= 100)
);
--> statement-breakpoint
CREATE TABLE "location_cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lokasi_id" uuid NOT NULL,
	"cost_center_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_item_cost_allocations" ADD CONSTRAINT "journal_item_cost_allocations_item_id_journal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."journal_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_item_cost_allocations" ADD CONSTRAINT "journal_item_cost_allocations_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_cost_centers" ADD CONSTRAINT "location_cost_centers_lokasi_id_locations_id_fk" FOREIGN KEY ("lokasi_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_cost_centers" ADD CONSTRAINT "location_cost_centers_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_kode_unik" ON "cost_centers" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_item_cost_allocations_unik" ON "journal_item_cost_allocations" USING btree ("item_id","cost_center_id");--> statement-breakpoint
CREATE INDEX "journal_item_cost_allocations_pos_idx" ON "journal_item_cost_allocations" USING btree ("cost_center_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_cost_centers_lokasi_unik" ON "location_cost_centers" USING btree ("lokasi_id");
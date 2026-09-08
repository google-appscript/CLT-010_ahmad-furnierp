CREATE TYPE "public"."aksi_audit" AS ENUM('buat', 'ubah', 'hapus', 'posting', 'balik', 'masuk');--> statement-breakpoint
CREATE TYPE "public"."reset_urutan" AS ENUM('tidak_pernah', 'tahunan', 'bulanan');--> statement-breakpoint
CREATE TYPE "public"."ruang_lingkup_pajak" AS ENUM('penjualan', 'pembelian');--> statement-breakpoint
CREATE TYPE "public"."status_tahun_buku" AS ENUM('terbuka', 'ditutup');--> statement-breakpoint
CREATE TYPE "public"."tipe_akun" AS ENUM('aset_kas', 'aset_bank', 'aset_piutang', 'aset_persediaan', 'aset_lancar_lain', 'aset_tetap', 'aset_akumulasi_depresiasi', 'aset_tidak_lancar_lain', 'liabilitas_utang_usaha', 'liabilitas_pajak', 'liabilitas_jangka_pendek', 'liabilitas_jangka_panjang', 'ekuitas', 'ekuitas_laba_ditahan', 'ekuitas_laba_berjalan', 'pendapatan', 'pendapatan_lain', 'beban_hpp', 'beban_operasional', 'beban_depresiasi', 'beban_lain', 'beban_pajak');--> statement-breakpoint
CREATE TYPE "public"."tipe_jurnal" AS ENUM('penjualan', 'pembelian', 'kas', 'bank', 'umum');--> statement-breakpoint
CREATE TYPE "public"."tipe_partner" AS ENUM('perorangan', 'badan');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"entitas" text NOT NULL,
	"entitas_id" text,
	"aksi" "aksi_audit" NOT NULL,
	"data_lama" jsonb,
	"data_baru" jsonb,
	"alamat_ip" text,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"modul" text NOT NULL,
	"deskripsi" text
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nama" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entitas_idx" ON "audit_logs" USING btree ("entitas","entitas_id");--> statement-breakpoint
CREATE INDEX "audit_logs_waktu_idx" ON "audit_logs" USING btree ("waktu");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_kode_unik" ON "permissions" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "permissions_modul_idx" ON "permissions" USING btree ("modul");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_kode_unik" ON "roles" USING btree ("kode");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unik" ON "users" USING btree ("email");
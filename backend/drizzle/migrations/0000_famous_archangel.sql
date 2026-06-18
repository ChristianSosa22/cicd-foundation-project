CREATE TYPE "public"."collaborator_category" AS ENUM('ejecutivo', 'operativo', 'visitante_frecuente');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('reservada', 'ocupada', 'liberada', 'cancelada', 'expirada');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('admin', 'driver');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('auto', 'moto', 'camioneta');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parking_spaces" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parking_spaces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parking_spaces_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reservations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"space_id" bigint NOT NULL,
	"reservation_date" date NOT NULL,
	"status" "reservation_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirm_deadline" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"is_late_cancellation" boolean DEFAULT false NOT NULL,
	"receipt_s3_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_allowed_category" (
	"space_id" bigint NOT NULL,
	"category" "collaborator_category" NOT NULL,
	CONSTRAINT "space_allowed_category_space_id_category_pk" PRIMARY KEY("space_id","category")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_blackouts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "space_blackouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"space_id" bigint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_blackouts_date_chk" CHECK ("space_blackouts"."end_date" >= "space_blackouts"."start_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tariffs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tariffs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_type" "vehicle_type" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'GTQ' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone_enc" "bytea",
	"system_role" "system_role" NOT NULL,
	"category" "collaborator_category",
	"is_active" boolean DEFAULT true NOT NULL,
	"blocked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"plate_enc" "bytea" NOT NULL,
	"plate_hash" text NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_plate_hash_unique" UNIQUE("plate_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservations" ADD CONSTRAINT "reservations_space_id_parking_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."parking_spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_allowed_category" ADD CONSTRAINT "space_allowed_category_space_id_parking_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."parking_spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_blackouts" ADD CONSTRAINT "space_blackouts_space_id_parking_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."parking_spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_blackouts" ADD CONSTRAINT "space_blackouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reservations_space_date_active_uq" ON "reservations" USING btree ("space_id","reservation_date") WHERE status IN ('reservada', 'ocupada');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reservations_user_date_active_uq" ON "reservations" USING btree ("user_id","reservation_date") WHERE status IN ('reservada', 'ocupada');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_date_status_idx" ON "reservations" USING btree ("reservation_date","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_status_deadline_idx" ON "reservations" USING btree ("status","confirm_deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_user_date_idx" ON "reservations" USING btree ("user_id","reservation_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_blackouts_space_id_idx" ON "space_blackouts" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariffs_type_effective_idx" ON "tariffs" USING btree ("vehicle_type","effective_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_user_id_idx" ON "vehicles" USING btree ("user_id");--> statement-breakpoint
CREATE VIEW "public"."current_tariffs" AS (SELECT DISTINCT ON (vehicle_type) vehicle_type, price, currency, effective_from FROM tariffs ORDER BY vehicle_type, effective_from DESC);
-- Reconcile: bring Drizzle's knowledge in sync with tables already created by
-- server-side raw SQL migrations.  Every statement uses IF NOT EXISTS so the
-- migration is safe to run against a production database that already has
-- these objects, AND against a fresh database where they don't exist yet.

CREATE TABLE IF NOT EXISTS "work_area_types" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "division" varchar(50),
        "is_active" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "cost_code" text,
        "qb_service_name" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_work_areas" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "job_id" varchar(36),
        "work_area_type_id" varchar(36),
        "name" varchar(100) NOT NULL,
        "estimated_hours" numeric(6, 2),
        "actual_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "notes" text,
        "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_entries" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar(36) NOT NULL,
        "job_id" varchar(36),
        "clock_in" timestamp with time zone DEFAULT now() NOT NULL,
        "clock_out" timestamp with time zone,
        "duration_minutes" integer,
        "entry_type" varchar(20) DEFAULT 'billable' NOT NULL,
        "notes" text,
        "created_at" timestamp with time zone DEFAULT now(),
        "job_work_area_id" varchar(36),
        "work_area_name" varchar(100),
        "local_id" text,
        "qbo_exported_at" timestamp with time zone,
        "qbo_time_activity_id" text,
        "qbo_export_error" text,
        "approval_status" varchar(20) DEFAULT 'pending' NOT NULL,
        "rejection_note" text,
        "auto_clocked_out" boolean DEFAULT false NOT NULL,
        "last_reminder_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gps_pings" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar(36) NOT NULL,
        "time_entry_id" varchar(36),
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "accuracy" real,
        "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_assignments" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "job_id" varchar(36) NOT NULL,
        "employee_id" varchar(36) NOT NULL,
        "scheduled_date" date NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_and_conditions" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "content" text DEFAULT '' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "invoice_number" varchar(50) NOT NULL,
        "customer_id" uuid,
        "job_id" varchar(36),
        "status" varchar(30) DEFAULT 'draft' NOT NULL,
        "issued_date" date DEFAULT CURRENT_DATE NOT NULL,
        "due_date" date,
        "subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
        "tax_rate" numeric(5, 4) DEFAULT '0',
        "tax_amount" numeric(10, 2) DEFAULT '0',
        "discount_amount" numeric(10, 2) DEFAULT '0',
        "total" numeric(10, 2) DEFAULT '0' NOT NULL,
        "amount_paid" numeric(10, 2) DEFAULT '0',
        "balance_due" numeric(10, 2) DEFAULT '0',
        "notes" text,
        "terms" text,
        "customer_message" text,
        "customer_response" text,
        "customer_response_at" timestamp with time zone,
        "customer_response_note" text,
        "sent_at" timestamp with time zone,
        "viewed_at" timestamp with time zone,
        "paid_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        "qb_invoice_id" varchar(50),
        "qb_synced_at" timestamp with time zone,
        "estimate_id" text,
        "invoice_type" varchar(50) DEFAULT 'standard',
        CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_line_items" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "invoice_id" varchar(36) NOT NULL,
        "description" text DEFAULT '' NOT NULL,
        "quantity" numeric(10, 2) DEFAULT '1',
        "unit_price" numeric(10, 2) DEFAULT '0',
        "amount" numeric(10, 2) DEFAULT '0',
        "sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "invoice_id" varchar(36) NOT NULL,
        "customer_id" uuid,
        "amount" numeric(10, 2) NOT NULL,
        "payment_method" varchar(30) DEFAULT 'cash',
        "payment_date" date DEFAULT CURRENT_DATE NOT NULL,
        "reference_number" varchar(100),
        "notes" text,
        "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "customer_id" varchar(36);--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "user_id" varchar(36);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gps_pings" ADD CONSTRAINT "gps_pings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gps_pings" ADD CONSTRAINT "gps_pings_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_work_areas" ADD CONSTRAINT "job_work_areas_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_work_areas" ADD CONSTRAINT "job_work_areas_work_area_type_id_work_area_types_id_fk" FOREIGN KEY ("work_area_type_id") REFERENCES "public"."work_area_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_work_area_id_job_work_areas_id_fk" FOREIGN KEY ("job_work_area_id") REFERENCES "public"."job_work_areas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_log_created_at" ON "activity_log" USING btree ("created_at");

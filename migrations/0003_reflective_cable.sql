CREATE TABLE "calculator_definitions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"input_schema" jsonb NOT NULL,
	"formula" jsonb NOT NULL,
	"default_class_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculator_definitions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "calculator_runs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculator_id" varchar(36) NOT NULL,
	"estimate_work_area_id" varchar(36) NOT NULL,
	"inputs" jsonb NOT NULL,
	"output_summary" jsonb NOT NULL,
	"run_by" varchar(36),
	"run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_codes" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_codes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "companycam_photo_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companycam_photo_id" text NOT NULL,
	"tag_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companycam_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companycam_photo_id" text NOT NULL,
	"companycam_project_id" text NOT NULL,
	"photo_url_original" text,
	"photo_url_web" text,
	"photo_url_thumbnail" text,
	"photo_url_web_annotation" text,
	"captured_at" timestamp with time zone,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"creator_companycam_user_id" text,
	"captured_by_email" text,
	"captured_by_name" text,
	"companycam_app_url" text,
	"description" text,
	"internal" boolean DEFAULT false NOT NULL,
	"hash" text,
	"processing_status" text,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companycam_photos_companycam_photo_id_unique" UNIQUE("companycam_photo_id")
);
--> statement-breakpoint
CREATE TABLE "companycam_project_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companycam_project_id" text NOT NULL,
	"label_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companycam_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companycam_project_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"address_street_1" text,
	"address_street_2" text,
	"address_city" text,
	"address_state" text,
	"address_postal_code" text,
	"address_country" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"creator_companycam_user_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"public" boolean DEFAULT true NOT NULL,
	"feature_image_url" text,
	"raw_payload" jsonb,
	"estimate_id" uuid,
	"customer_id" uuid,
	"cc_created_at" timestamp with time zone,
	"cc_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companycam_projects_companycam_project_id_unique" UNIQUE("companycam_project_id")
);
--> statement-breakpoint
CREATE TABLE "companycam_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companycam_user_id" text NOT NULL,
	"email_address" text,
	"first_name" text,
	"last_name" text,
	"phone_number" text,
	"status" text,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companycam_users_companycam_user_id_unique" UNIQUE("companycam_user_id")
);
--> statement-breakpoint
CREATE TABLE "companycam_walkthroughs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companycam_document_id" text NOT NULL,
	"companycam_project_id" text NOT NULL,
	"document_type" text NOT NULL,
	"content" text,
	"cc_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companycam_walkthroughs_companycam_document_id_unique" UNIQUE("companycam_document_id")
);
--> statement-breakpoint
CREATE TABLE "estimate_line_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_work_area_id" varchar(36) NOT NULL,
	"item_type" varchar(20) DEFAULT 'service' NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit" varchar(30),
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"image_hidden" boolean DEFAULT false,
	"class_id" integer
);
--> statement-breakpoint
CREATE TABLE "voice_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"appointment_id" varchar(36),
	"suggested_appointment_id" varchar(36),
	"transcript_text" text,
	"source" text,
	"audio_duration_seconds" integer,
	"recorded_at" timestamp with time zone,
	"recorded_by_email" text,
	"summary_text" text,
	"transcript_format" text DEFAULT 'json' NOT NULL,
	"estimate_id" uuid,
	"customer_id" uuid,
	"suggested_estimate_id" uuid,
	"suggested_customer_id" uuid,
	"link_confirmed_at" timestamp with time zone,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_transcripts_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
DROP INDEX "idx_activity_log_created_at";--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "companycam_project_id" text;--> statement-breakpoint
ALTER TABLE "calculator_definitions" ADD CONSTRAINT "calculator_definitions_default_class_id_class_codes_id_fk" FOREIGN KEY ("default_class_id") REFERENCES "public"."class_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculator_runs" ADD CONSTRAINT "calculator_runs_calculator_id_calculator_definitions_id_fk" FOREIGN KEY ("calculator_id") REFERENCES "public"."calculator_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_class_id_class_codes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_pricing_defaults" ADD CONSTRAINT "class_pricing_defaults_class_id_class_codes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_log_created_at" ON "activity_log" USING btree ("created_at");
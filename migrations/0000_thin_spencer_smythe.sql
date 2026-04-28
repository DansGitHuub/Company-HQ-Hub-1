CREATE TABLE "access_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"requested_role" text NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar(36),
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"event_type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"link" varchar(500),
	"seen_by" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agreement_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_title" text NOT NULL,
	"year" integer NOT NULL,
	"template_body" text NOT NULL,
	"created_by" varchar(36),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_agent_suggestions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"estimated_cost" text DEFAULT '0.00',
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'pending',
	"implemented_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_agent_usage_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(36) NOT NULL,
	"action" text NOT NULL,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"estimated_cost" text DEFAULT '0.00',
	"result_summary" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general',
	"is_enabled" boolean DEFAULT false,
	"last_run_at" timestamp,
	"run_frequency" text DEFAULT 'manual',
	"config_json" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_generation_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar(36),
	"prompt" text NOT NULL,
	"negative_prompt" text,
	"style" text,
	"model" text,
	"requested_size" text,
	"result_media_id" varchar(36),
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_updates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"detailed_content" text,
	"min_role" text DEFAULT 'Customer' NOT NULL,
	"category" text DEFAULT 'feature' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"published_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant_communications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar(36) NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"sent_by" varchar(36),
	"sent_by_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant_notes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar(36) NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar(36),
	"author_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_update_notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"notification_type" text DEFAULT 'updated' NOT NULL,
	"message" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "builder_forms" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'Untitled Form' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"export_target" text DEFAULT 'pdf' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"outcome_type" text DEFAULT 'data_collection' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"audience_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools_and_media" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_connections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_variant" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_processes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general',
	"steps_json" jsonb DEFAULT '[]'::jsonb,
	"notifications_json" jsonb DEFAULT '[]'::jsonb,
	"roles_involved" text[],
	"estimated_duration" text,
	"is_active" boolean DEFAULT true,
	"last_audited_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"calendar_id" text,
	"calendar_name" text,
	"is_connected" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" text DEFAULT 'personal' NOT NULL,
	"start_datetime" timestamp with time zone NOT NULL,
	"end_datetime" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"created_by" varchar(36) NOT NULL,
	"assigned_to" varchar(36),
	"linked_record_type" text,
	"linked_record_id" varchar(36),
	"google_event_id" text,
	"is_company_event" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"spend" integer DEFAULT 0,
	"leads" integer DEFAULT 0,
	"cpl" integer DEFAULT 0,
	"budget" integer DEFAULT 0,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidate_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'Not Sent' NOT NULL,
	"requires_acknowledgment" boolean DEFAULT false,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"completed_at" timestamp,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"name" text NOT NULL,
	"role" text NOT NULL,
	"stage" text DEFAULT 'New Application' NOT NULL,
	"applied_date" timestamp DEFAULT now(),
	"rating" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"job_type" text,
	"work_type" text,
	"source" text,
	"notes" text,
	"interview_date" timestamp,
	"interview_time" text,
	"interview_location" text,
	"interview_type" text,
	"interviewer_name" text,
	"interview_notes" text,
	"interview_rating" integer,
	"interview_recommendation" text,
	"zoom_meeting_url" text,
	"zoom_meeting_id" text,
	"zoom_passcode" text,
	"last_notified_at" timestamp,
	"offer_pay" text,
	"offer_pay_type" text,
	"offer_start_date" text,
	"offer_employment_type" text,
	"offer_schedule" text,
	"offer_benefits" text,
	"offer_notes" text,
	"offer_acceptance_token" text,
	"offer_acceptance_expires_at" timestamp,
	"offer_accepted_at" timestamp,
	"offer_acceptance_signature" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "care_guides" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"pdf_url" text,
	"tags" text[] DEFAULT '{}',
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalog_item_tags" (
	"item_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "catalog_item_tags_item_id_tag_id_pk" PRIMARY KEY("item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_number" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"class" varchar(50),
	"category" varchar(100),
	"units" varchar(50),
	"cost" numeric(10, 2) DEFAULT '0',
	"taxable" boolean DEFAULT true,
	"description" text,
	"sku" varchar(100),
	"other_options" text,
	"image_url" text,
	"image_hidden" boolean DEFAULT false,
	"option_images" jsonb DEFAULT '{}'::jsonb,
	"option_images_hidden" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"qb_item_id" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "catalog_items_item_number_unique" UNIQUE("item_number")
);
--> statement-breakpoint
CREATE TABLE "catalog_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "catalog_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "category_fields" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar(36) NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"help_text" text,
	"options" text[],
	"show_in_public_catalog" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "class_pricing_defaults" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"year" integer NOT NULL,
	"overhead_pct" numeric(5, 4) DEFAULT '0.15' NOT NULL,
	"profit_margin_pct" numeric(5, 4) DEFAULT '0.20' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "class_pricing_defaults_class_id_year_unique" UNIQUE("class_id","year")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logo_url" text,
	"logo_shape" text DEFAULT 'square',
	"logo_corner_radius" integer DEFAULT 0,
	"company_name" text DEFAULT 'Company HQ',
	"sidebar_order" jsonb,
	"ai_images_enabled" boolean DEFAULT true,
	"ai_images_allowed_roles" text[] DEFAULT ARRAY['Admin', 'Manager'],
	"ai_images_daily_limit" integer DEFAULT 10,
	"ai_images_monthly_limit" integer DEFAULT 200,
	"ai_images_watermark_default" boolean DEFAULT true,
	"company_signature" text,
	"hq_content" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "configured_integrations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"software_id" varchar(36),
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"auth_config_json" jsonb,
	"settings_json" jsonb,
	"last_tested_at" timestamp,
	"last_test_result" text,
	"last_test_message" text,
	"last_sync_at" timestamp,
	"sync_frequency" text DEFAULT 'manual',
	"enabled_capabilities" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "corrective_actions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"issued_by_user_id" varchar(36) NOT NULL,
	"date_of_incident" varchar(20) NOT NULL,
	"description_of_issue" text NOT NULL,
	"previous_warnings" boolean DEFAULT false NOT NULL,
	"previous_warnings_description" text,
	"action_taken" varchar(50) NOT NULL,
	"employee_acknowledgment_signature" text,
	"employee_acknowledgment_date" varchar(20),
	"manager_signature" text NOT NULL,
	"manager_signature_date" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'Pending Signature' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_forms" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General',
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_level" text DEFAULT 'All',
	"is_published" boolean DEFAULT false NOT NULL,
	"styling" jsonb,
	"folder_id" varchar(36),
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"job_id" varchar(36),
	"name" text NOT NULL,
	"folder" text DEFAULT 'Other' NOT NULL,
	"url" text,
	"status" text DEFAULT 'Available' NOT NULL,
	"uploaded_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_jobs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"target_employee_id" varchar(36),
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"admin_reply" text,
	"replied_at" timestamp,
	"replied_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_resources" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'guide' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"content" text,
	"file_url" text,
	"file_name" text,
	"cover_image" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_saved_guides" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"guide_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_suggestions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'received' NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_worksheets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitted_by" varchar(36),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"weather_conditions" text[] DEFAULT '{}',
	"customer_name" text DEFAULT '' NOT NULL,
	"date" varchar(20) DEFAULT '' NOT NULL,
	"day_of_week" varchar(15),
	"address_line_1" text,
	"address_line_2" text,
	"estimate_number" varchar(50),
	"contact_phone" varchar(20),
	"foreman_name" text,
	"foreman_arrival_time" varchar(15),
	"foreman_departure_time" varchar(15),
	"foreman_total_hours" varchar(10),
	"foreman_notes" text,
	"team_members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"work_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"punch_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chemical_log" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"equipment_log" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"additional_notes" text,
	"signature_name" text,
	"date_signed" varchar(20),
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"worksheet_session_id" integer,
	"job_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "development_tracker" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_name" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'in_progress',
	"priority" text DEFAULT 'medium',
	"percent_complete" integer DEFAULT 0,
	"description" text,
	"current_state" text,
	"remaining_work" text,
	"blockers" text,
	"suggestions" text,
	"additional_info" text,
	"last_updated" timestamp DEFAULT now(),
	"updated_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar(36) NOT NULL,
	"linked_entity_type" text NOT NULL,
	"linked_entity_id" text NOT NULL,
	"linked_by_user_id" varchar(36),
	"linked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_shares" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar(36) NOT NULL,
	"module" text NOT NULL,
	"record_id" varchar(36),
	"shared_by_user_id" varchar(36),
	"shared_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"file_size_kb" integer,
	"category" text DEFAULT 'other' NOT NULL,
	"uploaded_by_user_id" varchar(36),
	"home_entity_type" text NOT NULL,
	"home_entity_id" text NOT NULL,
	"description" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_agreements" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"template_id" varchar(36) NOT NULL,
	"sent_by_user_id" varchar(36) NOT NULL,
	"token" text,
	"token_expires_at" timestamp,
	"sent_at" timestamp DEFAULT now(),
	"signed_at" timestamp,
	"signature_data_url" text,
	"signer_name" text,
	"pay_rate" text,
	"start_date" varchar(20),
	"rendered_body" text,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "employee_agreements_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'Not Sent' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"change_type" text NOT NULL,
	"details" text NOT NULL,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_notes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar(36),
	"author_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_pay_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"old_rate" text,
	"new_rate" text,
	"reason" text,
	"approved_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"candidate_id" varchar(36),
	"employee_number" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"pronouns" text,
	"date_of_birth" text,
	"personal_email" text,
	"personal_phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"emergency_contact_name" text,
	"emergency_contact_relationship" text,
	"emergency_contact_phone" text,
	"emergency_contact2_name" text,
	"emergency_contact2_relationship" text,
	"emergency_contact2_phone" text,
	"profile_photo" text,
	"job_title" text,
	"department" text,
	"employment_type" text DEFAULT 'Full-time',
	"start_date" text,
	"end_date" text,
	"supervisor" text,
	"work_location" text,
	"status" text DEFAULT 'Active',
	"pay_rate" text,
	"pay_type" text,
	"pay_period" text,
	"payment_method" text,
	"bank_name_last4" text,
	"account_last4" text,
	"routing_last4" text,
	"account_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"asset_id" text,
	"category" text,
	"year" integer,
	"make" text,
	"model" text,
	"vin" text,
	"serial_number" text,
	"license_plate" text,
	"mileage" integer,
	"hours" integer,
	"status" text DEFAULT 'Active' NOT NULL,
	"notes" text,
	"image" text,
	"purchase_date" timestamp,
	"purchase_price" integer,
	"purchased_from" text,
	"condition_at_purchase" text,
	"assigned_to_user_id" varchar(36),
	"primary_location" text,
	"tracking_type" text DEFAULT 'hours',
	"current_hours" integer DEFAULT 0,
	"hours_at_purchase" integer DEFAULT 0,
	"last_hours_update" timestamp,
	"registration_expiry" timestamp,
	"insurance_expiry" timestamp,
	"warranty_expiry" timestamp,
	"primary_photo_url" text,
	"custom_fields" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_uploads" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" varchar(36) NOT NULL,
	"folder" text DEFAULT 'other',
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"work_type" text,
	"description" text,
	"uploaded_by" varchar(36),
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_code" text,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"stack_trace" text,
	"endpoint" text,
	"http_method" text,
	"status_code" integer,
	"user_id" varchar(36),
	"user_role" text,
	"request_body" text,
	"user_agent" text,
	"ip_address" text,
	"feature" text,
	"severity" text DEFAULT 'error',
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estimate_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" varchar(36) NOT NULL,
	"material_id" varchar(36),
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1',
	"unit_price" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) DEFAULT '0',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estimates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"service_type" text NOT NULL,
	"stage" text DEFAULT 'New Lead' NOT NULL,
	"estimated_value" integer DEFAULT 0,
	"description" text,
	"property_address" text,
	"city" text,
	"state" text,
	"zip" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"notes" text,
	"source" text DEFAULT 'manual',
	"work_request_id" varchar(36),
	"assigned_to" varchar(36),
	"customer_id" varchar(36),
	"follow_up_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"issue_date" timestamp DEFAULT now(),
	"sent_date" timestamp,
	"valid_until" timestamp,
	"signature_data" text,
	"signature_type" text,
	"signer_name" text,
	"signer_initials" text,
	"signer_ip" text,
	"signed_at" timestamp,
	"signed_document_url" text
);
--> statement-breakpoint
CREATE TABLE "feature_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"request" text NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_folders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" varchar(36) NOT NULL,
	"submitted_by" varchar(36),
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'submitted',
	"reviewed_by" varchar(36),
	"review_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General',
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"styling" jsonb,
	"folder_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_calendar_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"google_event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_datetime" timestamp with time zone NOT NULL,
	"end_datetime" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"calendar_id" text,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "help_article_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar(36) NOT NULL,
	"reported_by" varchar(36) NOT NULL,
	"report_type" text DEFAULT 'outdated' NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" varchar(36),
	"resolved_at" timestamp,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"min_role" text DEFAULT 'Customer' NOT NULL,
	"tags" text[],
	"related_articles" text[],
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "help_categories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"min_role" text DEFAULT 'Customer' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hiring_email_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hiring_email_templates_stage_unique" UNIQUE("stage")
);
--> statement-breakpoint
CREATE TABLE "hq_files" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"object_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"uploaded_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hr_form_submissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36),
	"candidate_id" varchar(36),
	"form_type" text NOT NULL,
	"form_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'Not Started' NOT NULL,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_capabilities" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"software_id" varchar(36),
	"name" text NOT NULL,
	"description" text,
	"capability_type" text NOT NULL,
	"direction" text DEFAULT 'both',
	"data_type" text,
	"requires_webhook" boolean DEFAULT false,
	"setup_complexity" text DEFAULT 'simple',
	"estimated_setup_time" text,
	"ai_generated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_research_sessions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"software_name" text NOT NULL,
	"category" text,
	"status" text DEFAULT 'researching' NOT NULL,
	"research_results_json" jsonb,
	"discovered_capabilities" jsonb,
	"suggested_setup_steps" jsonb,
	"estimated_cost" text DEFAULT '0.00',
	"tokens_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "integration_tests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configured_integration_id" varchar(36),
	"test_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"test_steps_json" jsonb,
	"error_details" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"connected" boolean DEFAULT false,
	"api_key" text,
	"last_sync" timestamp,
	CONSTRAINT "integrations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(128) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"applicant_name" text,
	"applicant_email" text,
	"applicant_phone" text,
	"position" text,
	"source" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"candidate_id" varchar(36),
	"expiry_days" integer DEFAULT 30 NOT NULL,
	"created_by" varchar(36),
	"expiry_notification_sent_at" timestamp,
	CONSTRAINT "job_applications_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_pipeline_tabs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client" text NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT 'Install',
	"stage" text DEFAULT 'Lead' NOT NULL,
	"value" integer DEFAULT 0,
	"scheduled_date" timestamp,
	"completion_date" timestamp,
	"is_mandatory_date" boolean DEFAULT false,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"estimated_hours" integer,
	"total_hours" integer,
	"estimated_days" integer,
	"contact_name" text,
	"contact_phone" text,
	"contact_phone_2" text,
	"contact_email" text,
	"zone" text,
	"notes" text,
	"crew_notes_customer_visible" text,
	"crew_lead_name" text,
	"scope_of_work" text,
	"materials_used" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" varchar(36) NOT NULL,
	"schedule_id" varchar(36),
	"log_type" text DEFAULT 'scheduled',
	"name" text NOT NULL,
	"description" text,
	"completed_date" timestamp DEFAULT now() NOT NULL,
	"mileage_at_service" integer,
	"hours_at_service" integer,
	"cost" integer,
	"vendor" text,
	"service_location" text,
	"parts_used" jsonb DEFAULT '[]'::jsonb,
	"labor_cost" integer DEFAULT 0,
	"total_cost" integer DEFAULT 0,
	"receipt_url" text,
	"notes" text,
	"performed_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" varchar(36) NOT NULL,
	"template_id" varchar(36),
	"name" text NOT NULL,
	"description" text,
	"task_description" text,
	"interval_type" text NOT NULL,
	"interval_value" integer NOT NULL,
	"hours_interval" integer,
	"calendar_interval_days" integer,
	"last_completed_date" timestamp,
	"last_completed_mileage" integer,
	"last_completed_hours" integer,
	"last_service_hours" integer,
	"last_service_date" timestamp,
	"next_due_date" timestamp,
	"next_due_mileage" integer,
	"next_due_hours" integer,
	"priority" text DEFAULT 'p4',
	"is_overridden" boolean DEFAULT false,
	"override_notes" text,
	"reminder_days" integer DEFAULT 7,
	"reminder_email" text,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"last_reminder_sent" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"recurring_reminder_days" integer DEFAULT 3,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_categories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "material_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "material_field_values" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" varchar(36) NOT NULL,
	"field_id" varchar(36) NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" varchar(36),
	"status" text DEFAULT 'Active' NOT NULL,
	"primary_image" text,
	"gallery_images" text[],
	"description" text,
	"vendor" text,
	"unit_of_measure" text,
	"tags" text[],
	"category" text,
	"sku" text,
	"stock" integer DEFAULT 0,
	"unit" text,
	"price" integer,
	"image" text,
	"material_type" text,
	"weight" integer,
	"weight_unit" text,
	"coverage_area" integer,
	"coverage_unit" text,
	"supplier" text,
	"supplier_contact" text,
	"supplier_url" text,
	"calculation_formula" text,
	"crew_notes" text,
	"customer_notes" text,
	"ai_generated" boolean DEFAULT false,
	"class" varchar(50),
	"cost" numeric(10, 2),
	"markup" numeric(5, 2),
	"taxable" boolean DEFAULT false,
	"tax_rate" numeric(5, 4) DEFAULT '0.0825',
	"overhead_override" numeric(5, 4),
	"profit_margin_override" numeric(5, 4),
	"price_last_updated" timestamp,
	"last_used" timestamp,
	"retired" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"qb_item_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "messaging_threads" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"assigned_employee_id" varchar(36),
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal',
	"last_message_at" timestamp DEFAULT now(),
	"last_message_by" varchar(36),
	"unread_by_customer" boolean DEFAULT false,
	"unread_by_employee" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"closed_at" timestamp,
	"closed_by" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"title" text,
	"body" text,
	"color" text DEFAULT 'default',
	"is_pinned" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"tags" text[] DEFAULT '{}',
	"reminder_at" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oem_maintenance_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"task_name" text NOT NULL,
	"task_description" text,
	"hours_interval" integer,
	"calendar_interval_days" integer,
	"priority_level" text DEFAULT 'p3',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_form_submissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_type" text NOT NULL,
	"employee_id" varchar(36),
	"submitted_by_user_id" varchar(36),
	"submission_data" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"pdf_document_id" varchar(36),
	"submitted_at" timestamp,
	"reviewed_by_user_id" varchar(36),
	"reviewed_at" timestamp,
	"review_notes" text,
	"assigned_by_user_id" varchar(36),
	"assigned_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"assigned_to" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdf_forms" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Untitled PDF' NOT NULL,
	"file_key" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"form_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plow_site_groups" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#3b82f6',
	"group_type" text DEFAULT 'custom',
	"sort_order" integer DEFAULT 0,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plow_site_images" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" varchar(36) NOT NULL,
	"image_url" text NOT NULL,
	"title" text,
	"annotations" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plow_site_manager_permissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"can_edit" boolean DEFAULT false,
	"granted_by" varchar(36),
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "plow_site_manager_permissions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "plow_sites" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" text,
	"longitude" text,
	"group_id" varchar(36),
	"image_url" text,
	"image_source" text DEFAULT 'google',
	"annotations" jsonb DEFAULT '[]'::jsonb,
	"instructions" jsonb DEFAULT '[]'::jsonb,
	"is_published" boolean DEFAULT false,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "process_audit_results" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" varchar(36) NOT NULL,
	"agent_id" varchar(36),
	"status" text DEFAULT 'pending',
	"audit_phase" text DEFAULT 'pending',
	"overall_score" integer,
	"efficiency_score" integer,
	"reliability_score" integer,
	"customer_experience_score" integer,
	"communication_score" integer,
	"findings_json" jsonb DEFAULT '[]'::jsonb,
	"recommendations_json" jsonb DEFAULT '[]'::jsonb,
	"suggested_steps_json" jsonb DEFAULT '[]'::jsonb,
	"connector_issues_json" jsonb DEFAULT '[]'::jsonb,
	"best_practices_json" jsonb DEFAULT '[]'::jsonb,
	"estimated_improvement_time" text,
	"estimated_cost" text DEFAULT '0.00',
	"tokens_used" integer DEFAULT 0,
	"run_duration_ms" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "process_audit_schedules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" varchar(36) NOT NULL,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"custom_interval_days" integer DEFAULT 7,
	"is_enabled" boolean DEFAULT true,
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"last_audit_id" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qualified_leads" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"company_name" text,
	"property_type" text NOT NULL,
	"service_type" text NOT NULL,
	"project_size" text NOT NULL,
	"budget" text,
	"timeline" text,
	"source" text,
	"location" text,
	"notes" text,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"rating" text DEFAULT 'cold' NOT NULL,
	"qualified_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "repair_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar(36) NOT NULL,
	"reported_by_user_id" varchar(36),
	"report_date" timestamp DEFAULT now(),
	"problem_description" text NOT NULL,
	"severity" text DEFAULT 'minor' NOT NULL,
	"is_usable" text DEFAULT 'yes' NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" varchar(36),
	"shop_name" text,
	"drop_off_date" timestamp,
	"expected_return" timestamp,
	"resolution_description" text,
	"resolution_date" timestamp,
	"total_repair_cost" integer DEFAULT 0,
	"receipt_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "resignation_letters" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"last_day_of_work" varchar(20) NOT NULL,
	"reason_for_leaving" text,
	"additional_notes" text,
	"signature_data_url" text NOT NULL,
	"signature_date" varchar(20) NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_resources" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"resource_id" varchar(36) NOT NULL,
	"saved_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_link_access_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shared_link_id" varchar(36) NOT NULL,
	"accessed_at" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "shared_links" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"document_type" text NOT NULL,
	"document_id" text NOT NULL,
	"document_name" text NOT NULL,
	"document_url" text,
	"created_by" varchar(36) NOT NULL,
	"created_by_name" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"password_hash" text,
	"note" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "shared_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_map_features" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" varchar(36) NOT NULL,
	"name" text,
	"feature_type" text DEFAULT 'point' NOT NULL,
	"geojson" jsonb NOT NULL,
	"color" text DEFAULT '#ef4444',
	"icon" text,
	"linked_photo_id" varchar(36),
	"sort_order" integer DEFAULT 0,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_photo_variants" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" varchar(36) NOT NULL,
	"name" text DEFAULT 'Variant A' NOT NULL,
	"annotations" jsonb DEFAULT '[]'::jsonb,
	"flattened_url" text,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_photos" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" varchar(36) NOT NULL,
	"image_url" text NOT NULL,
	"title" text,
	"source" text DEFAULT 'upload',
	"width" integer,
	"height" integer,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"sort_order" integer DEFAULT 0,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "software_integrations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website_url" text,
	"api_docs_url" text,
	"auth_type" text DEFAULT 'api_key',
	"is_popular" boolean DEFAULT false,
	"ai_researched_at" timestamp,
	"capabilities_json" jsonb,
	"setup_instructions_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_categories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_drafts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(36) NOT NULL,
	"title" text DEFAULT 'Untitled Draft' NOT NULL,
	"category_id" varchar(36),
	"sop_type" text,
	"current_step" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_examples" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_url" text,
	"source_file" text,
	"category_id" varchar(36),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_media" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sop_id" varchar(36),
	"step_index" integer,
	"placement" text DEFAULT 'header' NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"alt" text,
	"source" text DEFAULT 'upload' NOT NULL,
	"ai_prompt" text,
	"ai_style" text,
	"ai_negative_prompt" text,
	"ai_model" text,
	"ai_watermarked" boolean DEFAULT true,
	"metadata" jsonb,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_pipeline" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"category_id" varchar(36),
	"sop_type" text DEFAULT 'standard' NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"ai_context" jsonb,
	"rejected_reason" text,
	"generated_sop_id" varchar(36),
	"suggested_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"scheduled_for" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sop_pipeline_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_generate_enabled" boolean DEFAULT false NOT NULL,
	"generate_frequency" text DEFAULT 'daily' NOT NULL,
	"max_per_run" integer DEFAULT 1 NOT NULL,
	"last_auto_run" timestamp,
	"next_scheduled_run" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_quiz_questions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" varchar(36) NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"is_standard" boolean DEFAULT false NOT NULL,
	"explanation" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"difficulty_level" integer DEFAULT 1 NOT NULL,
	"audience_roles" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sop_quizzes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sop_id" varchar(36) NOT NULL,
	"skill_level" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"question_count" integer DEFAULT 0 NOT NULL,
	"min_pass_level" integer DEFAULT 2 NOT NULL,
	"is_safety_critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"category_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sop_versions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sop_id" varchar(36) NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"structured_data" jsonb,
	"saved_by" varchar(36),
	"change_summary" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sops" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"category_id" varchar(36),
	"super_category" text,
	"sub_category" text,
	"sop_type" text,
	"content" text NOT NULL,
	"structured_data" jsonb,
	"owner_id" varchar(36),
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"file_name" text,
	"file_size" integer,
	"uploaded_by" varchar(36),
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"item_text" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_by" varchar(36),
	"completed_at" timestamp,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_custom_fields" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"field_name" text NOT NULL,
	"field_value" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_delegation_chain" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"from_user_id" varchar(36) NOT NULL,
	"to_user_id" varchar(36) NOT NULL,
	"delegated_at" timestamp DEFAULT now(),
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "task_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"event_type" text NOT NULL,
	"changed_by_user_id" varchar(36),
	"old_value" text,
	"new_value" text,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'standard' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"created_by_user_id" varchar(36) NOT NULL,
	"assigned_to_user_id" varchar(36),
	"due_date" timestamp,
	"start_date" timestamp,
	"due_time" text,
	"category" text,
	"estimated_minutes" integer,
	"location" text,
	"linked_record_type" text,
	"linked_record_id" varchar(36),
	"reminder_date" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"requires_confirmation" boolean DEFAULT false,
	"completion_notes" text,
	"completion_photo_url" text,
	"is_recurring" boolean DEFAULT false,
	"recurring_config" jsonb,
	"parent_task_id" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"confirmed_at" timestamp,
	"cancelled_at" timestamp,
	CONSTRAINT "tasks_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "thread_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar(36) NOT NULL,
	"sender_id" varchar(36) NOT NULL,
	"sender_role" text NOT NULL,
	"content" text NOT NULL,
	"is_internal_note" boolean DEFAULT false,
	"attachments" text[],
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"employee_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"date" date NOT NULL,
	"clock_in_time" timestamp with time zone NOT NULL,
	"clock_out_time" timestamp with time zone,
	"total_minutes" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"signature_name" text,
	"signed_at" timestamp with time zone,
	"submitted_at" timestamp,
	"qbo_exported_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"start_date" varchar(20) NOT NULL,
	"end_date" varchar(20) NOT NULL,
	"total_days" integer NOT NULL,
	"notes" text,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"reviewed_by" varchar(36),
	"reviewed_at" timestamp,
	"review_notes" text,
	"submitted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "todo_active_users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"activated_by" varchar(36),
	"activated_at" timestamp DEFAULT now(),
	CONSTRAINT "todo_active_users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "todo_assignments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"is_read" boolean DEFAULT false,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "todo_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" varchar(36) NOT NULL,
	"changed_by" varchar(36),
	"change_type" text NOT NULL,
	"field_changed" text,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'pending',
	"due_date" timestamp,
	"reminder_date" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"linked_record_type" text,
	"linked_record_id" varchar(36),
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_calendar_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"category_key" text NOT NULL,
	"display_name" text NOT NULL,
	"color" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_quiz_attempts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"answers" jsonb NOT NULL,
	"questions_served" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_difficulty" integer DEFAULT 1 NOT NULL,
	"highest_level_passed" integer DEFAULT 0 NOT NULL,
	"final_score_label" text,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_update_acknowledgments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"update_id" varchar(36) NOT NULL,
	"acknowledged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'Customer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_master_admin" boolean DEFAULT false NOT NULL,
	"is_applicant" boolean DEFAULT false NOT NULL,
	"recovery_token" text,
	"recovery_expires" timestamp,
	"stored_password" text,
	"bio" text,
	"phone" text,
	"profile_picture" text,
	"theme" text DEFAULT 'forest',
	"email_notifications" boolean DEFAULT true NOT NULL,
	"google_access_token" text,
	"google_refresh_token" text,
	"google_calendar_id" text DEFAULT 'primary',
	"google_token_expiry" timestamp with time zone,
	"voice_enabled" boolean DEFAULT false NOT NULL,
	"voice_auto_speak" boolean DEFAULT false NOT NULL,
	"voice_selection" text DEFAULT 'alloy',
	"language" text DEFAULT 'en',
	"dashboard_widgets" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"service_type" text NOT NULL,
	"property_address" text,
	"preferred_date" timestamp,
	"urgency" text DEFAULT 'normal',
	"photos" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(36),
	"estimated_value" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worksheet_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"worksheet_id" varchar(36) NOT NULL,
	"description" text,
	"amount" numeric,
	"category" text,
	"receipt_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worksheet_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"worksheet_id" varchar(36) NOT NULL,
	"material_name" text,
	"quantity" numeric,
	"unit" text,
	"unit_cost" numeric,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worksheet_materials_used" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"material_id" varchar(36),
	"misc_name" text,
	"quantity" numeric NOT NULL,
	"unit" text,
	"notes" text,
	"receipt_photos" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worksheet_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"photo_url" text NOT NULL,
	"photo_type" text NOT NULL,
	"caption" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worksheet_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_duplicate" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "worksheet_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"worksheet_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "worksheet_team_members_ws_user_uidx" UNIQUE("worksheet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "worksheet_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"work_area_id" varchar(36),
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worksheets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"job_id" varchar(36),
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"signature_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "worksheets_user_date_uidx" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_templates" ADD CONSTRAINT "agreement_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_suggestions" ADD CONSTRAINT "ai_agent_suggestions_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_usage_logs" ADD CONSTRAINT "ai_agent_usage_logs_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation_events" ADD CONSTRAINT "ai_generation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_communications" ADD CONSTRAINT "applicant_communications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_communications" ADD CONSTRAINT "applicant_communications_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_notes" ADD CONSTRAINT "applicant_notes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_notes" ADD CONSTRAINT "applicant_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_update_notifications" ADD CONSTRAINT "article_update_notifications_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_update_notifications" ADD CONSTRAINT "article_update_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_forms" ADD CONSTRAINT "builder_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_guides" ADD CONSTRAINT "care_guides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_item_tags" ADD CONSTRAINT "catalog_item_tags_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_item_tags" ADD CONSTRAINT "catalog_item_tags_tag_id_catalog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."catalog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_fields" ADD CONSTRAINT "category_fields_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configured_integrations" ADD CONSTRAINT "configured_integrations_software_id_software_integrations_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."software_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_jobs" ADD CONSTRAINT "customer_jobs_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_jobs" ADD CONSTRAINT "customer_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_target_employee_id_users_id_fk" FOREIGN KEY ("target_employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_resources" ADD CONSTRAINT "customer_resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_saved_guides" ADD CONSTRAINT "customer_saved_guides_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_saved_guides" ADD CONSTRAINT "customer_saved_guides_guide_id_care_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."care_guides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_suggestions" ADD CONSTRAINT "customer_suggestions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_worksheets" ADD CONSTRAINT "daily_worksheets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_worksheets" ADD CONSTRAINT "daily_worksheets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_tracker" ADD CONSTRAINT "development_tracker_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_shared_by_user_id_users_id_fk" FOREIGN KEY ("shared_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_template_id_agreement_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."agreement_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_pay_history" ADD CONSTRAINT "employee_pay_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_uploads" ADD CONSTRAINT "equipment_uploads_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_uploads" ADD CONSTRAINT "equipment_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_folder_id_form_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."form_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_reports" ADD CONSTRAINT "help_article_reports_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_reports" ADD CONSTRAINT "help_article_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_reports" ADD CONSTRAINT "help_article_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_files" ADD CONSTRAINT "hq_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_form_submissions" ADD CONSTRAINT "hr_form_submissions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_form_submissions" ADD CONSTRAINT "hr_form_submissions_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_capabilities" ADD CONSTRAINT "integration_capabilities_software_id_software_integrations_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."software_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_tests" ADD CONSTRAINT "integration_tests_configured_integration_id_configured_integrations_id_fk" FOREIGN KEY ("configured_integration_id") REFERENCES "public"."configured_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_field_values" ADD CONSTRAINT "material_field_values_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_field_values" ADD CONSTRAINT "material_field_values_field_id_category_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."category_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_assigned_employee_id_users_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_last_message_by_users_id_fk" FOREIGN KEY ("last_message_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_form_submissions" ADD CONSTRAINT "onboarding_form_submissions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_form_submissions" ADD CONSTRAINT "onboarding_form_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_form_submissions" ADD CONSTRAINT "onboarding_form_submissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_form_submissions" ADD CONSTRAINT "onboarding_form_submissions_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_items" ADD CONSTRAINT "onboarding_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_forms" ADD CONSTRAINT "pdf_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plow_site_groups" ADD CONSTRAINT "plow_site_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plow_site_images" ADD CONSTRAINT "plow_site_images_site_id_plow_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."plow_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plow_site_manager_permissions" ADD CONSTRAINT "plow_site_manager_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plow_site_manager_permissions" ADD CONSTRAINT "plow_site_manager_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plow_sites" ADD CONSTRAINT "plow_sites_group_id_plow_site_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."plow_site_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plow_sites" ADD CONSTRAINT "plow_sites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_audit_results" ADD CONSTRAINT "process_audit_results_process_id_business_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."business_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_audit_results" ADD CONSTRAINT "process_audit_results_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_audit_schedules" ADD CONSTRAINT "process_audit_schedules_process_id_business_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."business_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualified_leads" ADD CONSTRAINT "qualified_leads_qualified_by_users_id_fk" FOREIGN KEY ("qualified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_asset_id_equipment_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resignation_letters" ADD CONSTRAINT "resignation_letters_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_resources" ADD CONSTRAINT "saved_resources_resource_id_customer_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."customer_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_link_access_logs" ADD CONSTRAINT "shared_link_access_logs_shared_link_id_shared_links_id_fk" FOREIGN KEY ("shared_link_id") REFERENCES "public"."shared_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_map_features" ADD CONSTRAINT "site_map_features_site_id_plow_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."plow_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_map_features" ADD CONSTRAINT "site_map_features_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photo_variants" ADD CONSTRAINT "site_photo_variants_photo_id_site_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."site_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photo_variants" ADD CONSTRAINT "site_photo_variants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_site_id_plow_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."plow_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_drafts" ADD CONSTRAINT "sop_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_examples" ADD CONSTRAINT "sop_examples_category_id_sop_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sop_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_media" ADD CONSTRAINT "sop_media_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_media" ADD CONSTRAINT "sop_media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_pipeline" ADD CONSTRAINT "sop_pipeline_category_id_sop_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sop_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_pipeline" ADD CONSTRAINT "sop_pipeline_generated_sop_id_sops_id_fk" FOREIGN KEY ("generated_sop_id") REFERENCES "public"."sops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_quiz_questions" ADD CONSTRAINT "sop_quiz_questions_quiz_id_sop_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."sop_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_quizzes" ADD CONSTRAINT "sop_quizzes_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_templates" ADD CONSTRAINT "sop_templates_category_id_sop_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sop_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_versions" ADD CONSTRAINT "sop_versions_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_versions" ADD CONSTRAINT "sop_versions_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sops" ADD CONSTRAINT "sops_category_id_sop_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sop_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sops" ADD CONSTRAINT "sops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_custom_fields" ADD CONSTRAINT "task_custom_fields_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_delegation_chain" ADD CONSTRAINT "task_delegation_chain_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_delegation_chain" ADD CONSTRAINT "task_delegation_chain_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_delegation_chain" ADD CONSTRAINT "task_delegation_chain_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_messaging_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."messaging_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_cards" ADD CONSTRAINT "time_cards_session_id_worksheet_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."worksheet_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_cards" ADD CONSTRAINT "time_cards_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_cards" ADD CONSTRAINT "time_cards_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_active_users" ADD CONSTRAINT "todo_active_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_active_users" ADD CONSTRAINT "todo_active_users_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_assignments" ADD CONSTRAINT "todo_assignments_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_assignments" ADD CONSTRAINT "todo_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_history" ADD CONSTRAINT "todo_history_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_history" ADD CONSTRAINT "todo_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_calendar_settings" ADD CONSTRAINT "user_calendar_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quiz_attempts" ADD CONSTRAINT "user_quiz_attempts_quiz_id_sop_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."sop_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quiz_attempts" ADD CONSTRAINT "user_quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_update_acknowledgments" ADD CONSTRAINT "user_update_acknowledgments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_update_acknowledgments" ADD CONSTRAINT "user_update_acknowledgments_update_id_app_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."app_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_expenses" ADD CONSTRAINT "worksheet_expenses_worksheet_id_worksheets_id_fk" FOREIGN KEY ("worksheet_id") REFERENCES "public"."worksheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_materials" ADD CONSTRAINT "worksheet_materials_worksheet_id_worksheets_id_fk" FOREIGN KEY ("worksheet_id") REFERENCES "public"."worksheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_materials_used" ADD CONSTRAINT "worksheet_materials_used_session_id_worksheet_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."worksheet_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_materials_used" ADD CONSTRAINT "worksheet_materials_used_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_photos" ADD CONSTRAINT "worksheet_photos_session_id_worksheet_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."worksheet_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_sessions" ADD CONSTRAINT "worksheet_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_sessions" ADD CONSTRAINT "worksheet_sessions_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_team_members" ADD CONSTRAINT "worksheet_team_members_worksheet_id_worksheets_id_fk" FOREIGN KEY ("worksheet_id") REFERENCES "public"."worksheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_team_members" ADD CONSTRAINT "worksheet_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_time_entries" ADD CONSTRAINT "worksheet_time_entries_session_id_worksheet_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."worksheet_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheet_time_entries" ADD CONSTRAINT "worksheet_time_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheets" ADD CONSTRAINT "worksheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksheets" ADD CONSTRAINT "worksheets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
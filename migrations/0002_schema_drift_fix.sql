DROP INDEX "idx_activity_log_created_at";--> statement-breakpoint
ALTER TABLE "gps_pings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_assignments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_work_areas" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "process_audit_schedules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "terms_and_conditions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "work_area_types" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "idx_activity_log_created_at" ON "activity_log" USING btree ("created_at" DESC NULLS LAST);
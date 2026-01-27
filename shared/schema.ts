import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type Role = "Admin" | "Manager" | "Crew" | "Customer";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Customer"),
  isActive: boolean("is_active").notNull().default(true),
  isMasterAdmin: boolean("is_master_admin").notNull().default(false),
  isApplicant: boolean("is_applicant").notNull().default(false),
  recoveryToken: text("recovery_token"),
  recoveryExpires: timestamp("recovery_expires"),
  bio: text("bio"),
  phone: text("phone"),
  profilePicture: text("profile_picture"),
  theme: text("theme").default("forest"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const sopCategories = pgTable("sop_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSopCategorySchema = createInsertSchema(sopCategories).pick({
  name: true,
  sortOrder: true,
});

export type InsertSopCategory = z.infer<typeof insertSopCategorySchema>;
export type SopCategory = typeof sopCategories.$inferSelect;

export const sops = pgTable("sops", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(),
  categoryId: varchar("category_id", { length: 36 }).references(() => sopCategories.id),
  content: text("content").notNull(),
  ownerId: varchar("owner_id", { length: 36 }).references(() => users.id),
  isArchived: boolean("is_archived").notNull().default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertSopSchema = createInsertSchema(sops).pick({
  title: true,
  category: true,
  categoryId: true,
  content: true,
  ownerId: true,
});

export type InsertSop = z.infer<typeof insertSopSchema>;
export type Sop = typeof sops.$inferSelect;

// SOP Templates for quick creation
export const sopTemplates = pgTable("sop_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  categoryId: varchar("category_id", { length: 36 }).references(() => sopCategories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSopTemplateSchema = createInsertSchema(sopTemplates).pick({
  name: true,
  description: true,
  content: true,
  categoryId: true,
});

export type InsertSopTemplate = z.infer<typeof insertSopTemplateSchema>;
export type SopTemplate = typeof sopTemplates.$inferSelect;

// Example SOPs from external sources for reference
export const sopExamples = pgTable("sop_examples", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"),
  sourceFile: text("source_file"),
  categoryId: varchar("category_id", { length: 36 }).references(() => sopCategories.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSopExampleSchema = createInsertSchema(sopExamples).pick({
  title: true,
  description: true,
  sourceUrl: true,
  sourceFile: true,
  categoryId: true,
  notes: true,
});

export type InsertSopExample = z.infer<typeof insertSopExampleSchema>;
export type SopExample = typeof sopExamples.$inferSelect;

// Material Categories - editable by admin, always alphabetically sorted
export const materialCategories = pgTable("material_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaterialCategorySchema = createInsertSchema(materialCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertMaterialCategory = z.infer<typeof insertMaterialCategorySchema>;
export type MaterialCategory = typeof materialCategories.$inferSelect;

// Category Fields - dynamic fields per category
export type FieldType = "text" | "number" | "dropdown" | "multiselect" | "boolean" | "date" | "textarea" | "image" | "file" | "url";

export const categoryFields = pgTable("category_fields", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id", { length: 36 }).references(() => materialCategories.id, { onDelete: "cascade" }).notNull(),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").$type<FieldType>().notNull(),
  required: boolean("required").notNull().default(false),
  defaultValue: text("default_value"),
  helpText: text("help_text"),
  options: text("options").array(), // For dropdown/multiselect
  showInPublicCatalog: boolean("show_in_public_catalog").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCategoryFieldSchema = createInsertSchema(categoryFields).omit({
  id: true,
  createdAt: true,
});

export type InsertCategoryField = z.infer<typeof insertCategoryFieldSchema>;
export type CategoryField = typeof categoryFields.$inferSelect;

// Materials - with both legacy and new dynamic field support
export const materials = pgTable("materials", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // New category system
  categoryId: varchar("category_id", { length: 36 }).references(() => materialCategories.id),
  status: text("status").notNull().default("Active"), // Active or Inactive
  primaryImage: text("primary_image"),
  galleryImages: text("gallery_images").array(),
  description: text("description"),
  vendor: text("vendor"),
  unitOfMeasure: text("unit_of_measure"),
  tags: text("tags").array(),
  // Legacy fields kept for backward compatibility
  category: text("category"),
  sku: text("sku"),
  stock: integer("stock").default(0),
  unit: text("unit"),
  price: integer("price"),
  image: text("image"),
  materialType: text("material_type"),
  weight: integer("weight"),
  weightUnit: text("weight_unit"),
  coverageArea: integer("coverage_area"),
  coverageUnit: text("coverage_unit"),
  supplier: text("supplier"),
  supplierContact: text("supplier_contact"),
  supplierUrl: text("supplier_url"),
  calculationFormula: text("calculation_formula"),
  crewNotes: text("crew_notes"),
  customerNotes: text("customer_notes"),
  aiGenerated: boolean("ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// Material Field Values - stores dynamic field values per material
export const materialFieldValues = pgTable("material_field_values", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id", { length: 36 }).references(() => materials.id, { onDelete: "cascade" }).notNull(),
  fieldId: varchar("field_id", { length: 36 }).references(() => categoryFields.id, { onDelete: "cascade" }).notNull(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaterialFieldValueSchema = createInsertSchema(materialFieldValues).omit({
  id: true,
  createdAt: true,
});

export type InsertMaterialFieldValue = z.infer<typeof insertMaterialFieldValueSchema>;
export type MaterialFieldValue = typeof materialFieldValues.$inferSelect;

export type CandidateJobType = "Crew Member" | "Crew Lead" | "Manager" | "Office" | "Sales";
export type CandidateWorkType = "Maintenance" | "Project";
export type CandidateRating = "green" | "yellow" | "red" | null;

export const candidates = pgTable("candidates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  stage: text("stage").notNull().default("Applied"),
  appliedDate: timestamp("applied_date").defaultNow(),
  rating: text("rating").$type<CandidateRating>(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  jobType: text("job_type").$type<CandidateJobType>(),
  workType: text("work_type").$type<CandidateWorkType>(),
  notes: text("notes"),
  lastNotifiedAt: timestamp("last_notified_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidates).pick({
  userId: true,
  name: true,
  role: true,
  stage: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  jobType: true,
  workType: true,
  notes: true,
  rating: true,
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

// Candidate Documents (uploaded files like license, W-4, etc.)
export const candidateDocuments = pgTable("candidate_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id", { length: 36 }).references(() => candidates.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // license, application, w4, handbook, etc.
  url: text("url").notNull(),
  requiresAcknowledgment: boolean("requires_acknowledgment").default(false),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertCandidateDocumentSchema = createInsertSchema(candidateDocuments).pick({
  candidateId: true,
  name: true,
  type: true,
  url: true,
  requiresAcknowledgment: true,
});

export type InsertCandidateDocument = z.infer<typeof insertCandidateDocumentSchema>;
export type CandidateDocument = typeof candidateDocuments.$inferSelect;

export const campaigns = pgTable("campaigns", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("Draft"),
  spend: integer("spend").default(0),
  leads: integer("leads").default(0),
  cpl: integer("cpl").default(0),
});

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  platform: true,
  status: true,
  spend: true,
  leads: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type JobCategory = "Install" | "Maintenance" | string;

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  client: text("client").notNull(),
  type: text("type").notNull(),
  category: text("category").$type<JobCategory>().default("Install"),
  stage: text("stage").notNull().default("Lead"),
  value: integer("value").default(0),
  scheduledDate: timestamp("scheduled_date"),
  completionDate: timestamp("completion_date"),
  isMandatoryDate: boolean("is_mandatory_date").default(false),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  estimatedHours: integer("estimated_hours"),
  estimatedDays: integer("estimated_days"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactPhone2: text("contact_phone_2"),
  contactEmail: text("contact_email"),
  zone: text("zone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  client: true,
  type: true,
  category: true,
  stage: true,
  value: true,
  scheduledDate: true,
  completionDate: true,
  isMandatoryDate: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  estimatedHours: true,
  estimatedDays: true,
  contactName: true,
  contactPhone: true,
  contactPhone2: true,
  contactEmail: true,
  zone: true,
  notes: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Job Documents (permits, OUPS, contracts, designs, etc.)
export const jobDocuments = pgTable("job_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // permit, oups, contract, design, sketch, other
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertJobDocumentSchema = createInsertSchema(jobDocuments).pick({
  jobId: true,
  name: true,
  type: true,
  url: true,
});

export type InsertJobDocument = z.infer<typeof insertJobDocumentSchema>;
export type JobDocument = typeof jobDocuments.$inferSelect;

// Job Pipeline Tabs (for organizing jobs by custom categories)
export const jobPipelineTabs = pgTable("job_pipeline_tabs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobPipelineTabSchema = createInsertSchema(jobPipelineTabs).pick({
  name: true,
  sortOrder: true,
});

export type InsertJobPipelineTab = z.infer<typeof insertJobPipelineTabSchema>;
export type JobPipelineTab = typeof jobPipelineTabs.$inferSelect;

export const integrations = pgTable("integrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  connected: boolean("connected").default(false),
  apiKey: text("api_key"),
  lastSync: timestamp("last_sync"),
});

export const featureRequests = pgTable("feature_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  request: text("request").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeatureRequestSchema = createInsertSchema(featureRequests).pick({
  userId: true,
  request: true,
});

export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;
export type FeatureRequest = typeof featureRequests.$inferSelect;

export const customerMessages = pgTable("customer_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  targetEmployeeId: varchar("target_employee_id", { length: 36 }).references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"),
  adminReply: text("admin_reply"),
  repliedAt: timestamp("replied_at"),
  repliedBy: varchar("replied_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerMessageSchema = createInsertSchema(customerMessages).pick({
  customerId: true,
  targetEmployeeId: true,
  subject: true,
  message: true,
});

export type InsertCustomerMessage = z.infer<typeof insertCustomerMessageSchema>;
export type CustomerMessage = typeof customerMessages.$inferSelect;

export const workRequests = pgTable("work_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  serviceType: text("service_type").notNull(),
  propertyAddress: text("property_address"),
  preferredDate: timestamp("preferred_date"),
  urgency: text("urgency").default("normal"),
  photos: text("photos").array(),
  status: text("status").notNull().default("pending"),
  assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id),
  estimatedValue: integer("estimated_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkRequestSchema = createInsertSchema(workRequests).pick({
  customerId: true,
  title: true,
  description: true,
  serviceType: true,
  propertyAddress: true,
  preferredDate: true,
  urgency: true,
  photos: true,
});

export type InsertWorkRequest = z.infer<typeof insertWorkRequestSchema>;
export type WorkRequest = typeof workRequests.$inferSelect;

export const accessRequests = pgTable("access_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  requestedRole: text("requested_role").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAccessRequestSchema = createInsertSchema(accessRequests).pick({
  userId: true,
  requestedRole: true,
  reason: true,
});

export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;
export type AccessRequest = typeof accessRequests.$inferSelect;

export const customForms = pgTable("custom_forms", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("General"),
  fields: jsonb("fields").notNull().default([]),
  accessLevel: text("access_level").default("All"),
  isPublished: boolean("is_published").notNull().default(false),
  styling: jsonb("styling"),
  folderId: varchar("folder_id", { length: 36 }),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomFormSchema = createInsertSchema(customForms).pick({
  title: true,
  description: true,
  category: true,
  fields: true,
  accessLevel: true,
  isPublished: true,
  styling: true,
  folderId: true,
  createdBy: true,
});

export type InsertCustomForm = z.infer<typeof insertCustomFormSchema>;
export type CustomForm = typeof customForms.$inferSelect;

export type FormStyling = {
  fontFamily: string;
  fontSize: string;
  showBorder: boolean;
  borderStyle: string;
};

export type FormField = {
  id: string;
  type: "text" | "textarea" | "number" | "email" | "date" | "select" | "checkbox" | "radio" | "file" | "signature" | "separator";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: string;
};

export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id", { length: 36 }).references(() => customForms.id).notNull(),
  submittedBy: varchar("submitted_by", { length: 36 }).references(() => users.id),
  data: jsonb("data").notNull(),
  status: text("status").default("submitted"),
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).pick({
  formId: true,
  submittedBy: true,
  data: true,
});

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

// Form Folders for organizing forms
export const formFolders = pgTable("form_folders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFormFolderSchema = createInsertSchema(formFolders).pick({
  name: true,
  description: true,
  color: true,
  sortOrder: true,
});

export type InsertFormFolder = z.infer<typeof insertFormFolderSchema>;
export type FormFolder = typeof formFolders.$inferSelect;

// Form Templates for quick form creation
export const formTemplates = pgTable("form_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("General"),
  fields: jsonb("fields").notNull().default([]),
  styling: jsonb("styling"),
  folderId: varchar("folder_id", { length: 36 }).references(() => formFolders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).pick({
  name: true,
  description: true,
  category: true,
  fields: true,
  styling: true,
  folderId: true,
});

export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;

export const conversations = pgTable("conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Equipment Tracker
export type EquipmentType = "Vehicle" | "Equipment";

export const equipment = pgTable("equipment", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // Vehicle or Equipment
  name: text("name").notNull(),
  year: integer("year"),
  make: text("make"),
  model: text("model"),
  vin: text("vin"),
  licensePlate: text("license_plate"),
  mileage: integer("mileage"),
  hours: integer("hours"), // For equipment that tracks hours instead of mileage
  status: text("status").notNull().default("Active"), // Active, In Service, Retired
  notes: text("notes"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEquipmentSchema = createInsertSchema(equipment).pick({
  type: true,
  name: true,
  year: true,
  make: true,
  model: true,
  vin: true,
  licensePlate: true,
  mileage: true,
  hours: true,
  status: true,
  notes: true,
  image: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Maintenance Schedules (recurring maintenance)
export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id", { length: 36 }).references(() => equipment.id).notNull(),
  name: text("name").notNull(), // e.g., "Oil Change", "Tire Rotation"
  description: text("description"),
  intervalType: text("interval_type").notNull(), // "days", "miles", "hours"
  intervalValue: integer("interval_value").notNull(), // e.g., 90 (days) or 5000 (miles)
  lastCompletedDate: timestamp("last_completed_date"),
  lastCompletedMileage: integer("last_completed_mileage"),
  lastCompletedHours: integer("last_completed_hours"),
  nextDueDate: timestamp("next_due_date"),
  nextDueMileage: integer("next_due_mileage"),
  nextDueHours: integer("next_due_hours"),
  reminderDays: integer("reminder_days").default(7), // Days before due date to send reminder
  reminderEmail: text("reminder_email"), // Email to send reminders to
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedules).pick({
  equipmentId: true,
  name: true,
  description: true,
  intervalType: true,
  intervalValue: true,
  lastCompletedDate: true,
  lastCompletedMileage: true,
  lastCompletedHours: true,
  nextDueDate: true,
  nextDueMileage: true,
  nextDueHours: true,
  reminderDays: true,
  reminderEmail: true,
  isActive: true,
});

export type InsertMaintenanceSchedule = z.infer<typeof insertMaintenanceScheduleSchema>;
export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;

// Maintenance Logs (completed maintenance records)
export const maintenanceLogs = pgTable("maintenance_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id", { length: 36 }).references(() => equipment.id).notNull(),
  scheduleId: varchar("schedule_id", { length: 36 }).references(() => maintenanceSchedules.id),
  name: text("name").notNull(),
  description: text("description"),
  completedDate: timestamp("completed_date").notNull().defaultNow(),
  mileageAtService: integer("mileage_at_service"),
  hoursAtService: integer("hours_at_service"),
  cost: integer("cost"), // Cost in cents
  vendor: text("vendor"),
  notes: text("notes"),
  performedBy: varchar("performed_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogs).pick({
  equipmentId: true,
  scheduleId: true,
  name: true,
  description: true,
  completedDate: true,
  mileageAtService: true,
  hoursAtService: true,
  cost: true,
  vendor: true,
  notes: true,
  performedBy: true,
});

export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;

// Equipment Uploads (receipts, photos, documents)
export const equipmentUploads = pgTable("equipment_uploads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id", { length: 36 }).references(() => equipment.id).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(), // image, document, receipt
  workType: text("work_type"), // e.g., "Oil Change", "Tire Replacement", "Repair"
  description: text("description"),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertEquipmentUploadSchema = createInsertSchema(equipmentUploads).pick({
  equipmentId: true,
  fileName: true,
  fileUrl: true,
  fileType: true,
  workType: true,
  description: true,
  uploadedBy: true,
});

export type InsertEquipmentUpload = z.infer<typeof insertEquipmentUploadSchema>;
export type EquipmentUpload = typeof equipmentUploads.$inferSelect;

// Customer Resources (Care Guides, Instructions, Documents)
export type ResourceType = "guide" | "instruction" | "document" | "faq";

export const customerResources = pgTable("customer_resources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("guide"), // guide, instruction, document, faq
  category: text("category").notNull().default("General"),
  content: text("content"), // Rich text content for guides
  fileUrl: text("file_url"), // URL for uploaded documents (PDF, Word)
  fileName: text("file_name"), // Original file name
  coverImage: text("cover_image"), // Cover/thumbnail image
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerResourceSchema = createInsertSchema(customerResources).pick({
  title: true,
  description: true,
  type: true,
  category: true,
  content: true,
  fileUrl: true,
  fileName: true,
  coverImage: true,
  isPublished: true,
  sortOrder: true,
  createdBy: true,
});

export type InsertCustomerResource = z.infer<typeof insertCustomerResourceSchema>;
export type CustomerResource = typeof customerResources.$inferSelect;

// Customer Saved Resources (bookmarks/favorites)
export const savedResources = pgTable("saved_resources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  resourceId: varchar("resource_id", { length: 36 }).references(() => customerResources.id).notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
});

export const insertSavedResourceSchema = createInsertSchema(savedResources).pick({
  userId: true,
  resourceId: true,
});

export type InsertSavedResource = z.infer<typeof insertSavedResourceSchema>;
export type SavedResource = typeof savedResources.$inferSelect;

// Company Settings (logo, branding, etc.)
export type LogoShape = "square" | "rectangle" | "circle";

export const companySettings = pgTable("company_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  logoUrl: text("logo_url"),
  logoShape: text("logo_shape").default("square"),
  logoCornerRadius: integer("logo_corner_radius").default(0),
  companyName: text("company_name").default("Company HQ"),
  sidebarOrder: jsonb("sidebar_order").$type<string[]>(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).pick({
  logoUrl: true,
  logoShape: true,
  logoCornerRadius: true,
  companyName: true,
  sidebarOrder: true,
});

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

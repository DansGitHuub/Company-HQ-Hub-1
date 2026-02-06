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
  storedPassword: text("stored_password"), // Plaintext password for staff (Admin/Manager/Crew) visible to Master Admin
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

// Internal Messaging - threaded conversation system
export const messagingThreads = pgTable("messaging_threads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  assignedEmployeeId: varchar("assigned_employee_id", { length: 36 }).references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  priority: text("priority").default("normal"), // low, normal, high, urgent
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  lastMessageBy: varchar("last_message_by", { length: 36 }).references(() => users.id),
  unreadByCustomer: boolean("unread_by_customer").default(false),
  unreadByEmployee: boolean("unread_by_employee").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by", { length: 36 }).references(() => users.id),
});

export const insertMessagingThreadSchema = createInsertSchema(messagingThreads).pick({
  customerId: true,
  assignedEmployeeId: true,
  subject: true,
  priority: true,
});

export type InsertMessagingThread = z.infer<typeof insertMessagingThreadSchema>;
export type MessagingThread = typeof messagingThreads.$inferSelect;

// Thread Messages - individual messages in a thread
export const threadMessages = pgTable("thread_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id", { length: 36 }).references(() => messagingThreads.id).notNull(),
  senderId: varchar("sender_id", { length: 36 }).references(() => users.id).notNull(),
  senderRole: text("sender_role").notNull(), // customer, employee
  content: text("content").notNull(),
  isInternalNote: boolean("is_internal_note").default(false), // Internal notes visible only to staff
  attachments: text("attachments").array(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertThreadMessageSchema = createInsertSchema(threadMessages).pick({
  threadId: true,
  senderId: true,
  senderRole: true,
  content: true,
  isInternalNote: true,
  attachments: true,
});

export type InsertThreadMessage = z.infer<typeof insertThreadMessageSchema>;
export type ThreadMessage = typeof threadMessages.$inferSelect;

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

// To-Do List System
export const todos = pgTable("todos", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").default("medium"), // low, medium, high, urgent
  status: text("status").default("pending"), // pending, in_progress, completed
  dueDate: timestamp("due_date"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTodoSchema = createInsertSchema(todos).pick({
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
});

export type InsertTodo = z.infer<typeof insertTodoSchema>;
export type Todo = typeof todos.$inferSelect;

// To-Do Assignments (which users are assigned to which todos)
export const todoAssignments = pgTable("todo_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  todoId: varchar("todo_id", { length: 36 }).references(() => todos.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }).notNull(),
  isRead: boolean("is_read").default(false),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const insertTodoAssignmentSchema = createInsertSchema(todoAssignments).pick({
  todoId: true,
  userId: true,
});

export type InsertTodoAssignment = z.infer<typeof insertTodoAssignmentSchema>;
export type TodoAssignment = typeof todoAssignments.$inferSelect;

// Active To-Do Users (which users can see the to-do system)
export const todoActiveUsers = pgTable("todo_active_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  activatedBy: varchar("activated_by", { length: 36 }).references(() => users.id),
  activatedAt: timestamp("activated_at").defaultNow(),
});

export const insertTodoActiveUserSchema = createInsertSchema(todoActiveUsers).pick({
  userId: true,
});

export type InsertTodoActiveUser = z.infer<typeof insertTodoActiveUserSchema>;
export type TodoActiveUser = typeof todoActiveUsers.$inferSelect;

// Plow Site Groups - for organizing sites (residential, commercial, routes, etc.)
export const plowSiteGroups = pgTable("plow_site_groups", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"), // blue by default
  groupType: text("group_type").default("custom"), // residential, commercial, route, custom
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlowSiteGroupSchema = createInsertSchema(plowSiteGroups).pick({
  name: true,
  description: true,
  color: true,
  groupType: true,
  sortOrder: true,
});

export type InsertPlowSiteGroup = z.infer<typeof insertPlowSiteGroupSchema>;
export type PlowSiteGroup = typeof plowSiteGroups.$inferSelect;

// Plow Site Maps - for snow removal route planning
export const plowSites = pgTable("plow_sites", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  groupId: varchar("group_id", { length: 36 }).references(() => plowSiteGroups.id),
  imageUrl: text("image_url"),
  imageSource: text("image_source").default("google"), // google, upload
  annotations: jsonb("annotations").default([]),
  instructions: jsonb("instructions").default([]),
  isPublished: boolean("is_published").default(false),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlowSiteSchema = createInsertSchema(plowSites).pick({
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  groupId: true,
  imageUrl: true,
  imageSource: true,
  annotations: true,
  instructions: true,
  isPublished: true,
});

export type InsertPlowSite = z.infer<typeof insertPlowSiteSchema>;
export type PlowSite = typeof plowSites.$inferSelect;

// Manager permissions for plow sites (edit vs view-only)
export const plowSiteManagerPermissions = pgTable("plow_site_manager_permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  canEdit: boolean("can_edit").default(false),
  grantedBy: varchar("granted_by", { length: 36 }).references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow(),
});

export const insertPlowSiteManagerPermissionSchema = createInsertSchema(plowSiteManagerPermissions).pick({
  userId: true,
  canEdit: true,
});

export type InsertPlowSiteManagerPermission = z.infer<typeof insertPlowSiteManagerPermissionSchema>;
export type PlowSiteManagerPermission = typeof plowSiteManagerPermissions.$inferSelect;

// Additional images for plow sites
export const plowSiteImages = pgTable("plow_site_images", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id", { length: 36 }).references(() => plowSites.id, { onDelete: "cascade" }).notNull(),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  annotations: jsonb("annotations").default([]),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlowSiteImageSchema = createInsertSchema(plowSiteImages).pick({
  siteId: true,
  imageUrl: true,
  title: true,
  annotations: true,
  sortOrder: true,
});

export type InsertPlowSiteImage = z.infer<typeof insertPlowSiteImageSchema>;
export type PlowSiteImage = typeof plowSiteImages.$inferSelect;

// Site Photos - enhanced photo management for plow sites
export const sitePhotos = pgTable("site_photos", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id", { length: 36 }).references(() => plowSites.id, { onDelete: "cascade" }).notNull(),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  source: text("source").default("upload"),
  width: integer("width"),
  height: integer("height"),
  meta: jsonb("meta").default({}),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSitePhotoSchema = createInsertSchema(sitePhotos).pick({
  siteId: true,
  imageUrl: true,
  title: true,
  source: true,
  width: true,
  height: true,
  meta: true,
  sortOrder: true,
});

export type InsertSitePhoto = z.infer<typeof insertSitePhotoSchema>;
export type SitePhoto = typeof sitePhotos.$inferSelect;

// Site Photo Variants - markup versions of photos (original stays untouched)
export const sitePhotoVariants = pgTable("site_photo_variants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id", { length: 36 }).references(() => sitePhotos.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull().default("Variant A"),
  annotations: jsonb("annotations").default([]),
  flattenedUrl: text("flattened_url"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSitePhotoVariantSchema = createInsertSchema(sitePhotoVariants).pick({
  photoId: true,
  name: true,
  annotations: true,
  flattenedUrl: true,
});

export type InsertSitePhotoVariant = z.infer<typeof insertSitePhotoVariantSchema>;
export type SitePhotoVariant = typeof sitePhotoVariants.$inferSelect;

// Site Map Features - GeoJSON features drawn on the map
export const siteMapFeatures = pgTable("site_map_features", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id", { length: 36 }).references(() => plowSites.id, { onDelete: "cascade" }).notNull(),
  name: text("name"),
  featureType: text("feature_type").notNull().default("point"),
  geojson: jsonb("geojson").notNull(),
  color: text("color").default("#ef4444"),
  icon: text("icon"),
  linkedPhotoId: varchar("linked_photo_id", { length: 36 }),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSiteMapFeatureSchema = createInsertSchema(siteMapFeatures).pick({
  siteId: true,
  name: true,
  featureType: true,
  geojson: true,
  color: true,
  icon: true,
  linkedPhotoId: true,
  sortOrder: true,
});

export type InsertSiteMapFeature = z.infer<typeof insertSiteMapFeatureSchema>;
export type SiteMapFeature = typeof siteMapFeatures.$inferSelect;

// AI Agents - Master Admin controlled autonomous agents
export const aiAgents = pgTable("ai_agents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  isEnabled: boolean("is_enabled").default(false),
  lastRunAt: timestamp("last_run_at"),
  runFrequency: text("run_frequency").default("manual"),
  configJson: jsonb("config_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).pick({
  name: true,
  description: true,
  category: true,
  isEnabled: true,
  runFrequency: true,
  configJson: true,
});

export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;

// AI Agent Usage Logs - Track costs and actions
export const aiAgentUsageLogs = pgTable("ai_agent_usage_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id", { length: 36 }).references(() => aiAgents.id, { onDelete: "cascade" }).notNull(),
  action: text("action").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  estimatedCost: text("estimated_cost").default("0.00"),
  resultSummary: text("result_summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAgentUsageLogSchema = createInsertSchema(aiAgentUsageLogs).pick({
  agentId: true,
  action: true,
  inputTokens: true,
  outputTokens: true,
  estimatedCost: true,
  resultSummary: true,
});

export type InsertAiAgentUsageLog = z.infer<typeof insertAiAgentUsageLogSchema>;
export type AiAgentUsageLog = typeof aiAgentUsageLogs.$inferSelect;

// AI Agent Suggestions - Improvement ideas with cost estimates
export const aiAgentSuggestions = pgTable("ai_agent_suggestions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id", { length: 36 }).references(() => aiAgents.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  estimatedCost: text("estimated_cost").default("0.00"),
  priority: text("priority").default("medium"),
  status: text("status").default("pending"),
  implementedAt: timestamp("implemented_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAgentSuggestionSchema = createInsertSchema(aiAgentSuggestions).pick({
  agentId: true,
  title: true,
  description: true,
  estimatedCost: true,
  priority: true,
  status: true,
});

export type InsertAiAgentSuggestion = z.infer<typeof insertAiAgentSuggestionSchema>;
export type AiAgentSuggestion = typeof aiAgentSuggestions.$inferSelect;

// Business Processes - Define workflows that can be audited
export const businessProcesses = pgTable("business_processes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("general"), // customer_facing, internal, hiring, jobs, etc.
  stepsJson: jsonb("steps_json").default([]), // Array of step definitions
  notificationsJson: jsonb("notifications_json").default([]), // Notification triggers
  rolesInvolved: text("roles_involved").array(), // Customer, Crew, Manager, Admin
  estimatedDuration: text("estimated_duration"), // e.g., "2-4 hours", "1-2 days"
  isActive: boolean("is_active").default(true),
  lastAuditedAt: timestamp("last_audited_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusinessProcessSchema = createInsertSchema(businessProcesses).pick({
  name: true,
  description: true,
  category: true,
  stepsJson: true,
  notificationsJson: true,
  rolesInvolved: true,
  estimatedDuration: true,
  isActive: true,
});

export type InsertBusinessProcess = z.infer<typeof insertBusinessProcessSchema>;
export type BusinessProcess = typeof businessProcesses.$inferSelect;

// Process Audit Results - Store audit findings and recommendations
export const processAuditResults = pgTable("process_audit_results", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  processId: varchar("process_id", { length: 36 }).references(() => businessProcesses.id, { onDelete: "cascade" }).notNull(),
  agentId: varchar("agent_id", { length: 36 }).references(() => aiAgents.id),
  status: text("status").default("pending"), // pending, running, completed, failed
  overallScore: integer("overall_score"), // 0-100 score
  efficiencyScore: integer("efficiency_score"),
  reliabilityScore: integer("reliability_score"),
  customerExperienceScore: integer("customer_experience_score"),
  communicationScore: integer("communication_score"),
  findingsJson: jsonb("findings_json").default([]), // Array of findings
  recommendationsJson: jsonb("recommendations_json").default([]), // Array of recommendations
  estimatedImprovementTime: text("estimated_improvement_time"),
  estimatedCost: text("estimated_cost").default("0.00"),
  tokensUsed: integer("tokens_used").default(0),
  runDurationMs: integer("run_duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertProcessAuditResultSchema = createInsertSchema(processAuditResults).pick({
  processId: true,
  agentId: true,
  status: true,
  overallScore: true,
  efficiencyScore: true,
  reliabilityScore: true,
  customerExperienceScore: true,
  communicationScore: true,
  findingsJson: true,
  recommendationsJson: true,
  estimatedImprovementTime: true,
  estimatedCost: true,
  tokensUsed: true,
  runDurationMs: true,
});

export type InsertProcessAuditResult = z.infer<typeof insertProcessAuditResultSchema>;
export type ProcessAuditResult = typeof processAuditResults.$inferSelect;

// Integration Wizard - Software catalog and configured integrations
export const softwareIntegrations = pgTable("software_integrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // CRM, Accounting, Scheduling, Communication, Payments, etc.
  description: text("description"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  apiDocsUrl: text("api_docs_url"),
  authType: text("auth_type").default("api_key"), // api_key, oauth2, basic, custom
  isPopular: boolean("is_popular").default(false),
  aiResearchedAt: timestamp("ai_researched_at"),
  capabilitiesJson: jsonb("capabilities_json"), // AI-discovered capabilities
  setupInstructionsJson: jsonb("setup_instructions_json"), // AI-generated setup steps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSoftwareIntegrationSchema = createInsertSchema(softwareIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSoftwareIntegration = z.infer<typeof insertSoftwareIntegrationSchema>;
export type SoftwareIntegration = typeof softwareIntegrations.$inferSelect;

// User's configured integrations
export const configuredIntegrations = pgTable("configured_integrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  softwareId: varchar("software_id", { length: 36 }).references(() => softwareIntegrations.id),
  name: text("name").notNull(), // User-friendly name for this connection
  status: text("status").notNull().default("pending"), // pending, configuring, testing, active, error, disabled
  authConfigJson: jsonb("auth_config_json"), // Encrypted credentials reference
  settingsJson: jsonb("settings_json"), // Integration-specific settings
  lastTestedAt: timestamp("last_tested_at"),
  lastTestResult: text("last_test_result"), // passed, failed
  lastTestMessage: text("last_test_message"),
  lastSyncAt: timestamp("last_sync_at"),
  syncFrequency: text("sync_frequency").default("manual"), // manual, hourly, daily, realtime
  enabledCapabilities: jsonb("enabled_capabilities"), // Array of enabled capability IDs
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConfiguredIntegrationSchema = createInsertSchema(configuredIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConfiguredIntegration = z.infer<typeof insertConfiguredIntegrationSchema>;
export type ConfiguredIntegration = typeof configuredIntegrations.$inferSelect;

// Integration capabilities - what each integration can do
export const integrationCapabilities = pgTable("integration_capabilities", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  softwareId: varchar("software_id", { length: 36 }).references(() => softwareIntegrations.id),
  name: text("name").notNull(), // e.g., "Sync Customers", "Create Invoices"
  description: text("description"),
  capabilityType: text("capability_type").notNull(), // sync, webhook, action, report
  direction: text("direction").default("both"), // inbound, outbound, both
  dataType: text("data_type"), // customers, jobs, invoices, payments, etc.
  requiresWebhook: boolean("requires_webhook").default(false),
  setupComplexity: text("setup_complexity").default("simple"), // simple, moderate, complex
  estimatedSetupTime: text("estimated_setup_time"),
  aiGenerated: boolean("ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntegrationCapabilitySchema = createInsertSchema(integrationCapabilities).omit({
  id: true,
  createdAt: true,
});

export type InsertIntegrationCapability = z.infer<typeof insertIntegrationCapabilitySchema>;
export type IntegrationCapability = typeof integrationCapabilities.$inferSelect;

// Integration test results
export const integrationTests = pgTable("integration_tests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  configuredIntegrationId: varchar("configured_integration_id", { length: 36 }).references(() => configuredIntegrations.id),
  testType: text("test_type").notNull(), // connection, auth, capability, full
  status: text("status").notNull().default("running"), // running, passed, failed
  testStepsJson: jsonb("test_steps_json"), // Array of test steps with results
  errorDetails: text("error_details"),
  duration: integer("duration"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertIntegrationTestSchema = createInsertSchema(integrationTests).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertIntegrationTest = z.infer<typeof insertIntegrationTestSchema>;
export type IntegrationTest = typeof integrationTests.$inferSelect;

// AI research sessions for discovering integration capabilities
export const integrationResearchSessions = pgTable("integration_research_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  softwareName: text("software_name").notNull(),
  category: text("category"),
  status: text("status").notNull().default("researching"), // researching, completed, failed
  researchResultsJson: jsonb("research_results_json"), // AI findings
  discoveredCapabilities: jsonb("discovered_capabilities"), // Array of capabilities found
  suggestedSetupSteps: jsonb("suggested_setup_steps"), // Array of setup steps
  estimatedCost: text("estimated_cost").default("0.00"),
  tokensUsed: integer("tokens_used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertIntegrationResearchSessionSchema = createInsertSchema(integrationResearchSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertIntegrationResearchSession = z.infer<typeof insertIntegrationResearchSessionSchema>;
export type IntegrationResearchSession = typeof integrationResearchSessions.$inferSelect;

// App Updates - for announcing new features to users by role
export const appUpdates = pgTable("app_updates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull(), // e.g., "1.2.0"
  title: text("title").notNull(),
  description: text("description").notNull(),
  detailedContent: text("detailed_content"), // Rich text/markdown for full details
  minRole: text("min_role").notNull().default("Customer"), // Minimum role to see this update
  category: text("category").notNull().default("feature"), // feature, improvement, fix, security
  isActive: boolean("is_active").notNull().default(true),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAppUpdateSchema = createInsertSchema(appUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertAppUpdate = z.infer<typeof insertAppUpdateSchema>;
export type AppUpdate = typeof appUpdates.$inferSelect;

// Track which updates users have seen
export const userUpdateAcknowledgments = pgTable("user_update_acknowledgments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  updateId: varchar("update_id", { length: 36 }).notNull().references(() => appUpdates.id),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
});

export const insertUserUpdateAcknowledgmentSchema = createInsertSchema(userUpdateAcknowledgments).omit({
  id: true,
  acknowledgedAt: true,
});

export type InsertUserUpdateAcknowledgment = z.infer<typeof insertUserUpdateAcknowledgmentSchema>;
export type UserUpdateAcknowledgment = typeof userUpdateAcknowledgments.$inferSelect;

// Help Articles - comprehensive documentation by role
export const helpArticles = pgTable("help_articles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  summary: text("summary").notNull(), // Brief description for search results
  content: text("content").notNull(), // Full article content (markdown)
  category: text("category").notNull(), // e.g., "Getting Started", "Jobs", "SOPs", "Admin"
  minRole: text("min_role").notNull().default("Customer"), // Minimum role to see this article
  tags: text("tags").array(), // For search/filtering
  relatedArticles: text("related_articles").array(), // Array of article IDs
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHelpArticleSchema = createInsertSchema(helpArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHelpArticle = z.infer<typeof insertHelpArticleSchema>;
export type HelpArticle = typeof helpArticles.$inferSelect;

// Help Categories for organizing articles
export const helpCategories = pgTable("help_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"), // Lucide icon name
  minRole: text("min_role").notNull().default("Customer"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHelpCategorySchema = createInsertSchema(helpCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertHelpCategory = z.infer<typeof insertHelpCategorySchema>;
export type HelpCategory = typeof helpCategories.$inferSelect;

// Help Article Feedback Reports - users can report articles as outdated
export const helpArticleReports = pgTable("help_article_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id", { length: 36 }).notNull().references(() => helpArticles.id),
  reportedBy: varchar("reported_by", { length: 36 }).notNull().references(() => users.id),
  reportType: text("report_type").notNull().default("outdated"), // outdated, unclear, incorrect
  description: text("description"), // Optional details about what's wrong
  status: text("status").notNull().default("pending"), // pending, in_progress, resolved, dismissed
  resolvedBy: varchar("resolved_by", { length: 36 }).references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHelpArticleReportSchema = createInsertSchema(helpArticleReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type InsertHelpArticleReport = z.infer<typeof insertHelpArticleReportSchema>;
export type HelpArticleReport = typeof helpArticleReports.$inferSelect;

// Article Update Notifications - track when users are notified about article updates
export const articleUpdateNotifications = pgTable("article_update_notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id", { length: 36 }).notNull().references(() => helpArticles.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  notificationType: text("notification_type").notNull().default("updated"), // updated, new
  message: text("message"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArticleUpdateNotificationSchema = createInsertSchema(articleUpdateNotifications).omit({
  id: true,
  createdAt: true,
});

export type InsertArticleUpdateNotification = z.infer<typeof insertArticleUpdateNotificationSchema>;
export type ArticleUpdateNotification = typeof articleUpdateNotifications.$inferSelect;

// Calendar Connections
export const calendarConnections = pgTable("calendar_connections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  provider: text("provider").notNull(), // google, apple, samsung, outlook
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  calendarId: text("calendar_id"),
  calendarName: text("calendar_name"),
  isConnected: boolean("is_connected").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalendarConnectionSchema = createInsertSchema(calendarConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalendarConnection = z.infer<typeof insertCalendarConnectionSchema>;
export type CalendarConnection = typeof calendarConnections.$inferSelect;

// Error Logs - for tracking application errors
export const errorLogs = pgTable("error_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  errorType: text("error_type").notNull(), // api_error, database_error, auth_error, validation_error, frontend_error
  errorMessage: text("error_message").notNull(),
  stackTrace: text("stack_trace"),
  endpoint: text("endpoint"), // API endpoint that caused the error
  httpMethod: text("http_method"), // GET, POST, PATCH, DELETE
  statusCode: integer("status_code"),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  userRole: text("user_role"),
  requestBody: text("request_body"), // Sanitized request body (no passwords)
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  feature: text("feature"), // sops, materials, jobs, hiring, todos, etc.
  severity: text("severity").default("error"), // info, warning, error, critical
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;

// Activity Logs - for tracking key user actions
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // login, logout, create, update, delete, view
  feature: text("feature").notNull(), // sops, materials, jobs, hiring, todos, users, settings, etc.
  description: text("description"), // Human-readable description
  entityType: text("entity_type"), // user, sop, material, job, etc.
  entityId: text("entity_id"), // ID of the affected entity
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  userRole: text("user_role"),
  metadata: text("metadata"), // JSON string with additional details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Development Tracker - for tracking incomplete features and systems
export const developmentTracker = pgTable("development_tracker", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  featureName: text("feature_name").notNull(),
  category: text("category").notNull(), // core, integration, ui, backend, etc.
  status: text("status").default("in_progress"), // not_started, in_progress, blocked, needs_review, completed
  priority: text("priority").default("medium"), // low, medium, high, critical
  percentComplete: integer("percent_complete").default(0),
  description: text("description"), // What the feature does
  currentState: text("current_state"), // What's already built
  remainingWork: text("remaining_work"), // What still needs to be done (JSON array)
  blockers: text("blockers"), // What's blocking progress (JSON array)
  suggestions: text("suggestions"), // Alternative approaches or tips (JSON array)
  additionalInfo: text("additional_info"), // Setup requirements, API keys needed, etc.
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDevelopmentTrackerSchema = createInsertSchema(developmentTracker).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export type InsertDevelopmentTracker = z.infer<typeof insertDevelopmentTrackerSchema>;
export type DevelopmentTracker = typeof developmentTracker.$inferSelect;

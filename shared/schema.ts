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
  emailNotifications: boolean("email_notifications").notNull().default(true),
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
  superCategory: text("super_category"),
  subCategory: text("sub_category"),
  sopType: text("sop_type"),
  content: text("content").notNull(),
  structuredData: jsonb("structured_data"),
  ownerId: varchar("owner_id", { length: 36 }).references(() => users.id),
  isArchived: boolean("is_archived").notNull().default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertSopSchema = createInsertSchema(sops).pick({
  title: true,
  category: true,
  categoryId: true,
  superCategory: true,
  subCategory: true,
  sopType: true,
  content: true,
  structuredData: true,
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
export type ApplicantStage = "New Application" | "Review" | "Phone Screen" | "Interview" | "Offer Extended" | "Hired" | "Not a Fit";
export type ApplicantSource = "Indeed" | "Referral" | "Walk-in" | "Website" | "Other";

export const candidates = pgTable("candidates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  stage: text("stage").notNull().default("New Application"),
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
  source: text("source").$type<ApplicantSource>(),
  notes: text("notes"),
  interviewDate: timestamp("interview_date"),
  interviewTime: text("interview_time"),
  interviewLocation: text("interview_location"),
  interviewType: text("interview_type"),
  interviewerName: text("interviewer_name"),
  interviewNotes: text("interview_notes"),
  interviewRating: integer("interview_rating"),
  interviewRecommendation: text("interview_recommendation"),
  lastNotifiedAt: timestamp("last_notified_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  appliedDate: true,
  lastNotifiedAt: true,
  updatedAt: true,
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

export const candidateDocuments = pgTable("candidate_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id", { length: 36 }).references(() => candidates.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  status: text("status").notNull().default("Not Sent"),
  requiresAcknowledgment: boolean("requires_acknowledgment").default(false),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  completedAt: timestamp("completed_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertCandidateDocumentSchema = createInsertSchema(candidateDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertCandidateDocument = z.infer<typeof insertCandidateDocumentSchema>;
export type CandidateDocument = typeof candidateDocuments.$inferSelect;

export const applicantNotes = pgTable("applicant_notes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id", { length: 36 }).references(() => candidates.id).notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id", { length: 36 }).references(() => users.id),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApplicantNoteSchema = createInsertSchema(applicantNotes).omit({ id: true, createdAt: true });
export type InsertApplicantNote = z.infer<typeof insertApplicantNoteSchema>;
export type ApplicantNote = typeof applicantNotes.$inferSelect;

export const applicantCommunications = pgTable("applicant_communications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id", { length: 36 }).references(() => candidates.id).notNull(),
  type: text("type").notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  sentBy: varchar("sent_by", { length: 36 }).references(() => users.id),
  sentByName: text("sent_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApplicantCommunicationSchema = createInsertSchema(applicantCommunications).omit({ id: true, createdAt: true });
export type InsertApplicantCommunication = z.infer<typeof insertApplicantCommunicationSchema>;
export type ApplicantCommunication = typeof applicantCommunications.$inferSelect;

export type EmployeeStatus = "Active" | "On Leave" | "Terminated" | "Seasonal Off";
export type EmploymentType = "Full-time" | "Part-time" | "Seasonal" | "Contractor";

export const employees = pgTable("employees", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  candidateId: varchar("candidate_id", { length: 36 }).references(() => candidates.id),
  employeeNumber: text("employee_number"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  pronouns: text("pronouns"),
  dateOfBirth: text("date_of_birth"),
  personalEmail: text("personal_email"),
  personalPhone: text("personal_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactRelationship: text("emergency_contact_relationship"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContact2Name: text("emergency_contact2_name"),
  emergencyContact2Relationship: text("emergency_contact2_relationship"),
  emergencyContact2Phone: text("emergency_contact2_phone"),
  profilePhoto: text("profile_photo"),
  jobTitle: text("job_title"),
  department: text("department"),
  employmentType: text("employment_type").$type<EmploymentType>().default("Full-time"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  supervisor: text("supervisor"),
  workLocation: text("work_location"),
  status: text("status").$type<EmployeeStatus>().default("Active"),
  payRate: text("pay_rate"),
  payType: text("pay_type"),
  payPeriod: text("pay_period"),
  paymentMethod: text("payment_method"),
  bankNameLast4: text("bank_name_last4"),
  accountLast4: text("account_last4"),
  routingLast4: text("routing_last4"),
  accountType: text("account_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export const employeePayHistory = pgTable("employee_pay_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  oldRate: text("old_rate"),
  newRate: text("new_rate"),
  reason: text("reason"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeePayHistorySchema = createInsertSchema(employeePayHistory).omit({ id: true, createdAt: true });
export type InsertEmployeePayHistory = z.infer<typeof insertEmployeePayHistorySchema>;
export type EmployeePayHistory = typeof employeePayHistory.$inferSelect;

export const employeeHistory = pgTable("employee_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  changeType: text("change_type").notNull(),
  details: text("details").notNull(),
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeHistorySchema = createInsertSchema(employeeHistory).omit({ id: true, createdAt: true });
export type InsertEmployeeHistory = z.infer<typeof insertEmployeeHistorySchema>;
export type EmployeeHistory = typeof employeeHistory.$inferSelect;

export const employeeNotes = pgTable("employee_notes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id", { length: 36 }).references(() => users.id),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeNoteSchema = createInsertSchema(employeeNotes).omit({ id: true, createdAt: true });
export type InsertEmployeeNote = z.infer<typeof insertEmployeeNoteSchema>;
export type EmployeeNote = typeof employeeNotes.$inferSelect;

export const employeeDocuments = pgTable("employee_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  status: text("status").notNull().default("Not Sent"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocuments).omit({ id: true, createdAt: true });
export type InsertEmployeeDocument = z.infer<typeof insertEmployeeDocumentSchema>;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;

export const onboardingItems = pgTable("onboarding_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  assignedTo: text("assigned_to").notNull(),
  status: text("status").notNull().default("Pending"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOnboardingItemSchema = createInsertSchema(onboardingItems).omit({ id: true, createdAt: true });
export type InsertOnboardingItem = z.infer<typeof insertOnboardingItemSchema>;
export type OnboardingItem = typeof onboardingItems.$inferSelect;

export const hrFormSubmissions = pgTable("hr_form_submissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id),
  candidateId: varchar("candidate_id", { length: 36 }).references(() => candidates.id),
  formType: text("form_type").notNull(),
  formData: jsonb("form_data").notNull().default({}),
  status: text("status").notNull().default("Not Started"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHrFormSubmissionSchema = createInsertSchema(hrFormSubmissions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHrFormSubmission = z.infer<typeof insertHrFormSubmissionSchema>;
export type HrFormSubmission = typeof hrFormSubmissions.$inferSelect;

export const hiringEmailTemplates = pgTable("hiring_email_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  stage: text("stage").notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHiringEmailTemplateSchema = createInsertSchema(hiringEmailTemplates).omit({ id: true, updatedAt: true });
export type InsertHiringEmailTemplate = z.infer<typeof insertHiringEmailTemplateSchema>;
export type HiringEmailTemplate = typeof hiringEmailTemplates.$inferSelect;

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
  crewNotesCustomerVisible: text("crew_notes_customer_visible"),
  crewLeadName: text("crew_lead_name"),
  scopeOfWork: text("scope_of_work"),
  materialsUsed: text("materials_used"),
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
  crewNotesCustomerVisible: true,
  crewLeadName: true,
  scopeOfWork: true,
  materialsUsed: true,
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
  type: text("type").notNull(),
  name: text("name").notNull(),
  nickname: text("nickname"),
  assetId: text("asset_id"),
  category: text("category"),
  year: integer("year"),
  make: text("make"),
  model: text("model"),
  vin: text("vin"),
  serialNumber: text("serial_number"),
  licensePlate: text("license_plate"),
  mileage: integer("mileage"),
  hours: integer("hours"),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  image: text("image"),
  purchaseDate: timestamp("purchase_date"),
  purchasePrice: integer("purchase_price"),
  purchasedFrom: text("purchased_from"),
  conditionAtPurchase: text("condition_at_purchase"),
  assignedToUserId: varchar("assigned_to_user_id", { length: 36 }),
  primaryLocation: text("primary_location"),
  trackingType: text("tracking_type").default("hours"),
  currentHours: integer("current_hours").default(0),
  hoursAtPurchase: integer("hours_at_purchase").default(0),
  lastHoursUpdate: timestamp("last_hours_update"),
  registrationExpiry: timestamp("registration_expiry"),
  insuranceExpiry: timestamp("insurance_expiry"),
  warrantyExpiry: timestamp("warranty_expiry"),
  primaryPhotoUrl: text("primary_photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Maintenance Schedules (recurring maintenance)
export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id", { length: 36 }).references(() => equipment.id).notNull(),
  templateId: varchar("template_id", { length: 36 }),
  name: text("name").notNull(),
  description: text("description"),
  taskDescription: text("task_description"),
  intervalType: text("interval_type").notNull(),
  intervalValue: integer("interval_value").notNull(),
  hoursInterval: integer("hours_interval"),
  calendarIntervalDays: integer("calendar_interval_days"),
  lastCompletedDate: timestamp("last_completed_date"),
  lastCompletedMileage: integer("last_completed_mileage"),
  lastCompletedHours: integer("last_completed_hours"),
  lastServiceHours: integer("last_service_hours"),
  lastServiceDate: timestamp("last_service_date"),
  nextDueDate: timestamp("next_due_date"),
  nextDueMileage: integer("next_due_mileage"),
  nextDueHours: integer("next_due_hours"),
  priority: text("priority").default("p4"),
  isOverridden: boolean("is_overridden").default(false),
  overrideNotes: text("override_notes"),
  reminderDays: integer("reminder_days").default(7),
  reminderEmail: text("reminder_email"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").notNull().default(0),
  recurringReminderDays: integer("recurring_reminder_days").default(3),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedules).omit({
  id: true,
  createdAt: true,
});

export type InsertMaintenanceSchedule = z.infer<typeof insertMaintenanceScheduleSchema>;
export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;

// Maintenance Logs (completed maintenance records)
export const maintenanceLogs = pgTable("maintenance_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id", { length: 36 }).references(() => equipment.id).notNull(),
  scheduleId: varchar("schedule_id", { length: 36 }).references(() => maintenanceSchedules.id),
  logType: text("log_type").default("scheduled"),
  name: text("name").notNull(),
  description: text("description"),
  completedDate: timestamp("completed_date").notNull().defaultNow(),
  mileageAtService: integer("mileage_at_service"),
  hoursAtService: integer("hours_at_service"),
  cost: integer("cost"),
  vendor: text("vendor"),
  serviceLocation: text("service_location"),
  partsUsed: jsonb("parts_used").default([]),
  laborCost: integer("labor_cost").default(0),
  totalCost: integer("total_cost").default(0),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  performedBy: varchar("performed_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;

// Equipment Uploads (receipts, photos, documents)
export const equipmentUploads = pgTable("equipment_uploads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id", { length: 36 }).references(() => equipment.id).notNull(),
  folder: text("folder").default("other"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  workType: text("work_type"),
  description: text("description"),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertEquipmentUploadSchema = createInsertSchema(equipmentUploads).omit({
  id: true,
  uploadedAt: true,
});

export type InsertEquipmentUpload = z.infer<typeof insertEquipmentUploadSchema>;
export type EquipmentUpload = typeof equipmentUploads.$inferSelect;

export const oemMaintenanceTemplates = pgTable("oem_maintenance_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  taskName: text("task_name").notNull(),
  taskDescription: text("task_description"),
  hoursInterval: integer("hours_interval"),
  calendarIntervalDays: integer("calendar_interval_days"),
  priorityLevel: text("priority_level").default("p3"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOemTemplateSchema = createInsertSchema(oemMaintenanceTemplates).omit({ id: true, createdAt: true });
export type InsertOemTemplate = z.infer<typeof insertOemTemplateSchema>;
export type OemMaintenanceTemplate = typeof oemMaintenanceTemplates.$inferSelect;

export const repairRequests = pgTable("repair_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id", { length: 36 }).references(() => equipment.id, { onDelete: "cascade" }).notNull(),
  reportedByUserId: varchar("reported_by_user_id", { length: 36 }).references(() => users.id),
  reportDate: timestamp("report_date").defaultNow(),
  problemDescription: text("problem_description").notNull(),
  severity: text("severity").notNull().default("minor"),
  isUsable: text("is_usable").notNull().default("yes"),
  photos: jsonb("photos").default([]),
  status: text("status").notNull().default("open"),
  assignedToUserId: varchar("assigned_to_user_id", { length: 36 }).references(() => users.id),
  shopName: text("shop_name"),
  dropOffDate: timestamp("drop_off_date"),
  expectedReturn: timestamp("expected_return"),
  resolutionDescription: text("resolution_description"),
  resolutionDate: timestamp("resolution_date"),
  totalRepairCost: integer("total_repair_cost").default(0),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRepairRequestSchema = createInsertSchema(repairRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepairRequest = z.infer<typeof insertRepairRequestSchema>;
export type RepairRequest = typeof repairRequests.$inferSelect;

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
  aiImagesEnabled: boolean("ai_images_enabled").default(true),
  aiImagesAllowedRoles: text("ai_images_allowed_roles").array().default(sql`ARRAY['Admin', 'Manager']`),
  aiImagesDailyLimit: integer("ai_images_daily_limit").default(10),
  aiImagesMonthlyLimit: integer("ai_images_monthly_limit").default(200),
  aiImagesWatermarkDefault: boolean("ai_images_watermark_default").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).pick({
  logoUrl: true,
  logoShape: true,
  logoCornerRadius: true,
  companyName: true,
  sidebarOrder: true,
  aiImagesEnabled: true,
  aiImagesAllowedRoles: true,
  aiImagesDailyLimit: true,
  aiImagesMonthlyLimit: true,
  aiImagesWatermarkDefault: true,
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

// To-Do History (track changes to todos)
export const todoHistory = pgTable("todo_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  todoId: varchar("todo_id", { length: 36 }).references(() => todos.id, { onDelete: "cascade" }).notNull(),
  changedBy: varchar("changed_by", { length: 36 }).references(() => users.id),
  changeType: text("change_type").notNull(), // created, updated, status_changed, archived
  fieldChanged: text("field_changed"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow(),
});

export type TodoHistory = typeof todoHistory.$inferSelect;

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

// Task Management System (rebuilt from To-Do)
export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: text("task_id").unique(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("standard"),
  priority: text("priority").notNull().default("p3_normal"),
  status: text("status").notNull().default("assigned"),
  createdByUserId: varchar("created_by_user_id", { length: 36 }).references(() => users.id).notNull(),
  assignedToUserId: varchar("assigned_to_user_id", { length: 36 }).references(() => users.id).notNull(),
  dueDate: timestamp("due_date"),
  dueTime: text("due_time"),
  category: text("category"),
  estimatedMinutes: integer("estimated_minutes"),
  location: text("location"),
  requiresConfirmation: boolean("requires_confirmation").default(false),
  completionNotes: text("completion_notes"),
  completionPhotoUrl: text("completion_photo_url"),
  isRecurring: boolean("is_recurring").default(false),
  recurringConfig: jsonb("recurring_config"),
  parentTaskId: varchar("parent_task_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  confirmedAt: timestamp("confirmed_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true, taskId: true, createdAt: true, updatedAt: true,
  acknowledgedAt: true, startedAt: true, completedAt: true, confirmedAt: true, cancelledAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const taskChecklistItems = pgTable("task_checklist_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  itemText: text("item_text").notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedBy: varchar("completed_by", { length: 36 }).references(() => users.id),
  completedAt: timestamp("completed_at"),
  sortOrder: integer("sort_order").default(0),
});

export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;

export const taskHistory = pgTable("task_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(),
  changedByUserId: varchar("changed_by_user_id", { length: 36 }).references(() => users.id),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TaskHistoryEntry = typeof taskHistory.$inferSelect;

export const taskAttachments = pgTable("task_attachments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileName: text("file_name"),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export type TaskAttachment = typeof taskAttachments.$inferSelect;

export const taskDelegationChain = pgTable("task_delegation_chain", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  fromUserId: varchar("from_user_id", { length: 36 }).references(() => users.id).notNull(),
  toUserId: varchar("to_user_id", { length: 36 }).references(() => users.id).notNull(),
  delegatedAt: timestamp("delegated_at").defaultNow(),
  reason: text("reason"),
});

export type TaskDelegation = typeof taskDelegationChain.$inferSelect;

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
  errorCode: text("error_code"), // Structured error code (e.g. IMG-001, AUTH-003, SOP-002)
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

export const sopMedia = pgTable("sop_media", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sopId: varchar("sop_id", { length: 36 }).references(() => sops.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index"),
  placement: text("placement").notNull().default("header"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  alt: text("alt"),
  source: text("source").notNull().default("upload"),
  aiPrompt: text("ai_prompt"),
  aiStyle: text("ai_style"),
  aiNegativePrompt: text("ai_negative_prompt"),
  aiModel: text("ai_model"),
  aiWatermarked: boolean("ai_watermarked").default(true),
  metadata: jsonb("metadata"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSopMediaSchema = createInsertSchema(sopMedia).omit({
  id: true,
  createdAt: true,
});

export type InsertSopMedia = z.infer<typeof insertSopMediaSchema>;
export type SopMedia = typeof sopMedia.$inferSelect;

export const aiGenerationEvents = pgTable("ai_generation_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id", { length: 36 }),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  style: text("style"),
  model: text("model"),
  requestedSize: text("requested_size"),
  resultMediaId: varchar("result_media_id", { length: 36 }),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiGenerationEventSchema = createInsertSchema(aiGenerationEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAiGenerationEvent = z.infer<typeof insertAiGenerationEventSchema>;
export type AiGenerationEvent = typeof aiGenerationEvents.$inferSelect;

export const sopDrafts = pgTable("sop_drafts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id", { length: 36 }).references(() => users.id).notNull(),
  title: text("title").notNull().default("Untitled Draft"),
  categoryId: varchar("category_id", { length: 36 }),
  sopType: text("sop_type"),
  currentStep: integer("current_step").notNull().default(0),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSopDraftSchema = createInsertSchema(sopDrafts).omit({
  id: true,
  updatedAt: true,
});

export type InsertSopDraft = z.infer<typeof insertSopDraftSchema>;
export type SopDraft = typeof sopDrafts.$inferSelect;

export const sopQuizzes = pgTable("sop_quizzes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sopId: varchar("sop_id", { length: 36 }).references(() => sops.id, { onDelete: "cascade" }).notNull(),
  skillLevel: text("skill_level").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  questionCount: integer("question_count").notNull().default(0),
  minPassLevel: integer("min_pass_level").notNull().default(2),
  isSafetyCritical: boolean("is_safety_critical").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSopQuizSchema = createInsertSchema(sopQuizzes).omit({
  id: true,
  createdAt: true,
});

export type InsertSopQuiz = z.infer<typeof insertSopQuizSchema>;
export type SopQuiz = typeof sopQuizzes.$inferSelect;

export const sopQuizQuestions = pgTable("sop_quiz_questions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id", { length: 36 }).references(() => sopQuizzes.id, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  options: jsonb("options").notNull(),
  correctIndex: integer("correct_index").notNull(),
  isStandard: boolean("is_standard").notNull().default(false),
  explanation: text("explanation"),
  sortOrder: integer("sort_order").notNull().default(0),
  difficultyLevel: integer("difficulty_level").notNull().default(1),
  audienceRoles: jsonb("audience_roles").notNull().default([]),
});

export const insertSopQuizQuestionSchema = createInsertSchema(sopQuizQuestions).omit({
  id: true,
});

export type InsertSopQuizQuestion = z.infer<typeof insertSopQuizQuestionSchema>;
export type SopQuizQuestion = typeof sopQuizQuestions.$inferSelect;

export const userQuizAttempts = pgTable("user_quiz_attempts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id", { length: 36 }).references(() => sopQuizzes.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed: boolean("passed").notNull().default(false),
  answers: jsonb("answers").notNull(),
  questionsServed: jsonb("questions_served").notNull().default([]),
  currentDifficulty: integer("current_difficulty").notNull().default(1),
  highestLevelPassed: integer("highest_level_passed").notNull().default(0),
  finalScoreLabel: text("final_score_label"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertUserQuizAttemptSchema = createInsertSchema(userQuizAttempts).omit({
  id: true,
  completedAt: true,
});

export type InsertUserQuizAttempt = z.infer<typeof insertUserQuizAttemptSchema>;
export type UserQuizAttempt = typeof userQuizAttempts.$inferSelect;

export const builderForms = pgTable("builder_forms", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("Untitled Form"),
  category: text("category").notNull().default(""),
  purpose: text("purpose").notNull().default(""),
  language: text("language").notNull().default("en"),
  exportTarget: text("export_target").notNull().default("pdf"),
  status: text("status").notNull().default("published"),
  outcome: text("outcome").notNull().default(""),
  outcomeType: text("outcome_type").notNull().default("data_collection"),
  audience: text("audience").notNull().default(""),
  audienceRoles: jsonb("audience_roles").notNull().default(sql`'[]'::jsonb`),
  sections: jsonb("sections").notNull().default(sql`'[]'::jsonb`),
  toolsAndMedia: jsonb("tools_and_media").notNull().default(sql`'{}'::jsonb`),
  externalConnections: jsonb("external_connections").notNull().default(sql`'{}'::jsonb`),
  pages: jsonb("pages").notNull().default(sql`'[]'::jsonb`),
  archived: boolean("archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBuilderFormSchema = createInsertSchema(builderForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export type InsertBuilderForm = z.infer<typeof insertBuilderFormSchema>;
export type BuilderForm = typeof builderForms.$inferSelect;

export const pdfForms = pgTable("pdf_forms", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull().default("Untitled PDF"),
  fileKey: text("file_key").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  pageCount: integer("page_count").notNull().default(0),
  formFields: jsonb("form_fields").notNull().default(sql`'[]'::jsonb`),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPdfFormSchema = createInsertSchema(pdfForms).omit({
  id: true,
  createdAt: true,
});

export type InsertPdfForm = z.infer<typeof insertPdfFormSchema>;
export type PdfForm = typeof pdfForms.$inferSelect;

export const hqFiles = pgTable("hq_files", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  objectPath: text("object_path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHqFileSchema = createInsertSchema(hqFiles).omit({
  id: true,
  createdAt: true,
});

export type InsertHqFile = z.infer<typeof insertHqFileSchema>;
export type HqFile = typeof hqFiles.$inferSelect;

export const qualifiedLeads = pgTable("qualified_leads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  companyName: text("company_name"),
  propertyType: text("property_type").notNull(),
  serviceType: text("service_type").notNull(),
  projectSize: text("project_size").notNull(),
  budget: text("budget"),
  timeline: text("timeline"),
  source: text("source"),
  location: text("location"),
  notes: text("notes"),
  answers: jsonb("answers").notNull().default([]),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  rating: text("rating").notNull().default("cold"),
  qualifiedBy: varchar("qualified_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQualifiedLeadSchema = createInsertSchema(qualifiedLeads).omit({
  id: true,
  createdAt: true,
});

export type InsertQualifiedLead = z.infer<typeof insertQualifiedLeadSchema>;
export type QualifiedLead = typeof qualifiedLeads.$inferSelect;

// Customer Hub Tables

export const customerJobs = pgTable("customer_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerJobSchema = createInsertSchema(customerJobs).omit({ id: true, createdAt: true });
export type InsertCustomerJob = z.infer<typeof insertCustomerJobSchema>;
export type CustomerJob = typeof customerJobs.$inferSelect;

export const customerDocuments = pgTable("customer_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  name: text("name").notNull(),
  folder: text("folder").notNull().default("Other"),
  url: text("url"),
  status: text("status").notNull().default("Available"),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerDocumentSchema = createInsertSchema(customerDocuments).omit({ id: true, createdAt: true });
export type InsertCustomerDocument = z.infer<typeof insertCustomerDocumentSchema>;
export type CustomerDocument = typeof customerDocuments.$inferSelect;

export const careGuides = pgTable("care_guides", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  pdfUrl: text("pdf_url"),
  tags: text("tags").array().default([]),
  isPublished: boolean("is_published").notNull().default(false),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCareGuideSchema = createInsertSchema(careGuides).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCareGuide = z.infer<typeof insertCareGuideSchema>;
export type CareGuide = typeof careGuides.$inferSelect;

export const customerSavedGuides = pgTable("customer_saved_guides", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  guideId: varchar("guide_id", { length: 36 }).references(() => careGuides.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSavedGuideSchema = createInsertSchema(customerSavedGuides).omit({ id: true, createdAt: true });
export type InsertCustomerSavedGuide = z.infer<typeof insertCustomerSavedGuideSchema>;
export type CustomerSavedGuide = typeof customerSavedGuides.$inferSelect;

export const customerNotifications = pgTable("customer_notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerNotificationSchema = createInsertSchema(customerNotifications).omit({ id: true, createdAt: true });
export type InsertCustomerNotification = z.infer<typeof insertCustomerNotificationSchema>;
export type CustomerNotification = typeof customerNotifications.$inferSelect;

export const staffNotifications = pgTable("staff_notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  metadata: jsonb("metadata").default({}),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStaffNotificationSchema = createInsertSchema(staffNotifications).omit({ id: true, createdAt: true });
export type InsertStaffNotification = z.infer<typeof insertStaffNotificationSchema>;
export type StaffNotification = typeof staffNotifications.$inferSelect;

export const documentCategoryEnum = ["form", "policy", "manual", "registration", "insurance", "certification", "photo", "contract", "proposal", "invoice", "warranty", "report", "other"] as const;
export type DocumentCategory = typeof documentCategoryEnum[number];

export const documentEntityTypeEnum = ["employee", "equipment", "job", "customer", "company"] as const;
export type DocumentEntityType = typeof documentEntityTypeEnum[number];

export const documents = pgTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileSizeKb: integer("file_size_kb"),
  category: text("category").notNull().default("other"),
  uploadedByUserId: varchar("uploaded_by_user_id", { length: 36 }).references(() => users.id),
  homeEntityType: text("home_entity_type").notNull(),
  homeEntityId: text("home_entity_id").notNull(),
  description: text("description"),
  isTemplate: boolean("is_template").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const documentLinks = pgTable("document_links", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 36 }).references(() => documents.id).notNull(),
  linkedEntityType: text("linked_entity_type").notNull(),
  linkedEntityId: text("linked_entity_id").notNull(),
  linkedByUserId: varchar("linked_by_user_id", { length: 36 }).references(() => users.id),
  linkedAt: timestamp("linked_at").defaultNow(),
});

export const insertDocumentLinkSchema = createInsertSchema(documentLinks).omit({ id: true, linkedAt: true });
export type InsertDocumentLink = z.infer<typeof insertDocumentLinkSchema>;
export type DocumentLink = typeof documentLinks.$inferSelect;

export const formTypeEnum = ["w4", "i9", "ohio_it4", "direct_deposit", "handbook_acknowledgment", "emergency_contact", "background_check_auth", "workers_comp_first_report", "osha_incident", "nda", "employment_application"] as const;
export type FormType = typeof formTypeEnum[number];

export const formStatusEnum = ["draft", "submitted", "pending_review", "approved", "rejected"] as const;
export type FormStatus = typeof formStatusEnum[number];

export const onboardingFormSubmissions = pgTable("onboarding_form_submissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  formType: text("form_type").notNull(),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id),
  submittedByUserId: varchar("submitted_by_user_id", { length: 36 }).references(() => users.id),
  submissionData: jsonb("submission_data").default({}),
  status: text("status").notNull().default("draft"),
  pdfDocumentId: varchar("pdf_document_id", { length: 36 }),
  submittedAt: timestamp("submitted_at"),
  reviewedByUserId: varchar("reviewed_by_user_id", { length: 36 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  assignedByUserId: varchar("assigned_by_user_id", { length: 36 }).references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOnboardingFormSubmissionSchema = createInsertSchema(onboardingFormSubmissions).omit({ id: true, createdAt: true });
export type InsertOnboardingFormSubmission = z.infer<typeof insertOnboardingFormSubmissionSchema>;
export type OnboardingFormSubmission = typeof onboardingFormSubmissions.$inferSelect;

export const sharedLinks = pgTable("shared_links", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 64 }).notNull().unique(),
  documentType: text("document_type").notNull(),
  documentId: text("document_id").notNull(),
  documentName: text("document_name").notNull(),
  documentUrl: text("document_url"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id).notNull(),
  createdByName: text("created_by_name").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  passwordHash: text("password_hash"),
  note: text("note"),
  viewCount: integer("view_count").notNull().default(0),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSharedLinkSchema = createInsertSchema(sharedLinks).omit({ id: true, viewCount: true, isRevoked: true, createdAt: true });
export type InsertSharedLink = z.infer<typeof insertSharedLinkSchema>;
export type SharedLink = typeof sharedLinks.$inferSelect;

export const sharedLinkAccessLogs = pgTable("shared_link_access_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sharedLinkId: varchar("shared_link_id", { length: 36 }).references(() => sharedLinks.id).notNull(),
  accessedAt: timestamp("accessed_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export type SharedLinkAccessLog = typeof sharedLinkAccessLogs.$inferSelect;

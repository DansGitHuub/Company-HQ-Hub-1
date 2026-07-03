import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { pgTable, text, varchar, boolean, timestamp, integer, jsonb, serial, numeric, primaryKey, date, unique, index, doublePrecision, real, uuid } from "drizzle-orm/pg-core";
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
  emailNotifications: boolean("email_notifications").notNull().default(true),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleCalendarId: text("google_calendar_id").default("primary"),
  googleTokenExpiry: timestamp("google_token_expiry", { withTimezone: true }),
  voiceEnabled: boolean("voice_enabled").notNull().default(false),
  voiceAutoSpeak: boolean("voice_auto_speak").notNull().default(false),
  voiceSelection: text("voice_selection").default("alloy"),
  language: text("language").default("en"),
  dashboardWidgets: jsonb("dashboard_widgets"),
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

export const sopVersions = pgTable("sop_versions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sopId: varchar("sop_id", { length: 36 }).notNull().references(() => sops.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull().default(1),
  title: text("title").notNull(),
  content: text("content").notNull(),
  structuredData: jsonb("structured_data"),
  savedBy: varchar("saved_by", { length: 36 }).references(() => users.id),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSopVersionSchema = createInsertSchema(sopVersions).omit({ id: true, createdAt: true });
export type InsertSopVersion = z.infer<typeof insertSopVersionSchema>;
export type SopVersion = typeof sopVersions.$inferSelect;

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
  // Catalog fields
  class: varchar("class", { length: 50 }),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  markup: numeric("markup", { precision: 5, scale: 2 }),
  taxable: boolean("taxable").default(false),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0.0825"),
  overheadOverride: numeric("overhead_override", { precision: 5, scale: 4 }),
  profitMarginOverride: numeric("profit_margin_override", { precision: 5, scale: 4 }),
  priceLastUpdated: timestamp("price_last_updated"),
  lastUsed: timestamp("last_used"),
  retired: boolean("retired").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  qbItemId: varchar("qb_item_id", { length: 50 }),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// Class Pricing Defaults - overhead and profit margin defaults per class per year
export const classPricingDefaults = pgTable("class_pricing_defaults", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classCodes.id),
  year: integer("year").notNull(),
  overheadPct: numeric("overhead_pct", { precision: 5, scale: 4 }).notNull().default("0.15"),
  profitMarginPct: numeric("profit_margin_pct", { precision: 5, scale: 4 }).notNull().default("0.20"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  classYearUnique: unique().on(table.classId, table.year),
}));

export const insertClassPricingDefaultSchema = createInsertSchema(classPricingDefaults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClassPricingDefault = z.infer<typeof insertClassPricingDefaultSchema>;
export type ClassPricingDefault = typeof classPricingDefaults.$inferSelect;

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
export type ApplicantStage = "Application Received" | "Interview Scheduled" | "1st Interview" | "2nd Interview" | "Offer Extended" | "Hired" | "Declined / Not a Fit";
export type ApplicantSource = "BetterTeam" | "Indeed" | "Walk-in" | "Phone call" | "Email" | "Other";

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
  zoomMeetingUrl: text("zoom_meeting_url"),
  zoomMeetingId: text("zoom_meeting_id"),
  zoomPasscode: text("zoom_passcode"),
  lastNotifiedAt: timestamp("last_notified_at"),
  offerPay: text("offer_pay"),
  offerPayType: text("offer_pay_type"),
  offerStartDate: text("offer_start_date"),
  offerEmploymentType: text("offer_employment_type"),
  offerSchedule: text("offer_schedule"),
  offerBenefits: text("offer_benefits"),
  offerNotes: text("offer_notes"),
  offerAcceptanceToken: text("offer_acceptance_token"),
  offerAcceptanceExpiresAt: timestamp("offer_acceptance_expires_at"),
  offerAcceptedAt: timestamp("offer_accepted_at"),
  offerAcceptanceSignature: text("offer_acceptance_signature"),
  grade: text("grade"),
  candidateStatus: text("candidate_status").notNull().default("Active"),
  offerDeclinedAt: timestamp("offer_declined_at"),
  offerDeclineReason: text("offer_decline_reason"),
  offerCounterNote: text("offer_counter_note"),
  offerCounterSubmittedAt: timestamp("offer_counter_submitted_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  appliedDate: true,
  lastNotifiedAt: true,
  offerAcceptanceToken: true,
  offerAcceptanceExpiresAt: true,
  offerAcceptedAt: true,
  offerAcceptanceSignature: true,
  offerDeclinedAt: true,
  offerCounterSubmittedAt: true,
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
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHiringEmailTemplateSchema = createInsertSchema(hiringEmailTemplates).omit({ id: true, updatedAt: true });
export type InsertHiringEmailTemplate = z.infer<typeof insertHiringEmailTemplateSchema>;
export type HiringEmailTemplate = typeof hiringEmailTemplates.$inferSelect;

export const campaigns = pgTable("campaigns", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("Active"),
  spend: integer("spend").default(0),
  leads: integer("leads").default(0),
  cpl: integer("cpl").default(0),
  budget: integer("budget").default(0),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
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
  totalHours: integer("total_hours"),
  estimatedDays: integer("estimated_days"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactPhone2: text("contact_phone_2"),
  contactEmail: text("contact_email"),
  zone: text("zone"),
  notes: text("notes"),
  crewNotes: text("crew_notes"),
  crewNotesCustomerVisible: text("crew_notes_customer_visible"),
  crewLeadName: text("crew_lead_name"),
  scopeOfWork: text("scope_of_work"),
  materialsUsed: text("materials_used"),
  // Extended job fields
  customerId: uuid("customer_id"),
  propertyId: uuid("property_id"),
  title: varchar("title"),
  description: text("description"),
  status: varchar("status"),
  jobType: varchar("job_type"),
  price: numeric("price"),
  division: varchar("division"),
  color: varchar("color"),
  scheduledStartTime: text("scheduled_start_time"),
  scheduledEndTime: text("scheduled_end_time"),
  // Chain links (Phase 0 additions)
  estimateId: varchar("estimate_id"),
  sourceEstimateId: varchar("source_estimate_id"),
  crewLeadId: varchar("crew_lead_id"),
  // CompanyCam link (Phase 2 addition)
  companycamProjectId: varchar("companycam_project_id"),
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
  totalHours: true,
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

// ── Legacy form cluster (kept in schema so Drizzle does not generate DROPs) ──
// form_submissions.form_submission_id is a live FK on the candidates table.

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
  customFields: jsonb("custom_fields").$type<{ label: string; value: string }[]>().default([]),
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
  category: text("category").notNull().default("Care Guides"), // Care Guides, Manufacturer Info, Professional Documents, Seasonal Checklists
  season: text("season").default("N/A"), // Spring, Summer, Fall, Year-Round, N/A
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
  season: true,
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
  companySignature: text("company_signature"),
  hqContent: jsonb("hq_content").$type<{ vision?: string; mission?: string; goals?: Array<{ text: string; target: string; status: string }> }>(),
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
  companySignature: true,
  hqContent: true,
});

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

// Task Management System
export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: text("task_id").unique(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("standard"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  createdByUserId: varchar("created_by_user_id", { length: 36 }).references(() => users.id).notNull(),
  assignedToUserId: varchar("assigned_to_user_id", { length: 36 }).references(() => users.id),
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  dueTime: text("due_time"),
  category: text("category"),
  estimatedMinutes: integer("estimated_minutes"),
  location: text("location"),
  linkedRecordType: text("linked_record_type"),
  linkedRecordId: varchar("linked_record_id", { length: 36 }),
  reminderDate: timestamp("reminder_date"),
  reminderSent: boolean("reminder_sent").default(false),
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

export const taskComments = pgTable("task_comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

export const taskCustomFields = pgTable("task_custom_fields", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  fieldName: text("field_name").notNull(),
  fieldValue: text("field_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TaskCustomField = typeof taskCustomFields.$inferSelect;

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
  fileSize: integer("file_size"),
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
  auditPhase: text("audit_phase").default("pending"), // pending, researching, analyzing, checking, completed
  overallScore: integer("overall_score"),
  efficiencyScore: integer("efficiency_score"),
  reliabilityScore: integer("reliability_score"),
  customerExperienceScore: integer("customer_experience_score"),
  communicationScore: integer("communication_score"),
  findingsJson: jsonb("findings_json").default([]),
  recommendationsJson: jsonb("recommendations_json").default([]),
  suggestedStepsJson: jsonb("suggested_steps_json").default([]),
  connectorIssuesJson: jsonb("connector_issues_json").default([]),
  bestPracticesJson: jsonb("best_practices_json").default([]),
  estimatedImprovementTime: text("estimated_improvement_time"),
  estimatedCost: text("estimated_cost").default("0.00"),
  tokensUsed: integer("tokens_used").default(0),
  runDurationMs: integer("run_duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertProcessAuditResultSchema = createInsertSchema(processAuditResults).pick({
  processId: true,
  agentId: true,
  status: true,
  auditPhase: true,
  overallScore: true,
  efficiencyScore: true,
  reliabilityScore: true,
  customerExperienceScore: true,
  communicationScore: true,
  findingsJson: true,
  recommendationsJson: true,
  suggestedStepsJson: true,
  connectorIssuesJson: true,
  bestPracticesJson: true,
  estimatedImprovementTime: true,
  estimatedCost: true,
  tokensUsed: true,
  runDurationMs: true,
  errorMessage: true,
});

export type InsertProcessAuditResult = z.infer<typeof insertProcessAuditResultSchema>;
export type ProcessAuditResult = typeof processAuditResults.$inferSelect;

export const processAuditSchedules = pgTable("process_audit_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  processId: varchar("process_id", { length: 36 }).references(() => businessProcesses.id, { onDelete: "cascade" }).notNull(),
  frequency: text("frequency").notNull().default("weekly"), // daily, weekly, monthly, custom
  customIntervalDays: integer("custom_interval_days").default(7),
  isEnabled: boolean("is_enabled").default(true),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  lastAuditId: varchar("last_audit_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProcessAuditScheduleSchema = createInsertSchema(processAuditSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProcessAuditSchedule = z.infer<typeof insertProcessAuditScheduleSchema>;
export type ProcessAuditSchedule = typeof processAuditSchedules.$inferSelect;

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
  templateVariant: integer("template_variant").notNull().default(0),
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

export const builderFormSubmissions = pgTable("builder_form_submissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id", { length: 36 }).references(() => builderForms.id).notNull(),
  submittedBy: varchar("submitted_by", { length: 36 }).references(() => users.id),
  submitterName: text("submitter_name"),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  status: text("status").notNull().default("submitted"),
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBuilderFormSubmissionSchema = createInsertSchema(builderFormSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBuilderFormSubmission = z.infer<typeof insertBuilderFormSubmissionSchema>;
export type BuilderFormSubmission = typeof builderFormSubmissions.$inferSelect;

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

export const documentShares = pgTable("document_shares", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 36 }).references(() => documents.id).notNull(),
  module: text("module").notNull(),
  recordId: varchar("record_id", { length: 36 }),
  sharedByUserId: varchar("shared_by_user_id", { length: 36 }).references(() => users.id),
  sharedAt: timestamp("shared_at").defaultNow(),
});

export const insertDocumentShareSchema = createInsertSchema(documentShares).omit({ id: true, sharedAt: true });
export type InsertDocumentShare = z.infer<typeof insertDocumentShareSchema>;
export type DocumentShare = typeof documentShares.$inferSelect;

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

// Calendar Events
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("personal"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }).notNull(),
  endDatetime: timestamp("end_datetime", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  location: text("location"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id).notNull(),
  assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id),
  linkedRecordType: text("linked_record_type"),
  linkedRecordId: varchar("linked_record_id", { length: 36 }),
  googleEventId: text("google_event_id"),
  isCompanyEvent: boolean("is_company_event").notNull().default(false),
  isPrivate: boolean("is_private").notNull().default(false),
  recurrenceRule: text("recurrence_rule"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export const googleCalendarEvents = pgTable("google_calendar_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  googleEventId: text("google_event_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }).notNull(),
  endDatetime: timestamp("end_datetime", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  location: text("location"),
  calendarId: text("calendar_id"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export type GoogleCalendarEvent = typeof googleCalendarEvents.$inferSelect;

export const userCalendarSettings = pgTable("user_calendar_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  categoryKey: text("category_key").notNull(),
  displayName: text("display_name").notNull(),
  color: text("color").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserCalendarSetting = typeof userCalendarSettings.$inferSelect;

export const customerSuggestions = pgTable("customer_suggestions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("received"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSuggestionSchema = createInsertSchema(customerSuggestions).omit({
  id: true,
  customerId: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomerSuggestion = typeof customerSuggestions.$inferSelect;
export type InsertCustomerSuggestion = z.infer<typeof insertCustomerSuggestionSchema>;

export const ESTIMATE_STAGES = ["New Lead", "Contact Made", "Site Visit", "Proposal Sent", "Follow Up", "Won", "Lost"] as const;
export type EstimateStage = typeof ESTIMATE_STAGES[number];

// ─── LEGACY Estimate System (System A) ───────────────────────────────────────
// DO NOT build new features on these tables.
// The authoritative estimate system is salesEstimates (sales_estimates) + estimateLineItems
// + estimateWorkAreaGroups + calculatorRuns + catalogItems (System B).
// These legacy tables remain only for historical records already in the database.
export const estimates = pgTable("estimates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  serviceType: text("service_type").notNull(),
  stage: text("stage").$type<EstimateStage>().notNull().default("New Lead"),
  estimatedValue: integer("estimated_value").default(0),
  description: text("description"),
  propertyAddress: text("property_address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  source: text("source").default("manual"),
  workRequestId: varchar("work_request_id", { length: 36 }),
  assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id),
  customerId: varchar("customer_id", { length: 36 }).references(() => users.id),
  followUpDate: timestamp("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  issueDate: timestamp("issue_date").defaultNow(),
  sentDate: timestamp("sent_date"),
  validUntil: timestamp("valid_until"),
  // Signature fields
  signatureData: text("signature_data"),
  signatureType: text("signature_type"),
  signerName: text("signer_name"),
  signerInitials: text("signer_initials"),
  signerIp: text("signer_ip"),
  signedAt: timestamp("signed_at"),
  signedDocumentUrl: text("signed_document_url"),
  companycamProjectId: text("companycam_project_id"),
});

export const estimateItems = pgTable("estimate_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  estimateId: varchar("estimate_id", { length: 36 }).notNull().references(() => estimates.id),
  materialId: varchar("material_id", { length: 36 }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).default("0"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEstimateItemSchema = createInsertSchema(estimateItems).omit({
  id: true,
  createdAt: true,
});

export type InsertEstimateItem = z.infer<typeof insertEstimateItemSchema>;
export type EstimateItem = typeof estimateItems.$inferSelect;

export const insertEstimateSchema = createInsertSchema(estimates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type Estimate = typeof estimates.$inferSelect;

export const activityLog = pgTable("activity_log", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  description: text("description").notNull(),
  link: varchar("link", { length: 500 }),
  seenBy: jsonb("seen_by").default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_activity_log_created_at").on(t.createdAt),
]);

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
  seenBy: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

export const sopPipeline = pgTable("sop_pipeline", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  categoryId: varchar("category_id", { length: 36 }).references(() => sopCategories.id),
  sopType: text("sop_type").notNull().default("standard"),
  status: text("status").notNull().default("suggested"),
  priority: integer("priority").notNull().default(0),
  aiContext: jsonb("ai_context"),
  rejectedReason: text("rejected_reason"),
  generatedSopId: varchar("generated_sop_id", { length: 36 }).references(() => sops.id),
  suggestedAt: timestamp("suggested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
});

export const insertSopPipelineSchema = createInsertSchema(sopPipeline).omit({
  id: true,
  suggestedAt: true,
  approvedAt: true,
  completedAt: true,
  generatedSopId: true,
});

export type InsertSopPipeline = z.infer<typeof insertSopPipelineSchema>;
export type SopPipeline = typeof sopPipeline.$inferSelect;

export const sopPipelineSettings = pgTable("sop_pipeline_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  autoGenerateEnabled: boolean("auto_generate_enabled").notNull().default(false),
  generateFrequency: text("generate_frequency").notNull().default("daily"),
  maxPerRun: integer("max_per_run").notNull().default(1),
  lastAutoRun: timestamp("last_auto_run"),
  nextScheduledRun: timestamp("next_scheduled_run"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SopPipelineSettings = typeof sopPipelineSettings.$inferSelect;

export const jobApplications = pgTable("job_applications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: text("status").notNull().default("draft"),
  applicantName: text("applicant_name"),
  applicantEmail: text("applicant_email"),
  applicantPhone: text("applicant_phone"),
  position: text("position"),
  source: text("source"),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  submittedAt: timestamp("submitted_at"),
  candidateId: varchar("candidate_id", { length: 36 }),
  expiryDays: integer("expiry_days").notNull().default(30),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  expiryNotificationSentAt: timestamp("expiry_notification_sent_at"),
  customerId: varchar("customer_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }),
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  candidateId: true,
});
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type JobApplication = typeof jobApplications.$inferSelect;

// ─── Time Off Requests ────────────────────────────────────────────────────────
export const timeOffRequests = pgTable("time_off_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  requestType: varchar("request_type", { length: 50 }).notNull(), // Vacation | Sick | Personal | Unpaid
  startDate: varchar("start_date", { length: 20 }).notNull(),
  endDate: varchar("end_date", { length: 20 }).notNull(),
  totalDays: integer("total_days").notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("Pending"), // Pending | Approved | Denied
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({ id: true, createdAt: true, submittedAt: true, reviewedAt: true });
export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;

// ─── Resignation Letters ──────────────────────────────────────────────────────
export const resignationLetters = pgTable("resignation_letters", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  lastDayOfWork: varchar("last_day_of_work", { length: 20 }).notNull(),
  reasonForLeaving: text("reason_for_leaving"),
  additionalNotes: text("additional_notes"),
  signatureDataUrl: text("signature_data_url").notNull(),
  signatureDate: varchar("signature_date", { length: 20 }).notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertResignationLetterSchema = createInsertSchema(resignationLetters).omit({ id: true, createdAt: true, submittedAt: true });
export type InsertResignationLetter = z.infer<typeof insertResignationLetterSchema>;
export type ResignationLetter = typeof resignationLetters.$inferSelect;

// ─── Corrective Action Reports ────────────────────────────────────────────────
export const correctiveActions = pgTable("corrective_actions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  issuedByUserId: varchar("issued_by_user_id", { length: 36 }).references(() => users.id).notNull(),
  dateOfIncident: varchar("date_of_incident", { length: 20 }).notNull(),
  descriptionOfIssue: text("description_of_issue").notNull(),
  previousWarnings: boolean("previous_warnings").notNull().default(false),
  previousWarningsDescription: text("previous_warnings_description"),
  actionTaken: varchar("action_taken", { length: 50 }).notNull(), // Verbal Warning | Written Warning | Final Warning | Suspension | Termination
  employeeAcknowledgmentSignature: text("employee_acknowledgment_signature"),
  employeeAcknowledgmentDate: varchar("employee_acknowledgment_date", { length: 20 }),
  managerSignature: text("manager_signature").notNull(),
  managerSignatureDate: varchar("manager_signature_date", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Pending Signature"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCorrectiveActionSchema = createInsertSchema(correctiveActions).omit({ id: true, createdAt: true });
export type InsertCorrectiveAction = z.infer<typeof insertCorrectiveActionSchema>;
export type CorrectiveAction = typeof correctiveActions.$inferSelect;

// ─── Agreement Templates ──────────────────────────────────────────────────────
export const agreementTemplates = pgTable("agreement_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  positionTitle: text("position_title").notNull(),
  year: integer("year").notNull(),
  templateBody: text("template_body").notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAgreementTemplateSchema = createInsertSchema(agreementTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;

// ─── Employee Agreements (sent instances) ────────────────────────────────────
export const employeeAgreements = pgTable("employee_agreements", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id).notNull(),
  templateId: varchar("template_id", { length: 36 }).references(() => agreementTemplates.id).notNull(),
  sentByUserId: varchar("sent_by_user_id", { length: 36 }).references(() => users.id).notNull(),
  token: text("token").unique(),
  tokenExpiresAt: timestamp("token_expires_at"),
  sentAt: timestamp("sent_at").defaultNow(),
  signedAt: timestamp("signed_at"),
  signatureDataUrl: text("signature_data_url"),
  signerName: text("signer_name"),
  payRate: text("pay_rate"),
  startDate: varchar("start_date", { length: 20 }),
  renderedBody: text("rendered_body"),
  status: varchar("status", { length: 20 }).notNull().default("Pending"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertEmployeeAgreementSchema = createInsertSchema(employeeAgreements).omit({ id: true, createdAt: true, sentAt: true, signedAt: true });
export type InsertEmployeeAgreement = z.infer<typeof insertEmployeeAgreementSchema>;
export type EmployeeAgreement = typeof employeeAgreements.$inferSelect;

// ─── Quick Notes / Notepad ───────────────────────────────────────────────────
export const noteColorEnum = ["default", "yellow", "green", "blue", "purple", "red", "orange", "teal"] as const;
export type NoteColor = typeof noteColorEnum[number];

export const notes = pgTable("notes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title"),
  body: text("body"),
  color: text("color").default("default"),
  isPinned: boolean("is_pinned").default(false),
  isArchived: boolean("is_archived").default(false),
  tags: text("tags").array().default([]),
  reminderAt: timestamp("reminder_at"),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true, reminderSent: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

// ─── Daily Crew Worksheets ────────────────────────────────────────────────────
export const dailyWorksheets = pgTable("daily_worksheets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  submittedBy: varchar("submitted_by", { length: 36 }).references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | submitted

  // Conditions
  weatherConditions: text("weather_conditions").array().default([]),

  // Job Info
  customerName: text("customer_name").notNull().default(""),
  date: varchar("date", { length: 20 }).notNull().default(""),
  dayOfWeek: varchar("day_of_week", { length: 15 }),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  estimateNumber: varchar("estimate_number", { length: 50 }),
  contactPhone: varchar("contact_phone", { length: 20 }),

  // Foreman
  foremanName: text("foreman_name"),
  foremanArrivalTime: varchar("foreman_arrival_time", { length: 15 }),
  foremanDepartureTime: varchar("foreman_departure_time", { length: 15 }),
  foremanTotalHours: varchar("foreman_total_hours", { length: 10 }),
  foremanNotes: text("foreman_notes"),

  // Dynamic arrays (JSON)
  teamMembers: jsonb("team_members").notNull().default([]),
  workItems: jsonb("work_items").notNull().default([]),
  punchItems: jsonb("punch_items").notNull().default([]),
  chemicalLog: jsonb("chemical_log").notNull().default({}),
  equipmentLog: jsonb("equipment_log").notNull().default({}),

  // Notes & Signature
  additionalNotes: text("additional_notes"),
  signatureName: text("signature_name"),
  dateSigned: varchar("date_signed", { length: 20 }),

  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // Link to structured worksheet session
  worksheetSessionId: integer("worksheet_session_id"),

  // Linked job (optional)
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
});

export const insertDailyWorksheetSchema = createInsertSchema(dailyWorksheets).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true });
export type InsertDailyWorksheet = z.infer<typeof insertDailyWorksheetSchema>;
export type DailyWorksheet = typeof dailyWorksheets.$inferSelect;

// ── Worksheet Sessions ────────────────────────────────────────────────────────
export const worksheetSessions = pgTable("worksheet_sessions", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => users.id),
  date: date("date").notNull(),
  status: text("status").notNull().default("active"), // active | pending_review | submitted | approved | archived
  isDuplicate: boolean("is_duplicate").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

export const insertWorksheetSessionSchema = createInsertSchema(worksheetSessions).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true });
export type InsertWorksheetSession = z.infer<typeof insertWorksheetSessionSchema>;
export type WorksheetSession = typeof worksheetSessions.$inferSelect;

// ── Worksheet Time Entries ────────────────────────────────────────────────────
export const worksheetTimeEntries = pgTable("worksheet_time_entries", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => worksheetSessions.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  workAreaId: varchar("work_area_id", { length: 36 }), // no FK — table may not exist
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertWorksheetTimeEntrySchema = createInsertSchema(worksheetTimeEntries).omit({ id: true, createdAt: true });
export type InsertWorksheetTimeEntry = z.infer<typeof insertWorksheetTimeEntrySchema>;
export type WorksheetTimeEntry = typeof worksheetTimeEntries.$inferSelect;

// ── Worksheet Materials Used ──────────────────────────────────────────────────
export const worksheetMaterialsUsed = pgTable("worksheet_materials_used", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => worksheetSessions.id),
  materialId: varchar("material_id", { length: 36 }).references(() => materials.id),
  miscName: text("misc_name"),
  quantity: numeric("quantity").notNull(),
  unit: text("unit"),
  notes: text("notes"),
  receiptPhotos: text("receipt_photos").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorksheetMaterialsUsedSchema = createInsertSchema(worksheetMaterialsUsed).omit({ id: true, createdAt: true });
export type InsertWorksheetMaterialsUsed = z.infer<typeof insertWorksheetMaterialsUsedSchema>;
export type WorksheetMaterialsUsed = typeof worksheetMaterialsUsed.$inferSelect;

// ── Worksheet Photos ──────────────────────────────────────────────────────────
export const worksheetPhotos = pgTable("worksheet_photos", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => worksheetSessions.id),
  photoUrl: text("photo_url").notNull(),
  photoType: text("photo_type").notNull(), // receipt | work | before | after
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorksheetPhotoSchema = createInsertSchema(worksheetPhotos).omit({ id: true, createdAt: true });
export type InsertWorksheetPhoto = z.infer<typeof insertWorksheetPhotoSchema>;
export type WorksheetPhoto = typeof worksheetPhotos.$inferSelect;

// ── Time Cards ────────────────────────────────────────────────────────────────
export const timeCards = pgTable("time_cards", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => worksheetSessions.id),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => users.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  date: date("date").notNull(),
  clockInTime: timestamp("clock_in_time", { withTimezone: true }).notNull(),
  clockOutTime: timestamp("clock_out_time", { withTimezone: true }),
  totalMinutes: integer("total_minutes"),
  status: text("status").notNull().default("draft"), // draft | submitted | approved
  signatureName: text("signature_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at"),
  qboExportedAt: timestamp("qbo_exported_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTimeCardSchema = createInsertSchema(timeCards).omit({ id: true, createdAt: true });
export type InsertTimeCard = z.infer<typeof insertTimeCardSchema>;
export type TimeCard = typeof timeCards.$inferSelect;

// ─── Phase-3 Worksheets ───────────────────────────────────────────────────────
export const worksheets = pgTable("worksheets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  signatureUrl: text("signature_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userDateUniq: unique("worksheets_user_date_uidx").on(t.userId, t.date),
}));
export const insertWorksheetSchema = createInsertSchema(worksheets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorksheet = z.infer<typeof insertWorksheetSchema>;
export type Worksheet = typeof worksheets.$inferSelect;

export const worksheetMaterials = pgTable("worksheet_materials", {
  id: serial("id").primaryKey(),
  worksheetId: varchar("worksheet_id", { length: 36 }).notNull().references(() => worksheets.id, { onDelete: "cascade" }),
  materialName: text("material_name"),
  quantity: numeric("quantity"),
  unit: text("unit"),
  unitCost: numeric("unit_cost"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertWorksheetMaterialSchema = createInsertSchema(worksheetMaterials).omit({ id: true, createdAt: true });
export type InsertWorksheetMaterial = z.infer<typeof insertWorksheetMaterialSchema>;
export type WorksheetMaterial = typeof worksheetMaterials.$inferSelect;

export const worksheetExpenses = pgTable("worksheet_expenses", {
  id: serial("id").primaryKey(),
  worksheetId: varchar("worksheet_id", { length: 36 }).notNull().references(() => worksheets.id, { onDelete: "cascade" }),
  description: text("description"),
  amount: numeric("amount"),
  category: text("category"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertWorksheetExpenseSchema = createInsertSchema(worksheetExpenses).omit({ id: true, createdAt: true });
export type InsertWorksheetExpense = z.infer<typeof insertWorksheetExpenseSchema>;
export type WorksheetExpense = typeof worksheetExpenses.$inferSelect;

export const worksheetTeamMembers = pgTable("worksheet_team_members", {
  id: serial("id").primaryKey(),
  worksheetId: varchar("worksheet_id", { length: 36 }).notNull().references(() => worksheets.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  wsUserUniq: unique("worksheet_team_members_ws_user_uidx").on(t.worksheetId, t.userId),
}));
export const insertWorksheetTeamMemberSchema = createInsertSchema(worksheetTeamMembers).omit({ id: true, createdAt: true });
export type InsertWorksheetTeamMember = z.infer<typeof insertWorksheetTeamMemberSchema>;
export type WorksheetTeamMember = typeof worksheetTeamMembers.$inferSelect;

// ─── Estimating: Class Codes ──────────────────────────────────────────────────
// Mirrors the four values in CATALOG_CLASSES below; keyed by integer id so
// class_pricing_defaults and future estimate line items can FK to a stable PK.
export const classCodes = pgTable("class_codes", {
  id:        integer("id").primaryKey(),
  name:      varchar("name", { length: 50 }).notNull().unique(),
  label:     text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ClassCode = typeof classCodes.$inferSelect;

// ─── Estimating: Calculator Framework (Phase E2) ──────────────────────────────
export const calculatorDefinitions = pgTable("calculator_definitions", {
  id:             varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name:           varchar("name", { length: 100 }).notNull().unique(),
  displayName:    text("display_name").notNull(),
  category:       varchar("category", { length: 50 }).notNull(),
  description:    text("description"),
  inputSchema:    jsonb("input_schema").notNull(),
  formula:        jsonb("formula").notNull(),
  defaultClassId: integer("default_class_id").references(() => classCodes.id),
  isActive:       boolean("is_active").notNull().default(true),
  sortOrder:      integer("sort_order").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCalculatorDefinitionSchema = createInsertSchema(calculatorDefinitions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCalculatorDefinition = z.infer<typeof insertCalculatorDefinitionSchema>;
export type CalculatorDefinition = typeof calculatorDefinitions.$inferSelect;

export const calculatorRuns = pgTable("calculator_runs", {
  id:                   varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  calculatorId:         varchar("calculator_id", { length: 36 }).notNull().references(() => calculatorDefinitions.id, { onDelete: "restrict" }),
  estimateWorkAreaId:   varchar("estimate_work_area_id", { length: 36 }).notNull(),
  inputs:               jsonb("inputs").notNull(),
  outputSummary:        jsonb("output_summary").notNull(),
  runBy:                varchar("run_by", { length: 36 }),
  runAt:                timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCalculatorRunSchema = createInsertSchema(calculatorRuns).omit({ id: true, runAt: true });
export type InsertCalculatorRun = z.infer<typeof insertCalculatorRunSchema>;
export type CalculatorRun = typeof calculatorRuns.$inferSelect;

// ─── Estimating: Line Items (Phase newEstimates + E2 Polish) ──────────────────
export const estimateLineItems = pgTable("estimate_line_items", {
  id:                 varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  estimateWorkAreaId: varchar("estimate_work_area_id", { length: 36 }).notNull(),
  itemType:           varchar("item_type", { length: 20 }).notNull().default("service"),
  description:        text("description").notNull(),
  quantity:           numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit:               varchar("unit", { length: 30 }),
  unitPrice:          numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  amount:             numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder:          integer("sort_order").notNull().default(0),
  isOptional:         boolean("is_optional").notNull().default(false),
  imageUrl:           text("image_url"),
  imageHidden:        boolean("image_hidden").default(false),
  classId:            integer("class_id").references(() => classCodes.id),
  catalogItemId:      integer("catalog_item_id").references(() => catalogItems.id),
  markupPct:          numeric("markup_pct", { precision: 5, scale: 2 }),
});
export const insertEstimateLineItemSchema = createInsertSchema(estimateLineItems).omit({ id: true });
export type InsertEstimateLineItem = z.infer<typeof insertEstimateLineItemSchema>;
export type EstimateLineItem = typeof estimateLineItems.$inferSelect;

// ─── Materials Catalog ────────────────────────────────────────────────────────
export const CATALOG_CLASSES = ["Labor", "Equipment", "Materials", "Subcontracting"] as const;
export type CatalogClass = typeof CATALOG_CLASSES[number];

export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  itemNumber: varchar("item_number", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  class: varchar("class", { length: 50 }),
  category: varchar("category", { length: 100 }),
  units: varchar("units", { length: 50 }),
  cost: numeric("cost", { precision: 10, scale: 2 }).default("0"),
  taxable: boolean("taxable").default(true),
  description: text("description"),
  sku: varchar("sku", { length: 100 }),
  otherOptions: text("other_options"),
  imageUrl: text("image_url"),
  imageHidden: boolean("image_hidden").default(false),
  optionImages: jsonb("option_images").$type<Record<string, string>>().default({}),
  optionImagesHidden: jsonb("option_images_hidden").$type<Record<string, boolean>>().default({}),
  isActive: boolean("is_active").default(true),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }).default("0"),
  qbItemId: varchar("qb_item_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCatalogItemSchema = createInsertSchema(catalogItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCatalogItem = z.infer<typeof insertCatalogItemSchema>;
export type CatalogItem = typeof catalogItems.$inferSelect;

export const catalogTags = pgTable("catalog_tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
});

export const insertCatalogTagSchema = createInsertSchema(catalogTags).omit({ id: true });
export type InsertCatalogTag = z.infer<typeof insertCatalogTagSchema>;
export type CatalogTag = typeof catalogTags.$inferSelect;

export const catalogItemTags = pgTable("catalog_item_tags", {
  itemId: integer("item_id").notNull().references(() => catalogItems.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => catalogTags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.itemId, t.tagId] }),
}));

// ── Server-managed tables (reconciled into Drizzle tracking) ─────────────────

export const workAreaTypes = pgTable("work_area_types", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: varchar("name", { length: 100 }).notNull(),
  division: varchar("division", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  costCode: text("cost_code"),
  qbServiceName: text("qb_service_name"),
});

export const jobWorkAreas = pgTable("job_work_areas", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, { onDelete: "cascade" }),
  workAreaTypeId: varchar("work_area_type_id", { length: 36 }).references(() => workAreaTypes.id),
  name: varchar("name", { length: 100 }).notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
});

// ── Job Line Items (copied from estimate at conversion time) ─────────────────
// Additive-only, separate from job_materials (the pre-existing ad-hoc Job
// Materials feature). Structured scope/material records linked back to the
// source estimate line item. No inventory/stock fields by design.
export const jobLineItems = pgTable("job_line_items", {
  id:                       varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  jobId:                    varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  jobWorkAreaId:            varchar("job_work_area_id", { length: 36 }).references(() => jobWorkAreas.id, { onDelete: "set null" }),
  sourceEstimateId:         uuid("source_estimate_id"),
  sourceEstimateLineItemId: uuid("source_estimate_line_item_id").references(() => estimateLineItems.id, { onDelete: "set null" }),
  itemType:                 varchar("item_type", { length: 20 }).notNull().default("service"),
  catalogItemId:            integer("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
  classId:                  integer("class_id").references(() => classCodes.id, { onDelete: "set null" }),
  itemName:                 text("item_name").notNull(),
  quantity:                 numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit:                     varchar("unit", { length: 30 }),
  unitPrice:                numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  lineTotal:                numeric("line_total", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder:                integer("sort_order").notNull().default(0),
  isOptional:               boolean("is_optional").notNull().default(false),
  notes:                    text("notes"),
  createdById:              varchar("created_by_id", { length: 36 }),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertJobLineItemSchema = createInsertSchema(jobLineItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobLineItem = z.infer<typeof insertJobLineItemSchema>;
export type JobLineItem = typeof jobLineItems.$inferSelect;

export const timeEntries = pgTable("time_entries", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, { onDelete: "set null" }),
  clockIn: timestamp("clock_in", { withTimezone: true }).notNull().defaultNow(),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  entryType: varchar("entry_type", { length: 20 }).notNull().default("billable"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  jobWorkAreaId: varchar("job_work_area_id", { length: 36 }).references(() => jobWorkAreas.id, { onDelete: "set null" }),
  workAreaName: varchar("work_area_name", { length: 100 }),
  localId: text("local_id"),
  qboExportedAt: timestamp("qbo_exported_at", { withTimezone: true }),
  qboTimeActivityId: text("qbo_time_activity_id"),
  qboExportError: text("qbo_export_error"),
  approvalStatus: varchar("approval_status", { length: 20 }).notNull().default("pending"),
  rejectionNote: text("rejection_note"),
  autoClockedOut: boolean("auto_clocked_out").notNull().default(false),
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  worksheetSessionId: integer("worksheet_session_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  editedBy: varchar("edited_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
});

export const gpsPings = pgTable("gps_pings", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  timeEntryId: varchar("time_entry_id", { length: 36 }).references(() => timeEntries.id, { onDelete: "cascade" }),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  accuracy: real("accuracy"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobAssignments = pgTable("job_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  scheduledDate: date("scheduled_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const termsAndConditions = pgTable("terms_and_conditions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  customerId: uuid("customer_id"),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  issuedDate: date("issued_date").notNull().default(sql`CURRENT_DATE`),
  dueDate: date("due_date"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).default("0"),
  balanceDue: numeric("balance_due", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  terms: text("terms"),
  customerMessage: text("customer_message"),
  customerResponse: text("customer_response"),
  customerResponseAt: timestamp("customer_response_at", { withTimezone: true }),
  customerResponseNote: text("customer_response_note"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  qbInvoiceId: varchar("qb_invoice_id", { length: 50 }),
  qbSyncedAt: timestamp("qb_synced_at", { withTimezone: true }),
  estimateId: text("estimate_id"),
  invoiceType: varchar("invoice_type", { length: 50 }).default("standard"),
  overdueEmailSentAt: timestamp("overdue_email_sent_at", { withTimezone: true }),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).default("0"),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
  sortOrder: integer("sort_order").default(0),
});

export const payments = pgTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull().references(() => invoices.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 30 }).default("cash"),
  paymentDate: date("payment_date").notNull().default(sql`CURRENT_DATE`),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── CompanyCam Integration (Phase 1 v2) ──────────────────────────────────────

export const companycamUsers = pgTable("companycam_users", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companycamUserId: text("companycam_user_id").notNull().unique(),
  emailAddress:     text("email_address"),
  firstName:        text("first_name"),
  lastName:         text("last_name"),
  phoneNumber:      text("phone_number"),
  status:           text("status"),
  lastSyncedAt:     timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCompanycamUserSchema = createInsertSchema(companycamUsers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanycamUser = z.infer<typeof insertCompanycamUserSchema>;
export type CompanycamUser = typeof companycamUsers.$inferSelect;

export const companycamProjects = pgTable("companycam_projects", {
  id:                        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companycamProjectId:       text("companycam_project_id").notNull().unique(),
  name:                      text("name").notNull(),
  status:                    text("status"),
  addressStreet1:            text("address_street_1"),
  addressStreet2:            text("address_street_2"),
  addressCity:               text("address_city"),
  addressState:              text("address_state"),
  addressPostalCode:         text("address_postal_code"),
  addressCountry:            text("address_country"),
  latitude:                  numeric("latitude",  { precision: 10, scale: 7 }),
  longitude:                 numeric("longitude", { precision: 10, scale: 7 }),
  creatorCompanycamUserId:   text("creator_companycam_user_id"),
  archived:                  boolean("archived").notNull().default(false),
  public:                    boolean("public").notNull().default(true),
  featureImageUrl:           text("feature_image_url"),
  rawPayload:                jsonb("raw_payload"),
  estimateId:                uuid("estimate_id"),
  customerId:                uuid("customer_id"),
  jobId:                     varchar("job_id"),
  ccCreatedAt:               timestamp("cc_created_at", { withTimezone: true }),
  ccUpdatedAt:               timestamp("cc_updated_at", { withTimezone: true }),
  createdAt:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                 timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCompanycamProjectSchema = createInsertSchema(companycamProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanycamProject = z.infer<typeof insertCompanycamProjectSchema>;
export type CompanycamProject = typeof companycamProjects.$inferSelect;

export const companycamPhotos = pgTable("companycam_photos", {
  id:                        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companycamPhotoId:         text("companycam_photo_id").notNull().unique(),
  companycamProjectId:       text("companycam_project_id").notNull(),
  photoUrlOriginal:          text("photo_url_original"),
  photoUrlWeb:               text("photo_url_web"),
  photoUrlThumbnail:         text("photo_url_thumbnail"),
  photoUrlWebAnnotation:     text("photo_url_web_annotation"),
  capturedAt:                timestamp("captured_at", { withTimezone: true }),
  latitude:                  numeric("latitude",  { precision: 10, scale: 7 }),
  longitude:                 numeric("longitude", { precision: 10, scale: 7 }),
  creatorCompanycamUserId:   text("creator_companycam_user_id"),
  capturedByEmail:           text("captured_by_email"),
  capturedByName:            text("captured_by_name"),
  companycamAppUrl:          text("companycam_app_url"),
  description:               text("description"),
  internal:                  boolean("internal").notNull().default(false),
  hash:                      text("hash"),
  processingStatus:          text("processing_status"),
  rawPayload:                jsonb("raw_payload"),
  createdAt:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  workAreaGroupId:           uuid("work_area_group_id"),
});
export const insertCompanycamPhotoSchema = createInsertSchema(companycamPhotos).omit({ id: true, createdAt: true });
export type InsertCompanycamPhoto = z.infer<typeof insertCompanycamPhotoSchema>;
export type CompanycamPhoto = typeof companycamPhotos.$inferSelect;

// ─── Estimate Work Area Groups (Phase 2 Wave 1.5c) ────────────────────────────
export const estimateWorkAreaGroups = pgTable("estimate_work_area_groups", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  salesEstimateId: uuid("sales_estimate_id").notNull(),
  name:            text("name").notNull(),
  sortOrder:       integer("sort_order").notNull().default(0),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertEstimateWorkAreaGroupSchema = createInsertSchema(estimateWorkAreaGroups).omit({ id: true, createdAt: true });
export type InsertEstimateWorkAreaGroup = z.infer<typeof insertEstimateWorkAreaGroupSchema>;
export type EstimateWorkAreaGroup = typeof estimateWorkAreaGroups.$inferSelect;

export const companycamPhotoTags = pgTable("companycam_photo_tags", {
  id:                uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companycamPhotoId: text("companycam_photo_id").notNull(),
  tagValue:          text("tag_value").notNull(),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCompanycamPhotoTagSchema = createInsertSchema(companycamPhotoTags).omit({ id: true, createdAt: true });
export type InsertCompanycamPhotoTag = z.infer<typeof insertCompanycamPhotoTagSchema>;
export type CompanycamPhotoTag = typeof companycamPhotoTags.$inferSelect;

export const companycamProjectLabels = pgTable("companycam_project_labels", {
  id:                   uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companycamProjectId:  text("companycam_project_id").notNull(),
  labelValue:           text("label_value").notNull(),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCompanycamProjectLabelSchema = createInsertSchema(companycamProjectLabels).omit({ id: true, createdAt: true });
export type InsertCompanycamProjectLabel = z.infer<typeof insertCompanycamProjectLabelSchema>;
export type CompanycamProjectLabel = typeof companycamProjectLabels.$inferSelect;

export const companycamWalkthroughs = pgTable("companycam_walkthroughs", {
  id:                    uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companycamDocumentId:  text("companycam_document_id").notNull().unique(),
  companycamProjectId:   text("companycam_project_id").notNull(),
  documentType:          text("document_type").notNull(),
  content:               text("content"),
  ccCreatedAt:           timestamp("cc_created_at", { withTimezone: true }),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCompanycamWalkthroughSchema = createInsertSchema(companycamWalkthroughs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanycamWalkthrough = z.infer<typeof insertCompanycamWalkthroughSchema>;
export type CompanycamWalkthrough = typeof companycamWalkthroughs.$inferSelect;

export const voiceTranscripts = pgTable("voice_transcripts", {
  id:                      uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId:              text("external_id").notNull().unique(),
  appointmentId:           varchar("appointment_id",           { length: 36 }),
  suggestedAppointmentId:  varchar("suggested_appointment_id", { length: 36 }),
  transcriptText:          text("transcript_text"),
  source:                  text("source"),
  audioDurationSeconds:    integer("audio_duration_seconds"),
  recordedAt:              timestamp("recorded_at",     { withTimezone: true }),
  recordedByEmail:         text("recorded_by_email"),
  summaryText:             text("summary_text"),
  transcriptFormat:        text("transcript_format").notNull().default("json"),
  estimateId:              uuid("estimate_id"),
  customerId:              uuid("customer_id"),
  suggestedEstimateId:     uuid("suggested_estimate_id"),
  suggestedCustomerId:     uuid("suggested_customer_id"),
  linkConfirmedAt:         timestamp("link_confirmed_at", { withTimezone: true }),
  rawPayload:              jsonb("raw_payload"),
  createdAt:               timestamp("created_at",      { withTimezone: true }).notNull().defaultNow(),
});
export const insertVoiceTranscriptSchema = createInsertSchema(voiceTranscripts).omit({ id: true, createdAt: true });
export type InsertVoiceTranscript = z.infer<typeof insertVoiceTranscriptSchema>;
export type VoiceTranscript = typeof voiceTranscripts.$inferSelect;

// ─── Daily Agenda ─────────────────────────────────────────────────────────────
export const dailyAgendas = pgTable("daily_agendas", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:         text("user_id").notNull(),
  date:           text("date").notNull(),
  todoItems:      jsonb("todo_items").notNull().default(sql`'[]'::jsonb`),
  delegateItems:  jsonb("delegate_items").notNull().default(sql`'[]'::jsonb`),
  equipmentItems: jsonb("equipment_items").notNull().default(sql`'[]'::jsonb`),
  needOrderItems: jsonb("need_order_items").notNull().default(sql`'[]'::jsonb`),
  newLeads:       jsonb("new_leads").notNull().default(sql`'[]'::jsonb`),
  memoItems:      jsonb("memo_items").notNull().default(sql`'[]'::jsonb`),
  callItems:      jsonb("call_items").notNull().default(sql`'[]'::jsonb`),
  otherItems:     jsonb("other_items").notNull().default(sql`'[]'::jsonb`),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertDailyAgendaSchema = createInsertSchema(dailyAgendas).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyAgenda = z.infer<typeof insertDailyAgendaSchema>;
export type DailyAgendaRecord = typeof dailyAgendas.$inferSelect;

// ─── Properties ───────────────────────────────────────────────────────────────
// Registered from live DB (existed via raw migration). Landscaping is property-centered.
export const properties = pgTable("properties", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId:   uuid("customer_id").notNull(),
  address:      text("address").notNull(),
  city:         text("city"),
  state:        text("state"),
  zip:          text("zip"),
  propertyType: text("property_type"),
  notes:        text("notes"),
  accessNotes:  text("access_notes"),
  gateCode:     text("gate_code"),
  hasPets:      boolean("has_pets").default(false),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// ─── Customers (entity — separate from users auth table) ──────────────────────
// Registered from live DB. The customers table holds business-entity customer records.
// Users with role="Customer" are their portal login accounts; this table stores CRM data.
export const customersEntity = pgTable("customers", {
  id:                    uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName:             text("first_name").notNull(),
  lastName:              text("last_name").notNull(),
  companyName:           text("company_name"),
  billingAddress:        text("billing_address"),
  billingCity:           text("billing_city"),
  billingState:          text("billing_state"),
  billingZip:            text("billing_zip"),
  source:                text("source"),
  notes:                 text("notes"),
  isActive:              boolean("is_active").notNull().default(true),
  qbCustomerId:          varchar("qb_customer_id"),
  qbSyncedAt:            timestamp("qb_synced_at", { withTimezone: true }),
  companycamProjectId:   text("companycam_project_id"),
  companycamCreateStatus: text("companycam_create_status"),
  companycamCreateError:  text("companycam_create_error"),
  createdAt:             timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const insertCustomerEntitySchema = createInsertSchema(customersEntity).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerEntity = z.infer<typeof insertCustomerEntitySchema>;
export type CustomerEntity = typeof customersEntity.$inferSelect;

// ─── Customer Contacts ────────────────────────────────────────────────────────
// Multiple contacts per customer (owner, spouse, billing contact, site contact, etc.)
export const customerContacts = pgTable("customer_contacts", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").notNull(),
  firstName:  text("first_name").notNull(),
  lastName:   text("last_name"),
  role:       text("role"),
  phone:      text("phone"),
  email:      text("email"),
  isPrimary:  boolean("is_primary").default(false),
  notes:      text("notes"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const insertCustomerContactSchema = createInsertSchema(customerContacts).omit({ id: true, createdAt: true });
export type InsertCustomerContact = z.infer<typeof insertCustomerContactSchema>;
export type CustomerContact = typeof customerContacts.$inferSelect;

// ─── Consultations ────────────────────────────────────────────────────────────
// Separate from estimates. Consultations are sales pipeline records (leads → booked).
// Estimates are financial proposals generated from consultations.
export const consultations = pgTable("consultations", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId:         uuid("customer_id"),
  propertyId:         uuid("property_id"),
  contactId:          uuid("contact_id"),
  contactName:        varchar("contact_name"),
  contactPhone:       varchar("contact_phone"),
  contactEmail:       varchar("contact_email"),
  scheduledDate:      date("scheduled_date"),
  scheduledTime:      text("scheduled_time"),
  durationMinutes:    integer("duration_minutes").default(60),
  status:             varchar("status").notNull().default("scheduled"),
  address:            text("address"),
  notes:              text("notes"),
  followUpRequired:   boolean("follow_up_required").default(false),
  followUpDate:       date("follow_up_date"),
  nextFollowUpDate:   date("next_follow_up_date"),
  assignedTo:         varchar("assigned_to"),
  estimatedValue:     numeric("estimated_value"),
  leadSource:         varchar("lead_source"),
  leadScore:          integer("lead_score").default(0),
  lostReason:         text("lost_reason"),
  pipelineStage:      varchar("pipeline_stage").default("new_lead"),
  budgetRange:        varchar("budget_range"),
  projectDescription: text("project_description"),
  bestTimeToReach:    varchar("best_time_to_reach"),
  utilitiesMarked:    boolean("utilities_marked").default(false),
  permitRequired:     boolean("permit_required").default(false),
  permitStatus:       varchar("permit_status"),
  serviceType:        varchar("service_type"),
  photoUrls:          jsonb("photo_urls").default(sql`'[]'::jsonb`),
  howHeard:           varchar("how_heard"),
  projectType:        varchar("project_type"),
  desiredTimeline:    varchar("desired_timeline"),
  additionalNotes:    text("additional_notes"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertConsultationSchema = createInsertSchema(consultations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultations.$inferSelect;

// ─── Sales Estimates (System B — AUTHORITATIVE) ───────────────────────────────
// This is the authoritative estimate system. Use salesEstimates + estimateLineItems
// + estimateWorkAreaGroups + calculatorRuns + catalogItems for all new estimate work.
// The older `estimates` + `estimateItems` tables are LEGACY — do not build new features on them.
export const salesEstimates = pgTable("sales_estimates", {
  id:                          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  estimateNumber:              varchar("estimate_number"),
  customerId:                  uuid("customer_id"),
  propertyId:                  uuid("property_id"),
  estimateType:                varchar("estimate_type").notNull().default("project"),
  templateName:                varchar("template_name"),
  title:                       varchar("title").notNull().default("New Estimate"),
  status:                      varchar("status").notNull().default("draft"),
  salespersonId:               varchar("salesperson_id"),
  validUntil:                  date("valid_until"),
  issuedDate:                  date("issued_date").notNull().default(sql`CURRENT_DATE`),
  subtotal:                    numeric("subtotal").notNull().default("0"),
  taxRate:                     numeric("tax_rate").notNull().default("0"),
  taxAmount:                   numeric("tax_amount").notNull().default("0"),
  discountAmount:              numeric("discount_amount").notNull().default("0"),
  total:                       numeric("total").notNull().default("0"),
  downPaymentPercent:          numeric("down_payment_percent").notNull().default("0"),
  downPaymentAmount:           numeric("down_payment_amount").notNull().default("0"),
  notes:                       text("notes"),
  customerMessage:             text("customer_message"),
  terms:                       text("terms"),
  customerResponse:            text("customer_response"),
  customerResponseAt:          timestamp("customer_response_at", { withTimezone: true }),
  customerResponseNote:        text("customer_response_note"),
  sentAt:                      timestamp("sent_at", { withTimezone: true }),
  viewedAt:                    timestamp("viewed_at", { withTimezone: true }),
  convertedAt:                 timestamp("converted_at", { withTimezone: true }),
  convertedJobId:              varchar("converted_job_id"),
  presentationStyle:           varchar("presentation_style").default("simple"),
  portalToken:                 text("portal_token"),
  signatureData:               text("signature_data"),
  termsAndConditionsOverride:  text("terms_and_conditions_override"),
  depositPercentage:           integer("deposit_percentage").default(50),
  initials:                    text("initials"),
  approvedAt:                  timestamp("approved_at", { withTimezone: true }),
  companycamProjectId:         text("companycam_project_id"),
  consultationId:              uuid("consultation_id"),
  createdAt:                   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertSalesEstimateSchema = createInsertSchema(salesEstimates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesEstimate = z.infer<typeof insertSalesEstimateSchema>;
export type SalesEstimate = typeof salesEstimates.$inferSelect;

// ─── Work Orders ──────────────────────────────────────────────────────────────
// Full work order system with 8 child tables. Real DB tables, registered here for type safety.
export const workOrders = pgTable("work_orders", {
  id:                      serial("id").primaryKey(),
  jobId:                   text("job_id"),
  title:                   text("title").notNull(),
  description:             text("description"),
  status:                  text("status").notNull().default("draft"),
  scheduledDate:           date("scheduled_date"),
  officeNotes:             text("office_notes"),
  assignedCrew:            jsonb("assigned_crew").default(sql`'[]'::jsonb`),
  createdBy:               text("created_by"),
  woType:                  text("wo_type").notNull().default("maintenance_visit"),
  priority:                text("priority").notNull().default("normal"),
  serviceTypeId:           text("service_type_id"),
  crewLeaderId:            text("crew_leader_id"),
  estimatedDuration:       text("estimated_duration"),
  estimatedHours:          numeric("estimated_hours"),
  propertyNotes:           text("property_notes"),
  siteAccessNotes:         text("site_access_notes"),
  safetyNotes:             text("safety_notes"),
  customerName:            text("customer_name"),
  customerAddress:         text("customer_address"),
  customerPhone:           text("customer_phone"),
  contractValue:           numeric("contract_value"),
  estimatedCompletionDate: date("estimated_completion_date"),
  companycamProjectId:     text("companycam_project_id"),
  createdAt:               timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;

export const workOrderAreas = pgTable("work_order_areas", {
  id:             serial("id").primaryKey(),
  workOrderId:    integer("work_order_id").notNull(),
  name:           text("name").notNull(),
  description:    text("description"),
  estimatedHours: numeric("estimated_hours"),
  sortOrder:      integer("sort_order").notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderArea = typeof workOrderAreas.$inferSelect;

export const workOrderMaterials = pgTable("work_order_materials", {
  id:            serial("id").primaryKey(),
  workOrderId:   integer("work_order_id"),
  areaId:        integer("area_id"),
  itemName:      text("item_name").notNull(),
  quantity:      numeric("quantity"),
  unit:          text("unit"),
  catalogItemId: integer("catalog_item_id"),
  status:        text("status").notNull(),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderMaterial = typeof workOrderMaterials.$inferSelect;

export const workOrderTools = pgTable("work_order_tools", {
  id:          serial("id").primaryKey(),
  workOrderId: integer("work_order_id"),
  areaId:      integer("area_id"),
  itemName:    text("item_name").notNull(),
  quantity:    numeric("quantity"),
  unit:        text("unit"),
  notes:       text("notes"),
  status:      text("status").notNull().default("needed"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderTool = typeof workOrderTools.$inferSelect;

export const workOrderSteps = pgTable("work_order_steps", {
  id:             serial("id").primaryKey(),
  workOrderId:    integer("work_order_id"),
  stepNumber:     integer("step_number").notNull(),
  title:          text("title").notNull(),
  description:    text("description"),
  requiresPhoto:  boolean("requires_photo"),
  isComplete:     boolean("is_complete"),
  completedBy:    text("completed_by"),
  completedAt:    timestamp("completed_at", { withTimezone: true }),
  completionNote: text("completion_note"),
  photos:         jsonb("photos"),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderStep = typeof workOrderSteps.$inferSelect;

export const workOrderChecklists = pgTable("work_order_checklists", {
  id:          serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull(),
  areaId:      integer("area_id"),
  label:       text("label").notNull(),
  isComplete:  boolean("is_complete"),
  completedBy: text("completed_by"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sortOrder:   integer("sort_order").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderChecklist = typeof workOrderChecklists.$inferSelect;

export const workOrderHoldPoints = pgTable("work_order_hold_points", {
  id:          serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull(),
  areaId:      integer("area_id"),
  label:       text("label").notNull(),
  description: text("description"),
  isApproved:  boolean("is_approved"),
  approvedBy:  text("approved_by"),
  approvedAt:  timestamp("approved_at", { withTimezone: true }),
  sortOrder:   integer("sort_order").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderHoldPoint = typeof workOrderHoldPoints.$inferSelect;

export const workOrderAreaTasks = pgTable("work_order_area_tasks", {
  id:            serial("id").primaryKey(),
  workOrderId:   integer("work_order_id").notNull(),
  areaId:        integer("area_id").notNull(),
  title:         text("title").notNull(),
  description:   text("description"),
  requiresPhoto: boolean("requires_photo"),
  isComplete:    boolean("is_complete"),
  completedBy:   text("completed_by"),
  completedAt:   timestamp("completed_at", { withTimezone: true }),
  photos:        jsonb("photos"),
  sortOrder:     integer("sort_order").notNull(),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type WorkOrderAreaTask = typeof workOrderAreaTasks.$inferSelect;

export const workOrderDailyLogs = pgTable("work_order_daily_logs", {
  id:                      serial("id").primaryKey(),
  workOrderId:             integer("work_order_id"),
  logDate:                 date("log_date").notNull(),
  workCompleted:           text("work_completed"),
  crewNotes:               text("crew_notes"),
  materialsNeededTomorrow: text("materials_needed_tomorrow"),
  truckEmptied:            boolean("truck_emptied"),
  truckLoaded:             boolean("truck_loaded"),
  truckFueled:             boolean("truck_fueled"),
  truckClean:              boolean("truck_clean"),
  truckNotes:              text("truck_notes"),
  officeUpdate:            text("office_update"),
  submittedBy:             text("submitted_by"),
  submittedAt:             timestamp("submitted_at", { withTimezone: true }),
});
export type WorkOrderDailyLog = typeof workOrderDailyLogs.$inferSelect;

// ─── Direct Messages (Gmail-style DM system) ──────────────────────────────────
// The original single-message inbox system (directMessages).
// Also registers the newer conversation-threaded system (dmConversations/dmMessages).
export const directMessages = pgTable("direct_messages", {
  id:                  varchar("id").primaryKey(),
  senderId:            varchar("sender_id").notNull(),
  recipientId:         varchar("recipient_id").notNull(),
  subject:             text("subject"),
  body:                text("body").notNull(),
  sentAt:              timestamp("sent_at"),
  readAt:              timestamp("read_at"),
  deletedBySender:     boolean("deleted_by_sender").notNull().default(false),
  deletedByRecipient:  boolean("deleted_by_recipient").notNull().default(false),
  starredBySender:     boolean("starred_by_sender").notNull().default(false),
  starredByRecipient:  boolean("starred_by_recipient").notNull().default(false),
  archivedBySender:    boolean("archived_by_sender").notNull().default(false),
  archivedByRecipient: boolean("archived_by_recipient").notNull().default(false),
  jobId:               varchar("job_id"),
  taskId:              varchar("task_id"),
});
export type DirectMessage = typeof directMessages.$inferSelect;

export const dmConversations = pgTable("dm_conversations", {
  id:             serial("id").primaryKey(),
  participant1Id: varchar("participant1_id").notNull(),
  participant2Id: varchar("participant2_id").notNull(),
  lastMessageAt:  timestamp("last_message_at"),
  createdAt:      timestamp("created_at"),
});
export type DmConversation = typeof dmConversations.$inferSelect;

export const dmMessages = pgTable("dm_messages", {
  id:             serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId:       varchar("sender_id").notNull(),
  body:           text("body").notNull(),
  createdAt:      timestamp("created_at"),
});
export type DmMessage = typeof dmMessages.$inferSelect;

export const dmReads = pgTable("dm_reads", {
  conversationId: integer("conversation_id").notNull(),
  userId:         varchar("user_id").notNull(),
  lastReadAt:     timestamp("last_read_at"),
});
export type DmRead = typeof dmReads.$inferSelect;

// ─── Message Folders (custom Gmail-style folders for DMs) ─────────────────────
export const messageFolders = pgTable("message_folders", {
  id:        serial("id").primaryKey(),
  userId:    varchar("user_id").notNull(),
  name:      text("name").notNull(),
  color:     text("color"),
  createdAt: timestamp("created_at"),
});
export type MessageFolder = typeof messageFolders.$inferSelect;

export const messageFolderItems = pgTable("message_folder_items", {
  id:                   varchar("id").primaryKey(),
  folderId:             varchar("folder_id").notNull(),
  conversationPartnerId: varchar("conversation_partner_id").notNull(),
  userId:               varchar("user_id").notNull(),
  createdAt:            timestamp("created_at"),
});
export type MessageFolderItem = typeof messageFolderItems.$inferSelect;

export const messageNotifications = pgTable("message_notifications", {
  id:        varchar("id").primaryKey(),
  userId:    varchar("user_id").notNull(),
  messageId: varchar("message_id").notNull(),
  seen:      boolean("seen").notNull().default(false),
  createdAt: timestamp("created_at"),
});
export type MessageNotification = typeof messageNotifications.$inferSelect;

export const messageAttachments = pgTable("message_attachments", {
  id:         varchar("id").primaryKey(),
  messageId:  varchar("message_id").notNull(),
  fileName:   text("file_name").notNull(),
  fileSize:   integer("file_size").notNull(),
  mimeType:   text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt:  timestamp("created_at"),
});
export type MessageAttachment = typeof messageAttachments.$inferSelect;

// ─── Route Days ───────────────────────────────────────────────────────────────
// Registered from live DB (existed via raw migration). Used by Route/dispatch system.
export const routeDays = pgTable("route_days", {
  id:           varchar("id").primaryKey(),
  employeeId:   varchar("employee_id").notNull(),
  date:         date("date").notNull(),
  weather:      text("weather").array(),
  startedAt:    timestamp("started_at", { withTimezone: true }),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
  summaryNotes: text("summary_notes"),
  status:       text("status").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }),
  updatedAt:    timestamp("updated_at", { withTimezone: true }),
});
export type RouteDay = typeof routeDays.$inferSelect;

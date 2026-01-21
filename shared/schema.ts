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
  role: text("role").notNull().default("Crew"),
  isActive: boolean("is_active").notNull().default(true),
  recoveryToken: text("recovery_token"),
  recoveryExpires: timestamp("recovery_expires"),
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

export const sops = pgTable("sops", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  ownerId: varchar("owner_id", { length: 36 }).references(() => users.id),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertSopSchema = createInsertSchema(sops).pick({
  title: true,
  category: true,
  content: true,
  ownerId: true,
});

export type InsertSop = z.infer<typeof insertSopSchema>;
export type Sop = typeof sops.$inferSelect;

export const materials = pgTable("materials", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sku: text("sku").notNull().unique(),
  stock: integer("stock").notNull().default(0),
  unit: text("unit").notNull(),
  price: integer("price").notNull(),
  image: text("image"),
});

export const insertMaterialSchema = createInsertSchema(materials).pick({
  name: true,
  category: true,
  sku: true,
  stock: true,
  unit: true,
  price: true,
  image: true,
});

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

export const candidates = pgTable("candidates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  stage: text("stage").notNull().default("Applied"),
  appliedDate: timestamp("applied_date").defaultNow(),
  rating: integer("rating").default(0),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
});

export const insertCandidateSchema = createInsertSchema(candidates).pick({
  name: true,
  role: true,
  stage: true,
  email: true,
  phone: true,
  notes: true,
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

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

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  client: text("client").notNull(),
  type: text("type").notNull(),
  stage: text("stage").notNull().default("Lead"),
  value: integer("value").default(0),
  scheduledDate: timestamp("scheduled_date"),
  zone: text("zone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  client: true,
  type: true,
  stage: true,
  value: true,
  scheduledDate: true,
  zone: true,
  notes: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

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

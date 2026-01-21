import { 
  users, type User, type InsertUser,
  sops, type Sop, type InsertSop,
  materials, type Material, type InsertMaterial,
  candidates, type Candidate, type InsertCandidate,
  campaigns, type Campaign, type InsertCampaign,
  jobs, type Job, type InsertJob,
  integrations,
  featureRequests, type FeatureRequest, type InsertFeatureRequest,
  customerMessages, type CustomerMessage, type InsertCustomerMessage,
  workRequests, type WorkRequest, type InsertWorkRequest,
  accessRequests, type AccessRequest, type InsertAccessRequest,
  customForms, type CustomForm, type InsertCustomForm,
  formSubmissions, type FormSubmission, type InsertFormSubmission,
  equipment, type Equipment, type InsertEquipment,
  maintenanceSchedules, type MaintenanceSchedule, type InsertMaintenanceSchedule,
  maintenanceLogs, type MaintenanceLog, type InsertMaintenanceLog
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, ilike, or } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  setRecoveryToken(userId: string, token: string, expires: Date): Promise<void>;
  getUserByRecoveryToken(token: string): Promise<User | undefined>;
  
  getSops(): Promise<Sop[]>;
  getSop(id: string): Promise<Sop | undefined>;
  createSop(sop: InsertSop): Promise<Sop>;
  updateSop(id: string, updates: Partial<Sop>): Promise<Sop | undefined>;
  deleteSop(id: string): Promise<boolean>;
  
  getMaterials(): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, updates: Partial<Material>): Promise<Material | undefined>;
  deleteMaterial(id: string): Promise<boolean>;
  
  getCandidates(): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate | undefined>;
  deleteCandidate(id: string): Promise<boolean>;
  
  getCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  
  createFeatureRequest(request: InsertFeatureRequest): Promise<FeatureRequest>;
  getFeatureRequests(): Promise<FeatureRequest[]>;
  
  createCustomerMessage(message: InsertCustomerMessage): Promise<CustomerMessage>;
  getCustomerMessages(): Promise<CustomerMessage[]>;
  getCustomerMessagesByUser(userId: string): Promise<CustomerMessage[]>;
  updateCustomerMessage(id: string, updates: Partial<CustomerMessage>): Promise<CustomerMessage | undefined>;
  
  createWorkRequest(request: InsertWorkRequest): Promise<WorkRequest>;
  getWorkRequests(): Promise<WorkRequest[]>;
  getWorkRequestsByUser(userId: string): Promise<WorkRequest[]>;
  updateWorkRequest(id: string, updates: Partial<WorkRequest>): Promise<WorkRequest | undefined>;
  
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  getAccessRequests(): Promise<AccessRequest[]>;
  getAccessRequestsByUser(userId: string): Promise<AccessRequest[]>;
  updateAccessRequest(id: string, updates: Partial<AccessRequest>): Promise<AccessRequest | undefined>;
  
  getCustomForms(): Promise<CustomForm[]>;
  getCustomForm(id: string): Promise<CustomForm | undefined>;
  createCustomForm(form: InsertCustomForm): Promise<CustomForm>;
  updateCustomForm(id: string, updates: Partial<CustomForm>): Promise<CustomForm | undefined>;
  deleteCustomForm(id: string): Promise<boolean>;
  
  getFormSubmissions(formId?: string): Promise<FormSubmission[]>;
  getFormSubmission(id: string): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  updateFormSubmission(id: string, updates: Partial<FormSubmission>): Promise<FormSubmission | undefined>;
  
  // Equipment
  getEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | undefined>;
  createEquipment(item: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string): Promise<boolean>;
  
  // Maintenance Schedules
  getMaintenanceSchedules(equipmentId?: string): Promise<MaintenanceSchedule[]>;
  getMaintenanceSchedule(id: string): Promise<MaintenanceSchedule | undefined>;
  createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule(id: string, updates: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule | undefined>;
  deleteMaintenanceSchedule(id: string): Promise<boolean>;
  getDueMaintenanceSchedules(): Promise<MaintenanceSchedule[]>;
  
  // Maintenance Logs
  getMaintenanceLogs(equipmentId?: string): Promise<MaintenanceLog[]>;
  createMaintenanceLog(log: InsertMaintenanceLog): Promise<MaintenanceLog>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async setRecoveryToken(userId: string, token: string, expires: Date): Promise<void> {
    await db.update(users).set({ recoveryToken: token, recoveryExpires: expires }).where(eq(users.id, userId));
  }

  async getUserByRecoveryToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.recoveryToken, token));
    return user || undefined;
  }

  async getSops(): Promise<Sop[]> {
    return db.select().from(sops);
  }

  async getSop(id: string): Promise<Sop | undefined> {
    const [sop] = await db.select().from(sops).where(eq(sops.id, id));
    return sop || undefined;
  }

  async createSop(sop: InsertSop): Promise<Sop> {
    const [newSop] = await db.insert(sops).values(sop).returning();
    return newSop;
  }

  async updateSop(id: string, updates: Partial<Sop>): Promise<Sop | undefined> {
    const [sop] = await db.update(sops).set({ ...updates, lastUpdated: new Date() }).where(eq(sops.id, id)).returning();
    return sop || undefined;
  }

  async deleteSop(id: string): Promise<boolean> {
    await db.delete(sops).where(eq(sops.id, id));
    return true;
  }

  async getMaterials(): Promise<Material[]> {
    return db.select().from(materials);
  }

  async getMaterial(id: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material || undefined;
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [newMaterial] = await db.insert(materials).values(material).returning();
    return newMaterial;
  }

  async updateMaterial(id: string, updates: Partial<Material>): Promise<Material | undefined> {
    const [material] = await db.update(materials).set(updates).where(eq(materials.id, id)).returning();
    return material || undefined;
  }

  async deleteMaterial(id: string): Promise<boolean> {
    await db.delete(materials).where(eq(materials.id, id));
    return true;
  }

  async getCandidates(): Promise<Candidate[]> {
    return db.select().from(candidates);
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate || undefined;
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const [newCandidate] = await db.insert(candidates).values(candidate).returning();
    return newCandidate;
  }

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate | undefined> {
    const [candidate] = await db.update(candidates).set(updates).where(eq(candidates.id, id)).returning();
    return candidate || undefined;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    await db.delete(candidates).where(eq(candidates.id, id));
    return true;
  }

  async getCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns);
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async getJobs(): Promise<Job[]> {
    return db.select().from(jobs);
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [newJob] = await db.insert(jobs).values(job).returning();
    return newJob;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const [job] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return job || undefined;
  }

  async createFeatureRequest(request: InsertFeatureRequest): Promise<FeatureRequest> {
    const [newRequest] = await db.insert(featureRequests).values(request).returning();
    return newRequest;
  }

  async getFeatureRequests(): Promise<FeatureRequest[]> {
    return db.select().from(featureRequests);
  }

  async createCustomerMessage(message: InsertCustomerMessage): Promise<CustomerMessage> {
    const [newMessage] = await db.insert(customerMessages).values(message).returning();
    return newMessage;
  }

  async getCustomerMessages(): Promise<CustomerMessage[]> {
    return db.select().from(customerMessages);
  }

  async getCustomerMessagesByUser(userId: string): Promise<CustomerMessage[]> {
    return db.select().from(customerMessages).where(eq(customerMessages.customerId, userId));
  }

  async updateCustomerMessage(id: string, updates: Partial<CustomerMessage>): Promise<CustomerMessage | undefined> {
    const [message] = await db.update(customerMessages).set(updates).where(eq(customerMessages.id, id)).returning();
    return message || undefined;
  }

  async createWorkRequest(request: InsertWorkRequest): Promise<WorkRequest> {
    const [newRequest] = await db.insert(workRequests).values(request).returning();
    return newRequest;
  }

  async getWorkRequests(): Promise<WorkRequest[]> {
    return db.select().from(workRequests);
  }

  async getWorkRequestsByUser(userId: string): Promise<WorkRequest[]> {
    return db.select().from(workRequests).where(eq(workRequests.customerId, userId));
  }

  async updateWorkRequest(id: string, updates: Partial<WorkRequest>): Promise<WorkRequest | undefined> {
    const [request] = await db.update(workRequests).set({ ...updates, updatedAt: new Date() }).where(eq(workRequests.id, id)).returning();
    return request || undefined;
  }

  async createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest> {
    const [newRequest] = await db.insert(accessRequests).values(request).returning();
    return newRequest;
  }

  async getAccessRequests(): Promise<AccessRequest[]> {
    return db.select().from(accessRequests);
  }

  async getAccessRequestsByUser(userId: string): Promise<AccessRequest[]> {
    return db.select().from(accessRequests).where(eq(accessRequests.userId, userId));
  }

  async updateAccessRequest(id: string, updates: Partial<AccessRequest>): Promise<AccessRequest | undefined> {
    const [request] = await db.update(accessRequests).set(updates).where(eq(accessRequests.id, id)).returning();
    return request || undefined;
  }

  async getCustomForms(): Promise<CustomForm[]> {
    return db.select().from(customForms);
  }

  async getCustomForm(id: string): Promise<CustomForm | undefined> {
    const [form] = await db.select().from(customForms).where(eq(customForms.id, id));
    return form || undefined;
  }

  async createCustomForm(form: InsertCustomForm): Promise<CustomForm> {
    const [newForm] = await db.insert(customForms).values(form).returning();
    return newForm;
  }

  async updateCustomForm(id: string, updates: Partial<CustomForm>): Promise<CustomForm | undefined> {
    const [form] = await db.update(customForms).set({ ...updates, updatedAt: new Date() }).where(eq(customForms.id, id)).returning();
    return form || undefined;
  }

  async deleteCustomForm(id: string): Promise<boolean> {
    const result = await db.delete(customForms).where(eq(customForms.id, id)).returning();
    return result.length > 0;
  }

  async getFormSubmissions(formId?: string): Promise<FormSubmission[]> {
    if (formId) {
      return db.select().from(formSubmissions).where(eq(formSubmissions.formId, formId));
    }
    return db.select().from(formSubmissions);
  }

  async getFormSubmission(id: string): Promise<FormSubmission | undefined> {
    const [submission] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, id));
    return submission || undefined;
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const [newSubmission] = await db.insert(formSubmissions).values(submission).returning();
    return newSubmission;
  }

  async updateFormSubmission(id: string, updates: Partial<FormSubmission>): Promise<FormSubmission | undefined> {
    const [submission] = await db.update(formSubmissions).set(updates).where(eq(formSubmissions.id, id)).returning();
    return submission || undefined;
  }

  // Equipment methods
  async getEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment);
  }

  async getEquipmentById(id: string): Promise<Equipment | undefined> {
    const [item] = await db.select().from(equipment).where(eq(equipment.id, id));
    return item || undefined;
  }

  async createEquipment(item: InsertEquipment): Promise<Equipment> {
    const [newItem] = await db.insert(equipment).values(item).returning();
    return newItem;
  }

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment | undefined> {
    const [item] = await db.update(equipment).set({ ...updates, updatedAt: new Date() }).where(eq(equipment.id, id)).returning();
    return item || undefined;
  }

  async deleteEquipment(id: string): Promise<boolean> {
    const result = await db.delete(equipment).where(eq(equipment.id, id));
    return true;
  }

  // Maintenance Schedule methods
  async getMaintenanceSchedules(equipmentId?: string): Promise<MaintenanceSchedule[]> {
    if (equipmentId) {
      return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.equipmentId, equipmentId));
    }
    return await db.select().from(maintenanceSchedules);
  }

  async getMaintenanceSchedule(id: string): Promise<MaintenanceSchedule | undefined> {
    const [schedule] = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
    return schedule || undefined;
  }

  async createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule> {
    const [newSchedule] = await db.insert(maintenanceSchedules).values(schedule).returning();
    return newSchedule;
  }

  async updateMaintenanceSchedule(id: string, updates: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule | undefined> {
    const [schedule] = await db.update(maintenanceSchedules).set(updates).where(eq(maintenanceSchedules.id, id)).returning();
    return schedule || undefined;
  }

  async deleteMaintenanceSchedule(id: string): Promise<boolean> {
    await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
    return true;
  }

  async getDueMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
    const now = new Date();
    const schedules = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.isActive, true));
    return schedules.filter(s => {
      if (s.nextDueDate && s.reminderDays) {
        const reminderDate = new Date(s.nextDueDate);
        reminderDate.setDate(reminderDate.getDate() - s.reminderDays);
        return now >= reminderDate;
      }
      return false;
    });
  }

  // Maintenance Log methods
  async getMaintenanceLogs(equipmentId?: string): Promise<MaintenanceLog[]> {
    if (equipmentId) {
      return await db.select().from(maintenanceLogs).where(eq(maintenanceLogs.equipmentId, equipmentId));
    }
    return await db.select().from(maintenanceLogs);
  }

  async createMaintenanceLog(log: InsertMaintenanceLog): Promise<MaintenanceLog> {
    const [newLog] = await db.insert(maintenanceLogs).values(log).returning();
    return newLog;
  }
}

export const storage = new DatabaseStorage();

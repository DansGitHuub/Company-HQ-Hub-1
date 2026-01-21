import { 
  users, type User, type InsertUser,
  sopCategories, type SopCategory, type InsertSopCategory,
  sops, type Sop, type InsertSop,
  materials, type Material, type InsertMaterial,
  candidates, type Candidate, type InsertCandidate,
  candidateDocuments, type CandidateDocument, type InsertCandidateDocument,
  campaigns, type Campaign, type InsertCampaign,
  jobs, type Job, type InsertJob,
  jobDocuments, type JobDocument, type InsertJobDocument,
  jobPipelineTabs, type JobPipelineTab, type InsertJobPipelineTab,
  integrations,
  featureRequests, type FeatureRequest, type InsertFeatureRequest,
  customerMessages, type CustomerMessage, type InsertCustomerMessage,
  workRequests, type WorkRequest, type InsertWorkRequest,
  accessRequests, type AccessRequest, type InsertAccessRequest,
  customForms, type CustomForm, type InsertCustomForm,
  formSubmissions, type FormSubmission, type InsertFormSubmission,
  equipment, type Equipment, type InsertEquipment,
  maintenanceSchedules, type MaintenanceSchedule, type InsertMaintenanceSchedule,
  maintenanceLogs, type MaintenanceLog, type InsertMaintenanceLog,
  equipmentUploads, type EquipmentUpload, type InsertEquipmentUpload,
  customerResources, type CustomerResource, type InsertCustomerResource,
  savedResources, type SavedResource, type InsertSavedResource,
  companySettings, type CompanySettings, type InsertCompanySettings
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, ilike, or, and } from "drizzle-orm";
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
  
  getSopCategories(): Promise<SopCategory[]>;
  getSopCategory(id: string): Promise<SopCategory | undefined>;
  createSopCategory(category: InsertSopCategory): Promise<SopCategory>;
  updateSopCategory(id: string, updates: Partial<SopCategory>): Promise<SopCategory | undefined>;
  deleteSopCategory(id: string): Promise<boolean>;
  
  getSops(): Promise<Sop[]>;
  getSop(id: string): Promise<Sop | undefined>;
  createSop(sop: InsertSop): Promise<Sop>;
  updateSop(id: string, updates: Partial<Sop>): Promise<Sop | undefined>;
  deleteSop(id: string): Promise<boolean>;
  copySop(id: string): Promise<Sop | undefined>;
  
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
  
  getCandidateDocuments(candidateId: string): Promise<CandidateDocument[]>;
  createCandidateDocument(doc: InsertCandidateDocument): Promise<CandidateDocument>;
  updateCandidateDocument(id: string, updates: Partial<CandidateDocument>): Promise<CandidateDocument | undefined>;
  deleteCandidateDocument(id: string): Promise<boolean>;
  
  getCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  
  getJobs(): Promise<Job[]>;
  getJobsByCategory(category: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  
  getJobDocuments(jobId: string): Promise<JobDocument[]>;
  createJobDocument(doc: InsertJobDocument): Promise<JobDocument>;
  deleteJobDocument(id: string): Promise<boolean>;
  
  getJobPipelineTabs(): Promise<JobPipelineTab[]>;
  createJobPipelineTab(tab: InsertJobPipelineTab): Promise<JobPipelineTab>;
  updateJobPipelineTab(id: string, updates: Partial<JobPipelineTab>): Promise<JobPipelineTab | undefined>;
  deleteJobPipelineTab(id: string): Promise<boolean>;
  
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
  
  // Equipment Uploads
  getEquipmentUploads(equipmentId: string): Promise<EquipmentUpload[]>;
  createEquipmentUpload(upload: InsertEquipmentUpload): Promise<EquipmentUpload>;
  deleteEquipmentUpload(id: string): Promise<boolean>;
  
  // Customer Resources
  getCustomerResources(type?: string): Promise<CustomerResource[]>;
  getCustomerResource(id: string): Promise<CustomerResource | undefined>;
  createCustomerResource(resource: InsertCustomerResource): Promise<CustomerResource>;
  updateCustomerResource(id: string, updates: Partial<CustomerResource>): Promise<CustomerResource | undefined>;
  deleteCustomerResource(id: string): Promise<boolean>;
  
  // Saved Resources (favorites/bookmarks)
  getSavedResources(userId: string): Promise<SavedResource[]>;
  saveResource(userId: string, resourceId: string): Promise<SavedResource>;
  unsaveResource(userId: string, resourceId: string): Promise<boolean>;
  isResourceSaved(userId: string, resourceId: string): Promise<boolean>;
  
  // Company Settings
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(updates: Partial<CompanySettings>): Promise<CompanySettings | undefined>;
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

  async getSopCategories(): Promise<SopCategory[]> {
    return db.select().from(sopCategories).orderBy(sopCategories.sortOrder);
  }

  async getSopCategory(id: string): Promise<SopCategory | undefined> {
    const [cat] = await db.select().from(sopCategories).where(eq(sopCategories.id, id));
    return cat || undefined;
  }

  async createSopCategory(category: InsertSopCategory): Promise<SopCategory> {
    const [newCat] = await db.insert(sopCategories).values(category).returning();
    return newCat;
  }

  async updateSopCategory(id: string, updates: Partial<SopCategory>): Promise<SopCategory | undefined> {
    const [cat] = await db.update(sopCategories).set(updates).where(eq(sopCategories.id, id)).returning();
    return cat || undefined;
  }

  async deleteSopCategory(id: string): Promise<boolean> {
    await db.delete(sopCategories).where(eq(sopCategories.id, id));
    return true;
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

  async copySop(id: string): Promise<Sop | undefined> {
    const originalSop = await this.getSop(id);
    if (!originalSop) return undefined;
    const [newSop] = await db.insert(sops).values({
      title: `${originalSop.title} (Copy)`,
      category: originalSop.category,
      categoryId: originalSop.categoryId,
      content: originalSop.content,
      ownerId: originalSop.ownerId,
    }).returning();
    return newSop;
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
    const [newCandidate] = await db.insert(candidates).values(candidate as any).returning();
    return newCandidate;
  }

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate | undefined> {
    const [candidate] = await db.update(candidates).set(updates).where(eq(candidates.id, id)).returning();
    return candidate || undefined;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    await db.delete(candidateDocuments).where(eq(candidateDocuments.candidateId, id));
    await db.delete(candidates).where(eq(candidates.id, id));
    return true;
  }

  async getCandidateDocuments(candidateId: string): Promise<CandidateDocument[]> {
    return db.select().from(candidateDocuments).where(eq(candidateDocuments.candidateId, candidateId));
  }

  async createCandidateDocument(doc: InsertCandidateDocument): Promise<CandidateDocument> {
    const [newDoc] = await db.insert(candidateDocuments).values(doc).returning();
    return newDoc;
  }

  async updateCandidateDocument(id: string, updates: Partial<CandidateDocument>): Promise<CandidateDocument | undefined> {
    const [doc] = await db.update(candidateDocuments).set(updates).where(eq(candidateDocuments.id, id)).returning();
    return doc || undefined;
  }

  async deleteCandidateDocument(id: string): Promise<boolean> {
    await db.delete(candidateDocuments).where(eq(candidateDocuments.id, id));
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
    const [newJob] = await db.insert(jobs).values(job as any).returning();
    return newJob;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const [job] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return job || undefined;
  }

  async deleteJob(id: string): Promise<boolean> {
    await db.delete(jobDocuments).where(eq(jobDocuments.jobId, id));
    await db.delete(jobs).where(eq(jobs.id, id));
    return true;
  }

  async getJobsByCategory(category: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.category, category as any));
  }

  async getJobDocuments(jobId: string): Promise<JobDocument[]> {
    return db.select().from(jobDocuments).where(eq(jobDocuments.jobId, jobId));
  }

  async createJobDocument(doc: InsertJobDocument): Promise<JobDocument> {
    const [newDoc] = await db.insert(jobDocuments).values(doc).returning();
    return newDoc;
  }

  async deleteJobDocument(id: string): Promise<boolean> {
    await db.delete(jobDocuments).where(eq(jobDocuments.id, id));
    return true;
  }

  async getJobPipelineTabs(): Promise<JobPipelineTab[]> {
    return db.select().from(jobPipelineTabs);
  }

  async createJobPipelineTab(tab: InsertJobPipelineTab): Promise<JobPipelineTab> {
    const [newTab] = await db.insert(jobPipelineTabs).values(tab).returning();
    return newTab;
  }

  async updateJobPipelineTab(id: string, updates: Partial<JobPipelineTab>): Promise<JobPipelineTab | undefined> {
    const [tab] = await db.update(jobPipelineTabs).set(updates).where(eq(jobPipelineTabs.id, id)).returning();
    return tab || undefined;
  }

  async deleteJobPipelineTab(id: string): Promise<boolean> {
    await db.delete(jobPipelineTabs).where(eq(jobPipelineTabs.id, id));
    return true;
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

  // Equipment Uploads methods
  async getEquipmentUploads(equipmentId: string): Promise<EquipmentUpload[]> {
    return await db.select().from(equipmentUploads).where(eq(equipmentUploads.equipmentId, equipmentId));
  }

  async createEquipmentUpload(upload: InsertEquipmentUpload): Promise<EquipmentUpload> {
    const [newUpload] = await db.insert(equipmentUploads).values(upload).returning();
    return newUpload;
  }

  async deleteEquipmentUpload(id: string): Promise<boolean> {
    const result = await db.delete(equipmentUploads).where(eq(equipmentUploads.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Customer Resources methods
  async getCustomerResources(type?: string): Promise<CustomerResource[]> {
    if (type) {
      return await db.select().from(customerResources).where(eq(customerResources.type, type));
    }
    return await db.select().from(customerResources);
  }

  async getCustomerResource(id: string): Promise<CustomerResource | undefined> {
    const [resource] = await db.select().from(customerResources).where(eq(customerResources.id, id));
    return resource || undefined;
  }

  async createCustomerResource(resource: InsertCustomerResource): Promise<CustomerResource> {
    const [newResource] = await db.insert(customerResources).values(resource).returning();
    return newResource;
  }

  async updateCustomerResource(id: string, updates: Partial<CustomerResource>): Promise<CustomerResource | undefined> {
    const [resource] = await db.update(customerResources).set({ ...updates, updatedAt: new Date() }).where(eq(customerResources.id, id)).returning();
    return resource || undefined;
  }

  async deleteCustomerResource(id: string): Promise<boolean> {
    await db.delete(savedResources).where(eq(savedResources.resourceId, id));
    const result = await db.delete(customerResources).where(eq(customerResources.id, id));
    return true;
  }

  // Saved Resources methods
  async getSavedResources(userId: string): Promise<SavedResource[]> {
    return await db.select().from(savedResources).where(eq(savedResources.userId, userId));
  }

  async saveResource(userId: string, resourceId: string): Promise<SavedResource> {
    const [saved] = await db.insert(savedResources).values({ userId, resourceId }).returning();
    return saved;
  }

  async unsaveResource(userId: string, resourceId: string): Promise<boolean> {
    await db.delete(savedResources)
      .where(and(eq(savedResources.userId, userId), eq(savedResources.resourceId, resourceId)));
    return true;
  }

  async isResourceSaved(userId: string, resourceId: string): Promise<boolean> {
    const [saved] = await db.select().from(savedResources)
      .where(and(eq(savedResources.userId, userId), eq(savedResources.resourceId, resourceId)));
    return !!saved;
  }

  // Company Settings methods
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings);
    return settings || undefined;
  }

  async updateCompanySettings(updates: Partial<CompanySettings>): Promise<CompanySettings | undefined> {
    const existing = await this.getCompanySettings();
    if (existing) {
      const [updated] = await db.update(companySettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated || undefined;
    } else {
      const [created] = await db.insert(companySettings).values(updates).returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();

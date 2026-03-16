import { 
  users, type User, type InsertUser,
  sopCategories, type SopCategory, type InsertSopCategory,
  sops, type Sop, type InsertSop,
  sopTemplates, type SopTemplate, type InsertSopTemplate,
  sopExamples, type SopExample, type InsertSopExample,
  materialCategories, type MaterialCategory, type InsertMaterialCategory,
  categoryFields, type CategoryField, type InsertCategoryField,
  materials, type Material, type InsertMaterial,
  materialFieldValues, type MaterialFieldValue, type InsertMaterialFieldValue,
  candidates, type Candidate, type InsertCandidate,
  candidateDocuments, type CandidateDocument, type InsertCandidateDocument,
  campaigns, type Campaign, type InsertCampaign,
  jobs, type Job, type InsertJob,
  jobDocuments, type JobDocument, type InsertJobDocument,
  jobPipelineTabs, type JobPipelineTab, type InsertJobPipelineTab,
  integrations,
  featureRequests, type FeatureRequest, type InsertFeatureRequest,
  customerMessages, type CustomerMessage, type InsertCustomerMessage,
  messagingThreads, type MessagingThread, type InsertMessagingThread,
  threadMessages, type ThreadMessage, type InsertThreadMessage,
  workRequests, type WorkRequest, type InsertWorkRequest,
  accessRequests, type AccessRequest, type InsertAccessRequest,
  customForms, type CustomForm, type InsertCustomForm,
  formSubmissions, type FormSubmission, type InsertFormSubmission,
  formFolders, type FormFolder, type InsertFormFolder,
  formTemplates, type FormTemplate, type InsertFormTemplate,
  equipment, type Equipment, type InsertEquipment,
  maintenanceSchedules, type MaintenanceSchedule, type InsertMaintenanceSchedule,
  maintenanceLogs, type MaintenanceLog, type InsertMaintenanceLog,
  equipmentUploads, type EquipmentUpload, type InsertEquipmentUpload,
  oemMaintenanceTemplates, type OemMaintenanceTemplate, type InsertOemTemplate,
  repairRequests, type RepairRequest, type InsertRepairRequest,
  customerResources, type CustomerResource, type InsertCustomerResource,
  savedResources, type SavedResource, type InsertSavedResource,
  companySettings, type CompanySettings, type InsertCompanySettings,
  todos, type Todo, type InsertTodo,
  todoAssignments, type TodoAssignment, type InsertTodoAssignment,
  todoHistory, type TodoHistory,
  todoActiveUsers, type TodoActiveUser, type InsertTodoActiveUser,
  plowSiteGroups, type PlowSiteGroup, type InsertPlowSiteGroup,
  plowSites, type PlowSite, type InsertPlowSite,
  plowSiteManagerPermissions, type PlowSiteManagerPermission, type InsertPlowSiteManagerPermission,
  plowSiteImages, type PlowSiteImage, type InsertPlowSiteImage,
  sitePhotos, type SitePhoto, type InsertSitePhoto,
  sitePhotoVariants, type SitePhotoVariant, type InsertSitePhotoVariant,
  siteMapFeatures, type SiteMapFeature, type InsertSiteMapFeature,
  aiAgents, type AiAgent, type InsertAiAgent,
  aiAgentUsageLogs, type AiAgentUsageLog, type InsertAiAgentUsageLog,
  aiAgentSuggestions, type AiAgentSuggestion, type InsertAiAgentSuggestion,
  businessProcesses, type BusinessProcess, type InsertBusinessProcess,
  processAuditResults, type ProcessAuditResult, type InsertProcessAuditResult,
  softwareIntegrations, type SoftwareIntegration, type InsertSoftwareIntegration,
  configuredIntegrations, type ConfiguredIntegration, type InsertConfiguredIntegration,
  integrationCapabilities, type IntegrationCapability, type InsertIntegrationCapability,
  integrationTests, type IntegrationTest, type InsertIntegrationTest,
  integrationResearchSessions, type IntegrationResearchSession, type InsertIntegrationResearchSession,
  appUpdates, type AppUpdate, type InsertAppUpdate,
  userUpdateAcknowledgments, type UserUpdateAcknowledgment, type InsertUserUpdateAcknowledgment,
  helpArticles, type HelpArticle, type InsertHelpArticle,
  helpCategories, type HelpCategory, type InsertHelpCategory,
  helpArticleReports, type HelpArticleReport, type InsertHelpArticleReport,
  articleUpdateNotifications, type ArticleUpdateNotification, type InsertArticleUpdateNotification,
  calendarConnections, type CalendarConnection, type InsertCalendarConnection,
  errorLogs, type ErrorLog, type InsertErrorLog,
  campaigns, type Campaign, type InsertCampaign,
  developmentTracker, type DevelopmentTracker, type InsertDevelopmentTracker,
  sopMedia, type SopMedia, type InsertSopMedia,
  aiGenerationEvents, type AiGenerationEvent, type InsertAiGenerationEvent,
  sopDrafts, type SopDraft, type InsertSopDraft,
  sopQuizzes, type SopQuiz, type InsertSopQuiz,
  sopQuizQuestions, type SopQuizQuestion, type InsertSopQuizQuestion,
  userQuizAttempts, type UserQuizAttempt, type InsertUserQuizAttempt,
  builderForms, type BuilderForm, type InsertBuilderForm,
  pdfForms, type PdfForm, type InsertPdfForm,
  conversations, chatMessages,
  hqFiles, type HqFile, type InsertHqFile,
  qualifiedLeads, type QualifiedLead, type InsertQualifiedLead,
  applicantNotes, type ApplicantNote, type InsertApplicantNote,
  applicantCommunications, type ApplicantCommunication, type InsertApplicantCommunication,
  employees, type Employee, type InsertEmployee,
  employeePayHistory, type EmployeePayHistory, type InsertEmployeePayHistory,
  employeeHistory, type EmployeeHistory, type InsertEmployeeHistory,
  employeeNotes, type EmployeeNote, type InsertEmployeeNote,
  employeeDocuments, type EmployeeDocument, type InsertEmployeeDocument,
  onboardingItems, type OnboardingItem, type InsertOnboardingItem,
  hrFormSubmissions, type HrFormSubmission, type InsertHrFormSubmission,
  hiringEmailTemplates, type HiringEmailTemplate, type InsertHiringEmailTemplate,
  customerJobs, type CustomerJob, type InsertCustomerJob,
  customerDocuments, type CustomerDocument, type InsertCustomerDocument,
  careGuides, type CareGuide, type InsertCareGuide,
  customerSavedGuides, type CustomerSavedGuide, type InsertCustomerSavedGuide,
  customerNotifications, type CustomerNotification, type InsertCustomerNotification,
  tasks, type Task, type InsertTask,
  taskChecklistItems, type TaskChecklistItem,
  taskComments, type TaskComment, type InsertTaskComment,
  taskCustomFields, type TaskCustomField,
  taskHistory as taskHistoryTable, type TaskHistoryEntry,
  taskAttachments, type TaskAttachment,
  taskDelegationChain, type TaskDelegation,
  staffNotifications, type StaffNotification, type InsertStaffNotification,
  sharedLinks, type SharedLink, type InsertSharedLink,
  sharedLinkAccessLogs, type SharedLinkAccessLog,
  documents, type Document, type InsertDocument,
  documentLinks, type DocumentLink, type InsertDocumentLink,
  documentShares, type DocumentShare, type InsertDocumentShare,
  onboardingFormSubmissions, type OnboardingFormSubmission, type InsertOnboardingFormSubmission,
  estimates, type Estimate, type InsertEstimate
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, ilike, or, and, desc, isNull, notInArray, sql } from "drizzle-orm";
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
  copySop(id: string, targetCategoryId?: string, targetCategoryName?: string): Promise<Sop | undefined>;
  
  // SOP Templates
  getSopTemplates(): Promise<SopTemplate[]>;
  getSopTemplate(id: string): Promise<SopTemplate | undefined>;
  createSopTemplate(template: InsertSopTemplate): Promise<SopTemplate>;
  updateSopTemplate(id: string, updates: Partial<SopTemplate>): Promise<SopTemplate | undefined>;
  deleteSopTemplate(id: string): Promise<boolean>;
  
  // SOP Examples
  getSopExamples(): Promise<SopExample[]>;
  getSopExample(id: string): Promise<SopExample | undefined>;
  createSopExample(example: InsertSopExample): Promise<SopExample>;
  updateSopExample(id: string, updates: Partial<SopExample>): Promise<SopExample | undefined>;
  deleteSopExample(id: string): Promise<boolean>;
  
  // Material Categories
  getMaterialCategories(): Promise<MaterialCategory[]>;
  getMaterialCategory(id: string): Promise<MaterialCategory | undefined>;
  getMaterialCategoryByName(name: string): Promise<MaterialCategory | undefined>;
  createMaterialCategory(category: InsertMaterialCategory): Promise<MaterialCategory>;
  updateMaterialCategory(id: string, updates: Partial<MaterialCategory>): Promise<MaterialCategory | undefined>;
  deleteMaterialCategory(id: string): Promise<boolean>;
  
  // Category Fields
  getCategoryFields(categoryId: string): Promise<CategoryField[]>;
  getCategoryField(id: string): Promise<CategoryField | undefined>;
  createCategoryField(field: InsertCategoryField): Promise<CategoryField>;
  updateCategoryField(id: string, updates: Partial<CategoryField>): Promise<CategoryField | undefined>;
  deleteCategoryField(id: string): Promise<boolean>;
  
  // Materials
  getMaterials(): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, updates: Partial<Material>): Promise<Material | undefined>;
  deleteMaterial(id: string): Promise<boolean>;
  getMaterialsByCategory(categoryId: string): Promise<Material[]>;
  bulkMoveMaterials(materialIds: string[], newCategoryId: string): Promise<number>;
  
  // Material Field Values
  getMaterialFieldValues(materialId: string): Promise<MaterialFieldValue[]>;
  setMaterialFieldValue(materialId: string, fieldId: string, value: string | null): Promise<MaterialFieldValue>;
  deleteMaterialFieldValues(materialId: string): Promise<boolean>;
  
  getCandidates(): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  getCandidateByUserId(userId: string): Promise<Candidate | undefined>;
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
  
  // Form Folders
  getFormFolders(): Promise<FormFolder[]>;
  createFormFolder(folder: InsertFormFolder): Promise<FormFolder>;
  updateFormFolder(id: string, updates: Partial<FormFolder>): Promise<FormFolder | undefined>;
  deleteFormFolder(id: string): Promise<boolean>;
  
  // Form Templates
  getFormTemplates(): Promise<FormTemplate[]>;
  getFormTemplate(id: string): Promise<FormTemplate | undefined>;
  createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate>;
  updateFormTemplate(id: string, updates: Partial<FormTemplate>): Promise<FormTemplate | undefined>;
  deleteFormTemplate(id: string): Promise<boolean>;
  
  // Builder Forms
  getBuilderForms(archived?: boolean): Promise<BuilderForm[]>;
  getBuilderForm(id: string): Promise<BuilderForm | undefined>;
  createBuilderForm(form: InsertBuilderForm): Promise<BuilderForm>;
  updateBuilderForm(id: string, updates: Partial<BuilderForm>): Promise<BuilderForm | undefined>;
  deleteBuilderForm(id: string): Promise<boolean>;

  // PDF Forms
  getPdfForms(createdBy?: string): Promise<PdfForm[]>;
  getPdfForm(id: string): Promise<PdfForm | undefined>;
  createPdfForm(form: InsertPdfForm): Promise<PdfForm>;
  deletePdfForm(id: string): Promise<boolean>;
  
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

  // OEM Templates
  getOemTemplates(brand?: string, category?: string): Promise<OemMaintenanceTemplate[]>;
  getOemTemplate(id: string): Promise<OemMaintenanceTemplate | undefined>;

  // Repair Requests
  getRepairRequests(assetId?: string): Promise<RepairRequest[]>;
  getRepairRequest(id: string): Promise<RepairRequest | undefined>;
  createRepairRequest(req: InsertRepairRequest): Promise<RepairRequest>;
  updateRepairRequest(id: string, updates: Partial<RepairRequest>): Promise<RepairRequest | undefined>;

  // Fleet Dashboard
  getNextAssetId(): Promise<string>;
  getFleetDashboardStats(): Promise<{ total: number; active: number; inRepair: number; p1: number; p2: number; p3: number; complianceAlerts: number }>;
  
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
  
  // To-Do System
  getTodos(): Promise<Todo[]>;
  getTodo(id: string): Promise<Todo | undefined>;
  createTodo(todo: InsertTodo, createdBy: string): Promise<Todo>;
  updateTodo(id: string, updates: Partial<Todo>): Promise<Todo | undefined>;
  deleteTodo(id: string): Promise<boolean>;
  
  // To-Do Assignments
  getTodoAssignments(todoId: string): Promise<TodoAssignment[]>;
  getUserTodoAssignments(userId: string): Promise<TodoAssignment[]>;
  createTodoAssignment(assignment: InsertTodoAssignment): Promise<TodoAssignment>;
  deleteTodoAssignment(id: string): Promise<boolean>;
  markTodoAsRead(todoId: string, userId: string): Promise<boolean>;
  getUnreadTodoCount(userId: string): Promise<number>;
  
  // To-Do History
  getTodoHistory(todoId: string): Promise<TodoHistory[]>;
  createTodoHistory(entry: { todoId: string; changedBy: string; changeType: string; fieldChanged?: string; oldValue?: string; newValue?: string }): Promise<TodoHistory>;

  // Active To-Do Users
  getTodoActiveUsers(): Promise<TodoActiveUser[]>;
  isUserTodoActive(userId: string): Promise<boolean>;
  activateTodoUser(userId: string, activatedBy: string): Promise<TodoActiveUser>;
  deactivateTodoUser(userId: string): Promise<boolean>;
  
  // Plow Site Groups
  getPlowSiteGroups(): Promise<PlowSiteGroup[]>;
  getPlowSiteGroup(id: string): Promise<PlowSiteGroup | undefined>;
  createPlowSiteGroup(group: InsertPlowSiteGroup, createdBy: string): Promise<PlowSiteGroup>;
  updatePlowSiteGroup(id: string, updates: Partial<PlowSiteGroup>): Promise<PlowSiteGroup | undefined>;
  deletePlowSiteGroup(id: string): Promise<boolean>;

  // Plow Site Maps
  getPlowSites(): Promise<PlowSite[]>;
  getPlowSite(id: string): Promise<PlowSite | undefined>;
  createPlowSite(site: InsertPlowSite, createdBy: string): Promise<PlowSite>;
  updatePlowSite(id: string, updates: Partial<PlowSite>): Promise<PlowSite | undefined>;
  deletePlowSite(id: string): Promise<boolean>;
  
  // Plow Site Manager Permissions
  getPlowSiteManagerPermissions(): Promise<PlowSiteManagerPermission[]>;
  getPlowSiteManagerPermission(userId: string): Promise<PlowSiteManagerPermission | undefined>;
  setPlowSiteManagerPermission(userId: string, canEdit: boolean, grantedBy: string): Promise<PlowSiteManagerPermission>;
  deletePlowSiteManagerPermission(userId: string): Promise<boolean>;
  
  // Plow Site Images
  getPlowSiteImages(siteId: string): Promise<PlowSiteImage[]>;
  createPlowSiteImage(image: InsertPlowSiteImage): Promise<PlowSiteImage>;
  updatePlowSiteImage(id: string, updates: Partial<PlowSiteImage>): Promise<PlowSiteImage | undefined>;
  deletePlowSiteImage(id: string): Promise<boolean>;

  // Site Photos
  getSitePhotos(siteId: string): Promise<SitePhoto[]>;
  getSitePhoto(id: string): Promise<SitePhoto | undefined>;
  createSitePhoto(photo: InsertSitePhoto, createdBy: string): Promise<SitePhoto>;
  updateSitePhoto(id: string, updates: Partial<SitePhoto>): Promise<SitePhoto | undefined>;
  deleteSitePhoto(id: string): Promise<boolean>;

  // Site Photo Variants
  getSitePhotoVariants(photoId: string): Promise<SitePhotoVariant[]>;
  getSitePhotoVariant(id: string): Promise<SitePhotoVariant | undefined>;
  createSitePhotoVariant(variant: InsertSitePhotoVariant, createdBy: string): Promise<SitePhotoVariant>;
  updateSitePhotoVariant(id: string, updates: Partial<SitePhotoVariant>): Promise<SitePhotoVariant | undefined>;
  deleteSitePhotoVariant(id: string): Promise<boolean>;

  // Site Map Features
  getSiteMapFeatures(siteId: string): Promise<SiteMapFeature[]>;
  getSiteMapFeature(id: string): Promise<SiteMapFeature | undefined>;
  createSiteMapFeature(feature: InsertSiteMapFeature, createdBy: string): Promise<SiteMapFeature>;
  updateSiteMapFeature(id: string, updates: Partial<SiteMapFeature>): Promise<SiteMapFeature | undefined>;
  deleteSiteMapFeature(id: string): Promise<boolean>;
  
  // AI Agents
  getAiAgents(): Promise<AiAgent[]>;
  getAiAgent(id: string): Promise<AiAgent | undefined>;
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined>;
  deleteAiAgent(id: string): Promise<boolean>;
  
  // AI Agent Usage Logs
  getAiAgentUsageLogs(agentId?: string): Promise<AiAgentUsageLog[]>;
  createAiAgentUsageLog(log: InsertAiAgentUsageLog): Promise<AiAgentUsageLog>;
  getTotalAgentCost(agentId?: string): Promise<number>;
  
  // AI Agent Suggestions
  getAiAgentSuggestions(agentId?: string): Promise<AiAgentSuggestion[]>;
  createAiAgentSuggestion(suggestion: InsertAiAgentSuggestion): Promise<AiAgentSuggestion>;
  updateAiAgentSuggestion(id: string, updates: Partial<AiAgentSuggestion>): Promise<AiAgentSuggestion | undefined>;
  deleteAiAgentSuggestion(id: string): Promise<boolean>;
  
  // Messaging Threads
  getMessagingThreads(filters?: { customerId?: string; assignedEmployeeId?: string; status?: string }): Promise<MessagingThread[]>;
  getMessagingThread(id: string): Promise<MessagingThread | undefined>;
  createMessagingThread(thread: InsertMessagingThread & { initialMessage?: string }): Promise<MessagingThread>;
  updateMessagingThread(id: string, updates: Partial<MessagingThread>): Promise<MessagingThread | undefined>;
  
  // Thread Messages
  getThreadMessages(threadId: string, includeInternalNotes?: boolean): Promise<ThreadMessage[]>;
  createThreadMessage(message: InsertThreadMessage): Promise<ThreadMessage>;
  markMessagesAsRead(threadId: string, userId: string): Promise<void>;
  
  // Business Processes
  getBusinessProcesses(): Promise<BusinessProcess[]>;
  getBusinessProcess(id: string): Promise<BusinessProcess | undefined>;
  createBusinessProcess(process: InsertBusinessProcess): Promise<BusinessProcess>;
  updateBusinessProcess(id: string, updates: Partial<BusinessProcess>): Promise<BusinessProcess | undefined>;
  deleteBusinessProcess(id: string): Promise<boolean>;
  
  // Process Audit Results
  getProcessAuditResults(processId?: string): Promise<ProcessAuditResult[]>;
  getProcessAuditResult(id: string): Promise<ProcessAuditResult | undefined>;
  createProcessAuditResult(result: InsertProcessAuditResult): Promise<ProcessAuditResult>;
  updateProcessAuditResult(id: string, updates: Partial<ProcessAuditResult>): Promise<ProcessAuditResult | undefined>;
  
  // Integration Wizard
  getSoftwareIntegrations(category?: string): Promise<SoftwareIntegration[]>;
  getSoftwareIntegration(id: string): Promise<SoftwareIntegration | undefined>;
  getSoftwareIntegrationByName(name: string): Promise<SoftwareIntegration | undefined>;
  createSoftwareIntegration(integration: InsertSoftwareIntegration): Promise<SoftwareIntegration>;
  updateSoftwareIntegration(id: string, updates: Partial<SoftwareIntegration>): Promise<SoftwareIntegration | undefined>;
  
  getConfiguredIntegrations(): Promise<ConfiguredIntegration[]>;
  getConfiguredIntegration(id: string): Promise<ConfiguredIntegration | undefined>;
  createConfiguredIntegration(integration: InsertConfiguredIntegration): Promise<ConfiguredIntegration>;
  updateConfiguredIntegration(id: string, updates: Partial<ConfiguredIntegration>): Promise<ConfiguredIntegration | undefined>;
  deleteConfiguredIntegration(id: string): Promise<void>;
  
  getIntegrationCapabilities(softwareId: string): Promise<IntegrationCapability[]>;
  createIntegrationCapability(capability: InsertIntegrationCapability): Promise<IntegrationCapability>;
  
  getIntegrationTests(configuredIntegrationId: string): Promise<IntegrationTest[]>;
  getIntegrationTest(id: string): Promise<IntegrationTest | undefined>;
  createIntegrationTest(test: InsertIntegrationTest): Promise<IntegrationTest>;
  updateIntegrationTest(id: string, updates: Partial<IntegrationTest>): Promise<IntegrationTest | undefined>;
  
  getIntegrationResearchSession(id: string): Promise<IntegrationResearchSession | undefined>;
  createIntegrationResearchSession(session: InsertIntegrationResearchSession): Promise<IntegrationResearchSession>;
  updateIntegrationResearchSession(id: string, updates: Partial<IntegrationResearchSession>): Promise<IntegrationResearchSession | undefined>;
  
  // App Updates
  getAppUpdates(): Promise<AppUpdate[]>;
  getAppUpdatesForRole(role: string): Promise<AppUpdate[]>;
  getUnseenUpdatesForUser(userId: string, role: string): Promise<AppUpdate[]>;
  getAppUpdate(id: string): Promise<AppUpdate | undefined>;
  createAppUpdate(update: InsertAppUpdate): Promise<AppUpdate>;
  updateAppUpdate(id: string, updates: Partial<AppUpdate>): Promise<AppUpdate | undefined>;
  deleteAppUpdate(id: string): Promise<boolean>;
  acknowledgeUpdate(userId: string, updateId: string): Promise<UserUpdateAcknowledgment>;
  
  // Help Articles
  getHelpArticles(role?: string): Promise<HelpArticle[]>;
  getHelpArticle(id: string): Promise<HelpArticle | undefined>;
  getHelpArticleBySlug(slug: string): Promise<HelpArticle | undefined>;
  searchHelpArticles(query: string, role: string): Promise<HelpArticle[]>;
  createHelpArticle(article: InsertHelpArticle): Promise<HelpArticle>;
  updateHelpArticle(id: string, updates: Partial<HelpArticle>): Promise<HelpArticle | undefined>;
  deleteHelpArticle(id: string): Promise<boolean>;
  
  // Help Categories
  getHelpCategories(role?: string): Promise<HelpCategory[]>;
  getHelpCategory(id: string): Promise<HelpCategory | undefined>;
  createHelpCategory(category: InsertHelpCategory): Promise<HelpCategory>;
  updateHelpCategory(id: string, updates: Partial<HelpCategory>): Promise<HelpCategory | undefined>;
  deleteHelpCategory(id: string): Promise<boolean>;
  
  // Help Article Reports
  getArticleReports(status?: string): Promise<HelpArticleReport[]>;
  getArticleReportsByArticle(articleId: string): Promise<HelpArticleReport[]>;
  createArticleReport(report: InsertHelpArticleReport): Promise<HelpArticleReport>;
  updateArticleReport(id: string, updates: Partial<HelpArticleReport>): Promise<HelpArticleReport | undefined>;
  getPendingReportsCount(): Promise<number>;
  
  // Article Update Notifications
  getUserArticleNotifications(userId: string): Promise<ArticleUpdateNotification[]>;
  getUnreadArticleNotifications(userId: string): Promise<ArticleUpdateNotification[]>;
  createArticleNotification(notification: InsertArticleUpdateNotification): Promise<ArticleUpdateNotification>;
  markArticleNotificationRead(id: string): Promise<boolean>;
  notifyUsersOfArticleUpdate(articleId: string, message: string, minRole: string): Promise<void>;
  
  // Calendar Connections
  getUserCalendarConnections(userId: string): Promise<CalendarConnection[]>;
  getCalendarConnection(id: string): Promise<CalendarConnection | undefined>;
  getCalendarConnectionByProvider(userId: string, provider: string): Promise<CalendarConnection | undefined>;
  createCalendarConnection(connection: InsertCalendarConnection): Promise<CalendarConnection>;
  updateCalendarConnection(id: string, updates: Partial<CalendarConnection>): Promise<CalendarConnection | undefined>;
  deleteCalendarConnection(id: string): Promise<boolean>;
  
  // Error Logs
  getErrorLogs(filters?: { severity?: string; feature?: string; isResolved?: boolean; limit?: number }): Promise<ErrorLog[]>;
  createErrorLog(log: InsertErrorLog): Promise<ErrorLog>;
  updateErrorLog(id: string, updates: Partial<ErrorLog>): Promise<ErrorLog | undefined>;
  getErrorStats(): Promise<{ total: number; unresolved: number; bySeverity: Record<string, number>; byFeature: Record<string, number> }>;
  
  // Marketing Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Development Tracker
  getDevelopmentItems(filters?: { status?: string; category?: string; priority?: string }): Promise<DevelopmentTracker[]>;
  getDevelopmentItem(id: string): Promise<DevelopmentTracker | undefined>;
  createDevelopmentItem(item: InsertDevelopmentTracker): Promise<DevelopmentTracker>;
  updateDevelopmentItem(id: string, updates: Partial<DevelopmentTracker>): Promise<DevelopmentTracker | undefined>;
  deleteDevelopmentItem(id: string): Promise<boolean>;

  getSopMedia(sopId: string): Promise<SopMedia[]>;
  createSopMedia(media: InsertSopMedia): Promise<SopMedia>;
  deleteSopMedia(id: string): Promise<boolean>;

  createAiGenerationEvent(event: InsertAiGenerationEvent): Promise<AiGenerationEvent>;
  getAiGenerationEventsCount(userId: string, since: Date): Promise<number>;
  getAiGenerationEventsCountAll(since: Date): Promise<number>;

  getSopDrafts(ownerId: string): Promise<SopDraft[]>;
  getSopDraft(id: string): Promise<SopDraft | undefined>;
  upsertSopDraft(draft: InsertSopDraft & { id?: string }): Promise<SopDraft>;
  deleteSopDraft(id: string): Promise<boolean>;

  // SOP Quizzes
  getSopQuizzes(sopId: string): Promise<SopQuiz[]>;
  getSopQuiz(id: string): Promise<SopQuiz | undefined>;
  createSopQuiz(quiz: InsertSopQuiz): Promise<SopQuiz>;
  deleteSopQuiz(id: string): Promise<boolean>;
  deleteSopQuizzesBySop(sopId: string): Promise<boolean>;

  // Quiz Questions
  getQuizQuestions(quizId: string): Promise<SopQuizQuestion[]>;
  createQuizQuestion(question: InsertSopQuizQuestion): Promise<SopQuizQuestion>;
  createQuizQuestionsBatch(questions: InsertSopQuizQuestion[]): Promise<SopQuizQuestion[]>;

  // Quiz Attempts
  getUserQuizAttempts(userId: string, quizId?: string): Promise<UserQuizAttempt[]>;
  createQuizAttempt(attempt: InsertUserQuizAttempt): Promise<UserQuizAttempt>;
  getAllQuizAttempts(quizId: string): Promise<UserQuizAttempt[]>;

  // HQ Files
  getHqFiles(): Promise<HqFile[]>;
  getHqFile(id: string): Promise<HqFile | undefined>;
  createHqFile(file: InsertHqFile): Promise<HqFile>;
  deleteHqFile(id: string): Promise<boolean>;

  // Qualified Leads
  getQualifiedLeads(): Promise<QualifiedLead[]>;
  getQualifiedLead(id: string): Promise<QualifiedLead | undefined>;
  createQualifiedLead(lead: InsertQualifiedLead): Promise<QualifiedLead>;
  updateQualifiedLead(id: string, updates: Partial<QualifiedLead>): Promise<QualifiedLead | undefined>;
  deleteQualifiedLead(id: string): Promise<boolean>;

  // Applicant Notes & Communications
  getApplicantNotes(candidateId: string): Promise<ApplicantNote[]>;
  createApplicantNote(note: InsertApplicantNote): Promise<ApplicantNote>;
  getApplicantCommunications(candidateId: string): Promise<ApplicantCommunication[]>;
  createApplicantCommunication(comm: InsertApplicantCommunication): Promise<ApplicantCommunication>;

  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByCandidateId(candidateId: string): Promise<Employee | undefined>;
  createEmployee(emp: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;

  // Employee Pay History
  getEmployeePayHistory(employeeId: string): Promise<EmployeePayHistory[]>;
  createEmployeePayHistory(entry: InsertEmployeePayHistory): Promise<EmployeePayHistory>;

  // Employee History
  getEmployeeHistory(employeeId: string): Promise<EmployeeHistory[]>;
  createEmployeeHistory(entry: InsertEmployeeHistory): Promise<EmployeeHistory>;

  // Employee Notes
  getEmployeeNotes(employeeId: string): Promise<EmployeeNote[]>;
  createEmployeeNote(note: InsertEmployeeNote): Promise<EmployeeNote>;

  // Employee Documents
  getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  createEmployeeDocument(doc: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: string, updates: Partial<EmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: string): Promise<boolean>;

  // Onboarding
  getOnboardingItems(employeeId: string): Promise<OnboardingItem[]>;
  createOnboardingItem(item: InsertOnboardingItem): Promise<OnboardingItem>;
  updateOnboardingItem(id: string, updates: Partial<OnboardingItem>): Promise<OnboardingItem | undefined>;

  // HR Forms
  getHrFormSubmissions(employeeId?: string, candidateId?: string): Promise<HrFormSubmission[]>;
  getHrFormSubmission(id: string): Promise<HrFormSubmission | undefined>;
  createHrFormSubmission(form: InsertHrFormSubmission): Promise<HrFormSubmission>;
  updateHrFormSubmission(id: string, updates: Partial<HrFormSubmission>): Promise<HrFormSubmission | undefined>;

  // Hiring Email Templates
  getHiringEmailTemplates(): Promise<HiringEmailTemplate[]>;
  getHiringEmailTemplate(stage: string): Promise<HiringEmailTemplate | undefined>;
  updateHiringEmailTemplate(id: string, updates: Partial<HiringEmailTemplate>): Promise<HiringEmailTemplate | undefined>;

  // Customer Hub - Customer Jobs
  getCustomerJobs(customerId: string): Promise<CustomerJob[]>;
  createCustomerJob(data: InsertCustomerJob): Promise<CustomerJob>;
  deleteCustomerJob(id: string): Promise<boolean>;
  getCustomerJobsByJobId(jobId: string): Promise<CustomerJob[]>;

  // Customer Hub - Customer Documents
  getCustomerDocuments(customerId: string): Promise<CustomerDocument[]>;
  createCustomerDocument(data: InsertCustomerDocument): Promise<CustomerDocument>;
  updateCustomerDocument(id: string, updates: Partial<CustomerDocument>): Promise<CustomerDocument | undefined>;
  deleteCustomerDocument(id: string): Promise<boolean>;

  // Customer Hub - Care Guides
  getCareGuides(): Promise<CareGuide[]>;
  getPublishedCareGuides(): Promise<CareGuide[]>;
  getCareGuide(id: string): Promise<CareGuide | undefined>;
  createCareGuide(data: InsertCareGuide): Promise<CareGuide>;
  updateCareGuide(id: string, updates: Partial<CareGuide>): Promise<CareGuide | undefined>;
  deleteCareGuide(id: string): Promise<boolean>;

  // Customer Hub - Saved Guides
  getCustomerSavedGuides(customerId: string): Promise<CustomerSavedGuide[]>;
  createCustomerSavedGuide(data: InsertCustomerSavedGuide): Promise<CustomerSavedGuide>;
  deleteCustomerSavedGuide(customerId: string, guideId: string): Promise<boolean>;

  // Customer Hub - Notifications
  getCustomerNotifications(customerId: string): Promise<CustomerNotification[]>;
  getUnreadNotificationCount(customerId: string): Promise<number>;
  createCustomerNotification(data: InsertCustomerNotification): Promise<CustomerNotification>;
  markNotificationRead(id: string): Promise<boolean>;
  markAllNotificationsRead(customerId: string): Promise<void>;

  // Staff Notifications
  getStaffNotifications(userId: string): Promise<StaffNotification[]>;
  getUnreadStaffNotificationCount(userId: string): Promise<number>;
  createStaffNotification(data: InsertStaffNotification): Promise<StaffNotification>;
  markStaffNotificationRead(id: string, userId: string): Promise<boolean>;
  markAllStaffNotificationsRead(userId: string): Promise<void>;

  // Task Management System
  getNextTaskId(): Promise<string>;
  createTask(data: any): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  getTasksByAssignee(userId: string): Promise<Task[]>;
  getTasksByCreator(userId: string): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  getOpenPoolTasks(): Promise<Task[]>;
  getTasksByLinkedRecord(recordType: string, recordId: string): Promise<Task[]>;
  getTaskDashboardCounts(userId: string): Promise<any>;
  createTaskChecklistItem(data: any): Promise<TaskChecklistItem>;
  getTaskChecklistItems(taskId: string): Promise<TaskChecklistItem[]>;
  updateTaskChecklistItem(id: string, updates: Partial<TaskChecklistItem>): Promise<TaskChecklistItem | undefined>;
  deleteTaskChecklistItem(id: string): Promise<boolean>;
  createTaskComment(data: any): Promise<TaskComment>;
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  deleteTaskComment(id: string): Promise<boolean>;
  createTaskCustomField(data: any): Promise<TaskCustomField>;
  getTaskCustomFields(taskId: string): Promise<TaskCustomField[]>;
  updateTaskCustomField(id: string, updates: Partial<TaskCustomField>): Promise<TaskCustomField | undefined>;
  deleteTaskCustomField(id: string): Promise<boolean>;
  createTaskHistory(data: any): Promise<TaskHistoryEntry>;
  getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]>;
  createTaskAttachment(data: any): Promise<TaskAttachment>;
  getTaskAttachments(taskId: string): Promise<TaskAttachment[]>;
  deleteTaskAttachment(id: string): Promise<boolean>;
  createTaskDelegation(data: any): Promise<TaskDelegation>;
  getTaskDelegationChain(taskId: string): Promise<TaskDelegation[]>;

  createDocument(data: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByEntity(entityType: string, entityId: string): Promise<Document[]>;
  getDocumentsByEntityWithLinks(entityType: string, entityId: string): Promise<Document[]>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<void>;
  searchDocuments(query: { fileName?: string; category?: string; entityType?: string; uploadedByUserId?: string }): Promise<Document[]>;
  createDocumentLink(data: InsertDocumentLink): Promise<DocumentLink>;
  getDocumentLinks(documentId: string): Promise<DocumentLink[]>;
  deleteDocumentLink(id: string): Promise<void>;
  createDocumentShare(data: InsertDocumentShare): Promise<DocumentShare>;
  getDocumentSharesByDocument(documentId: string): Promise<DocumentShare[]>;
  getDocumentSharesByModule(module: string, recordId?: string): Promise<DocumentShare[]>;
  getSharedDocumentsForModule(module: string, recordId?: string): Promise<Document[]>;
  deleteDocumentShare(id: string): Promise<void>;
  deleteDocumentSharesByDocument(documentId: string): Promise<void>;
  createOnboardingFormSubmission(data: InsertOnboardingFormSubmission): Promise<OnboardingFormSubmission>;
  getOnboardingFormSubmission(id: string): Promise<OnboardingFormSubmission | undefined>;
  getOnboardingFormSubmissionsByEmployee(employeeId: string): Promise<OnboardingFormSubmission[]>;
  updateOnboardingFormSubmission(id: string, data: Partial<InsertOnboardingFormSubmission>): Promise<OnboardingFormSubmission | undefined>;

  createSharedLink(data: InsertSharedLink): Promise<SharedLink>;
  getSharedLinks(): Promise<SharedLink[]>;
  getSharedLinkByToken(token: string): Promise<SharedLink | undefined>;
  getSharedLink(id: string): Promise<SharedLink | undefined>;
  revokeSharedLink(id: string): Promise<SharedLink | undefined>;
  incrementSharedLinkViewCount(id: string): Promise<void>;
  logSharedLinkAccess(sharedLinkId: string, ipAddress: string | null, userAgent: string | null): Promise<SharedLinkAccessLog>;
  getSharedLinkAccessLogs(sharedLinkId: string): Promise<SharedLinkAccessLog[]>;

  getEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  createEstimate(data: InsertEstimate): Promise<Estimate>;
  updateEstimate(id: string, data: Partial<InsertEstimate>): Promise<Estimate | undefined>;
  deleteEstimate(id: string): Promise<boolean>;
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
    try {
      const { pool } = await import("./db");
      const fkQuery = await pool.query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
          AND tc.table_name != 'sessions'
      `);

      for (const row of fkQuery.rows) {
        const { table_name, column_name } = row;
        const isNullable = await pool.query(`
          SELECT is_nullable FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table_name, column_name]);

        if (isNullable.rows[0]?.is_nullable === 'YES') {
          await pool.query(`UPDATE "${table_name}" SET "${column_name}" = NULL WHERE "${column_name}" = $1`, [id]);
        } else {
          await pool.query(`DELETE FROM "${table_name}" WHERE "${column_name}" = $1`, [id]);
        }
      }

      await db.delete(users).where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error(`[deleteUser] Failed to delete user ${id}:`, error);
      return false;
    }
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

  async copySop(id: string, targetCategoryId?: string, targetCategoryName?: string): Promise<Sop | undefined> {
    const originalSop = await this.getSop(id);
    if (!originalSop) return undefined;
    const [newSop] = await db.insert(sops).values({
      title: `${originalSop.title} (Copy)`,
      category: targetCategoryName || originalSop.category,
      categoryId: targetCategoryId || originalSop.categoryId,
      content: originalSop.content,
      structuredData: originalSop.structuredData,
      sopType: originalSop.sopType,
      superCategory: originalSop.superCategory,
      subCategory: originalSop.subCategory,
      ownerId: originalSop.ownerId,
    }).returning();
    return newSop;
  }

  // SOP Templates
  async getSopTemplates(): Promise<SopTemplate[]> {
    return db.select().from(sopTemplates);
  }

  async getSopTemplate(id: string): Promise<SopTemplate | undefined> {
    const [template] = await db.select().from(sopTemplates).where(eq(sopTemplates.id, id));
    return template || undefined;
  }

  async createSopTemplate(template: InsertSopTemplate): Promise<SopTemplate> {
    const [newTemplate] = await db.insert(sopTemplates).values(template).returning();
    return newTemplate;
  }

  async updateSopTemplate(id: string, updates: Partial<SopTemplate>): Promise<SopTemplate | undefined> {
    const [template] = await db.update(sopTemplates).set(updates).where(eq(sopTemplates.id, id)).returning();
    return template || undefined;
  }

  async deleteSopTemplate(id: string): Promise<boolean> {
    await db.delete(sopTemplates).where(eq(sopTemplates.id, id));
    return true;
  }

  // SOP Examples
  async getSopExamples(): Promise<SopExample[]> {
    return db.select().from(sopExamples);
  }

  async getSopExample(id: string): Promise<SopExample | undefined> {
    const [example] = await db.select().from(sopExamples).where(eq(sopExamples.id, id));
    return example || undefined;
  }

  async createSopExample(example: InsertSopExample): Promise<SopExample> {
    const [newExample] = await db.insert(sopExamples).values(example).returning();
    return newExample;
  }

  async updateSopExample(id: string, updates: Partial<SopExample>): Promise<SopExample | undefined> {
    const [example] = await db.update(sopExamples).set(updates).where(eq(sopExamples.id, id)).returning();
    return example || undefined;
  }

  async deleteSopExample(id: string): Promise<boolean> {
    await db.delete(sopExamples).where(eq(sopExamples.id, id));
    return true;
  }

  // Material Categories - sorted alphabetically
  async getMaterialCategories(): Promise<MaterialCategory[]> {
    const categories = await db.select().from(materialCategories);
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getMaterialCategory(id: string): Promise<MaterialCategory | undefined> {
    const [category] = await db.select().from(materialCategories).where(eq(materialCategories.id, id));
    return category || undefined;
  }

  async getMaterialCategoryByName(name: string): Promise<MaterialCategory | undefined> {
    const [category] = await db.select().from(materialCategories).where(eq(materialCategories.name, name));
    return category || undefined;
  }

  async createMaterialCategory(category: InsertMaterialCategory): Promise<MaterialCategory> {
    const [newCategory] = await db.insert(materialCategories).values(category).returning();
    return newCategory;
  }

  async updateMaterialCategory(id: string, updates: Partial<MaterialCategory>): Promise<MaterialCategory | undefined> {
    const [category] = await db.update(materialCategories).set(updates).where(eq(materialCategories.id, id)).returning();
    return category || undefined;
  }

  async deleteMaterialCategory(id: string): Promise<boolean> {
    await db.delete(materialCategories).where(eq(materialCategories.id, id));
    return true;
  }

  // Category Fields - sorted by sortOrder
  async getCategoryFields(categoryId: string): Promise<CategoryField[]> {
    const fields = await db.select().from(categoryFields).where(eq(categoryFields.categoryId, categoryId));
    return fields.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCategoryField(id: string): Promise<CategoryField | undefined> {
    const [field] = await db.select().from(categoryFields).where(eq(categoryFields.id, id));
    return field || undefined;
  }

  async createCategoryField(field: InsertCategoryField): Promise<CategoryField> {
    const [newField] = await db.insert(categoryFields).values(field as any).returning();
    return newField;
  }

  async updateCategoryField(id: string, updates: Partial<CategoryField>): Promise<CategoryField | undefined> {
    const [field] = await db.update(categoryFields).set(updates).where(eq(categoryFields.id, id)).returning();
    return field || undefined;
  }

  async deleteCategoryField(id: string): Promise<boolean> {
    await db.delete(categoryFields).where(eq(categoryFields.id, id));
    return true;
  }

  // Materials
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
    const [material] = await db.update(materials).set({ ...updates, updatedAt: new Date() }).where(eq(materials.id, id)).returning();
    return material || undefined;
  }

  async deleteMaterial(id: string): Promise<boolean> {
    await db.delete(materials).where(eq(materials.id, id));
    return true;
  }

  async getMaterialsByCategory(categoryId: string): Promise<Material[]> {
    return db.select().from(materials).where(eq(materials.categoryId, categoryId));
  }

  async bulkMoveMaterials(materialIds: string[], newCategoryId: string): Promise<number> {
    let count = 0;
    for (const id of materialIds) {
      await db.update(materials).set({ categoryId: newCategoryId, updatedAt: new Date() }).where(eq(materials.id, id));
      count++;
    }
    return count;
  }

  // Material Field Values
  async getMaterialFieldValues(materialId: string): Promise<MaterialFieldValue[]> {
    return db.select().from(materialFieldValues).where(eq(materialFieldValues.materialId, materialId));
  }

  async setMaterialFieldValue(materialId: string, fieldId: string, value: string | null): Promise<MaterialFieldValue> {
    // First try to find existing value
    const [existing] = await db.select().from(materialFieldValues)
      .where(and(eq(materialFieldValues.materialId, materialId), eq(materialFieldValues.fieldId, fieldId)));
    
    if (existing) {
      const [updated] = await db.update(materialFieldValues)
        .set({ value })
        .where(eq(materialFieldValues.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(materialFieldValues)
        .values({ materialId, fieldId, value })
        .returning();
      return created;
    }
  }

  async deleteMaterialFieldValues(materialId: string): Promise<boolean> {
    await db.delete(materialFieldValues).where(eq(materialFieldValues.materialId, materialId));
    return true;
  }

  async getCandidates(): Promise<Candidate[]> {
    return db.select().from(candidates);
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate || undefined;
  }

  async getCandidateByUserId(userId: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.userId, userId));
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

  // Form Folders
  async getFormFolders(): Promise<FormFolder[]> {
    return db.select().from(formFolders);
  }

  async createFormFolder(folder: InsertFormFolder): Promise<FormFolder> {
    const [newFolder] = await db.insert(formFolders).values(folder).returning();
    return newFolder;
  }

  async updateFormFolder(id: string, updates: Partial<FormFolder>): Promise<FormFolder | undefined> {
    const [folder] = await db.update(formFolders).set(updates).where(eq(formFolders.id, id)).returning();
    return folder || undefined;
  }

  async deleteFormFolder(id: string): Promise<boolean> {
    await db.delete(formFolders).where(eq(formFolders.id, id));
    return true;
  }

  // Form Templates
  async getFormTemplates(): Promise<FormTemplate[]> {
    return db.select().from(formTemplates);
  }

  async getFormTemplate(id: string): Promise<FormTemplate | undefined> {
    const [template] = await db.select().from(formTemplates).where(eq(formTemplates.id, id));
    return template || undefined;
  }

  async createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate> {
    const [newTemplate] = await db.insert(formTemplates).values(template).returning();
    return newTemplate;
  }

  async updateFormTemplate(id: string, updates: Partial<FormTemplate>): Promise<FormTemplate | undefined> {
    const [template] = await db.update(formTemplates).set(updates).where(eq(formTemplates.id, id)).returning();
    return template || undefined;
  }

  async deleteFormTemplate(id: string): Promise<boolean> {
    await db.delete(formTemplates).where(eq(formTemplates.id, id));
    return true;
  }

  // Builder Forms methods
  async getBuilderForms(archived?: boolean): Promise<BuilderForm[]> {
    if (archived !== undefined) {
      return db.select().from(builderForms).where(eq(builderForms.archived, archived)).orderBy(desc(builderForms.updatedAt));
    }
    return db.select().from(builderForms).orderBy(desc(builderForms.updatedAt));
  }

  async getBuilderForm(id: string): Promise<BuilderForm | undefined> {
    const [form] = await db.select().from(builderForms).where(eq(builderForms.id, id));
    return form || undefined;
  }

  async createBuilderForm(form: InsertBuilderForm): Promise<BuilderForm> {
    const [newForm] = await db.insert(builderForms).values(form).returning();
    return newForm;
  }

  async updateBuilderForm(id: string, updates: Partial<BuilderForm>): Promise<BuilderForm | undefined> {
    const [form] = await db.update(builderForms).set({ ...updates, updatedAt: new Date() }).where(eq(builderForms.id, id)).returning();
    return form || undefined;
  }

  async deleteBuilderForm(id: string): Promise<boolean> {
    await db.delete(builderForms).where(eq(builderForms.id, id));
    return true;
  }

  // PDF Forms methods
  async getPdfForms(createdBy?: string): Promise<PdfForm[]> {
    if (createdBy) {
      return db.select().from(pdfForms).where(eq(pdfForms.createdBy, createdBy)).orderBy(desc(pdfForms.createdAt));
    }
    return db.select().from(pdfForms).orderBy(desc(pdfForms.createdAt));
  }

  async getPdfForm(id: string): Promise<PdfForm | undefined> {
    const [form] = await db.select().from(pdfForms).where(eq(pdfForms.id, id));
    return form || undefined;
  }

  async createPdfForm(form: InsertPdfForm): Promise<PdfForm> {
    const [newForm] = await db.insert(pdfForms).values(form).returning();
    return newForm;
  }

  async deletePdfForm(id: string): Promise<boolean> {
    await db.delete(pdfForms).where(eq(pdfForms.id, id));
    return true;
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
    const allEquipment = await db.select().from(equipment);

    return schedules.filter(s => {
      if (s.nextDueDate && s.reminderDays) {
        const reminderDate = new Date(s.nextDueDate);
        reminderDate.setDate(reminderDate.getDate() - s.reminderDays);
        return now >= reminderDate;
      }
      if (s.nextDueMileage) {
        const equip = allEquipment.find(e => e.id === s.equipmentId);
        return equip?.mileage ? equip.mileage >= s.nextDueMileage : false;
      }
      if (s.nextDueHours) {
        const equip = allEquipment.find(e => e.id === s.equipmentId);
        return equip?.hours ? equip.hours >= s.nextDueHours : false;
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

  async getOemTemplates(brand?: string, category?: string): Promise<OemMaintenanceTemplate[]> {
    let conditions = [];
    if (brand) conditions.push(eq(oemMaintenanceTemplates.brand, brand));
    if (category) conditions.push(eq(oemMaintenanceTemplates.category, category));
    if (conditions.length > 0) {
      return await db.select().from(oemMaintenanceTemplates).where(and(...conditions));
    }
    return await db.select().from(oemMaintenanceTemplates);
  }

  async getOemTemplate(id: string): Promise<OemMaintenanceTemplate | undefined> {
    const [t] = await db.select().from(oemMaintenanceTemplates).where(eq(oemMaintenanceTemplates.id, id));
    return t || undefined;
  }

  async getRepairRequests(assetId?: string): Promise<RepairRequest[]> {
    if (assetId) {
      return await db.select().from(repairRequests).where(eq(repairRequests.assetId, assetId));
    }
    return await db.select().from(repairRequests);
  }

  async getRepairRequest(id: string): Promise<RepairRequest | undefined> {
    const [r] = await db.select().from(repairRequests).where(eq(repairRequests.id, id));
    return r || undefined;
  }

  async createRepairRequest(req: InsertRepairRequest): Promise<RepairRequest> {
    const [newReq] = await db.insert(repairRequests).values(req).returning();
    return newReq;
  }

  async updateRepairRequest(id: string, updates: Partial<RepairRequest>): Promise<RepairRequest | undefined> {
    const [updated] = await db.update(repairRequests).set({ ...updates, updatedAt: new Date() }).where(eq(repairRequests.id, id)).returning();
    return updated || undefined;
  }

  async getNextAssetId(): Promise<string> {
    const allEquip = await db.select().from(equipment);
    let maxNum = 0;
    for (const e of allEquip) {
      const match = e.assetId?.match(/EQ-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    }
    return `EQ-${String(maxNum + 1).padStart(4, "0")}`;
  }

  async getFleetDashboardStats(): Promise<{ total: number; active: number; inRepair: number; p1: number; p2: number; p3: number; complianceAlerts: number }> {
    const allEquip = await db.select().from(equipment);
    const allSchedules = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.isActive, true));
    const active = allEquip.filter(e => e.status === "Active").length;
    const inRepair = allEquip.filter(e => e.status === "In Service" || e.status === "in_repair").length;
    const p1 = allSchedules.filter(s => s.priority === "p1").length;
    const p2 = allSchedules.filter(s => s.priority === "p2").length;
    const p3 = allSchedules.filter(s => s.priority === "p3").length;
    const now = new Date();
    let complianceAlerts = 0;
    for (const e of allEquip) {
      if (e.registrationExpiry && new Date(e.registrationExpiry) <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)) complianceAlerts++;
      if (e.insuranceExpiry && new Date(e.insuranceExpiry) <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)) complianceAlerts++;
    }
    return { total: allEquip.length, active, inRepair, p1, p2, p3, complianceAlerts };
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

  // To-Do System
  async getTodos(): Promise<Todo[]> {
    return db.select().from(todos).orderBy(todos.createdAt);
  }

  async getTodo(id: string): Promise<Todo | undefined> {
    const [todo] = await db.select().from(todos).where(eq(todos.id, id));
    return todo || undefined;
  }

  async createTodo(todo: InsertTodo, createdBy: string): Promise<Todo> {
    const [created] = await db.insert(todos).values({ ...todo, createdBy }).returning();
    return created;
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo | undefined> {
    const [updated] = await db.update(todos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(todos.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTodo(id: string): Promise<boolean> {
    await db.delete(todos).where(eq(todos.id, id));
    return true;
  }

  // To-Do Assignments
  async getTodoAssignments(todoId: string): Promise<TodoAssignment[]> {
    return db.select().from(todoAssignments).where(eq(todoAssignments.todoId, todoId));
  }

  async getUserTodoAssignments(userId: string): Promise<TodoAssignment[]> {
    return db.select().from(todoAssignments).where(eq(todoAssignments.userId, userId));
  }

  async createTodoAssignment(assignment: InsertTodoAssignment): Promise<TodoAssignment> {
    const [created] = await db.insert(todoAssignments).values(assignment).returning();
    return created;
  }

  async deleteTodoAssignment(id: string): Promise<boolean> {
    await db.delete(todoAssignments).where(eq(todoAssignments.id, id));
    return true;
  }

  async markTodoAsRead(todoId: string, userId: string): Promise<boolean> {
    await db.update(todoAssignments)
      .set({ isRead: true })
      .where(and(eq(todoAssignments.todoId, todoId), eq(todoAssignments.userId, userId)));
    return true;
  }

  async getUnreadTodoCount(userId: string): Promise<number> {
    const unread = await db.select().from(todoAssignments)
      .where(and(eq(todoAssignments.userId, userId), eq(todoAssignments.isRead, false)));
    return unread.length;
  }

  // To-Do History
  async getTodoHistory(todoId: string): Promise<TodoHistory[]> {
    return db.select().from(todoHistory)
      .where(eq(todoHistory.todoId, todoId))
      .orderBy(todoHistory.changedAt);
  }

  async createTodoHistory(entry: { todoId: string; changedBy: string; changeType: string; fieldChanged?: string; oldValue?: string; newValue?: string }): Promise<TodoHistory> {
    const [created] = await db.insert(todoHistory).values(entry).returning();
    return created;
  }

  // Active To-Do Users
  async getTodoActiveUsers(): Promise<TodoActiveUser[]> {
    return db.select().from(todoActiveUsers);
  }

  async isUserTodoActive(userId: string): Promise<boolean> {
    const [active] = await db.select().from(todoActiveUsers).where(eq(todoActiveUsers.userId, userId));
    return !!active;
  }

  async activateTodoUser(userId: string, activatedBy: string): Promise<TodoActiveUser> {
    const [created] = await db.insert(todoActiveUsers).values({ userId, activatedBy }).returning();
    return created;
  }

  async deactivateTodoUser(userId: string): Promise<boolean> {
    await db.delete(todoActiveUsers).where(eq(todoActiveUsers.userId, userId));
    return true;
  }

  // Plow Site Groups
  async getPlowSiteGroups(): Promise<PlowSiteGroup[]> {
    return db.select().from(plowSiteGroups);
  }

  async getPlowSiteGroup(id: string): Promise<PlowSiteGroup | undefined> {
    const [group] = await db.select().from(plowSiteGroups).where(eq(plowSiteGroups.id, id));
    return group || undefined;
  }

  async createPlowSiteGroup(group: InsertPlowSiteGroup, createdBy: string): Promise<PlowSiteGroup> {
    const [created] = await db.insert(plowSiteGroups).values({ ...group, createdBy }).returning();
    return created;
  }

  async updatePlowSiteGroup(id: string, updates: Partial<PlowSiteGroup>): Promise<PlowSiteGroup | undefined> {
    const [updated] = await db.update(plowSiteGroups)
      .set(updates)
      .where(eq(plowSiteGroups.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePlowSiteGroup(id: string): Promise<boolean> {
    await db.delete(plowSiteGroups).where(eq(plowSiteGroups.id, id));
    return true;
  }

  // Plow Site Maps
  async getPlowSites(): Promise<PlowSite[]> {
    return db.select().from(plowSites);
  }

  async getPlowSite(id: string): Promise<PlowSite | undefined> {
    const [site] = await db.select().from(plowSites).where(eq(plowSites.id, id));
    return site || undefined;
  }

  async createPlowSite(site: InsertPlowSite, createdBy: string): Promise<PlowSite> {
    const [created] = await db.insert(plowSites).values({ ...site, createdBy }).returning();
    return created;
  }

  async updatePlowSite(id: string, updates: Partial<PlowSite>): Promise<PlowSite | undefined> {
    const [updated] = await db.update(plowSites)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(plowSites.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePlowSite(id: string): Promise<boolean> {
    await db.delete(plowSites).where(eq(plowSites.id, id));
    return true;
  }

  // Plow Site Manager Permissions
  async getPlowSiteManagerPermissions(): Promise<PlowSiteManagerPermission[]> {
    return db.select().from(plowSiteManagerPermissions);
  }

  async getPlowSiteManagerPermission(userId: string): Promise<PlowSiteManagerPermission | undefined> {
    const [perm] = await db.select().from(plowSiteManagerPermissions).where(eq(plowSiteManagerPermissions.userId, userId));
    return perm || undefined;
  }

  async setPlowSiteManagerPermission(userId: string, canEdit: boolean, grantedBy: string): Promise<PlowSiteManagerPermission> {
    const existing = await this.getPlowSiteManagerPermission(userId);
    if (existing) {
      const [updated] = await db.update(plowSiteManagerPermissions)
        .set({ canEdit, grantedBy, grantedAt: new Date() })
        .where(eq(plowSiteManagerPermissions.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(plowSiteManagerPermissions).values({ userId, canEdit, grantedBy }).returning();
    return created;
  }

  async deletePlowSiteManagerPermission(userId: string): Promise<boolean> {
    await db.delete(plowSiteManagerPermissions).where(eq(plowSiteManagerPermissions.userId, userId));
    return true;
  }
  
  // Plow Site Images
  async getPlowSiteImages(siteId: string): Promise<PlowSiteImage[]> {
    return db.select().from(plowSiteImages).where(eq(plowSiteImages.siteId, siteId));
  }
  
  async createPlowSiteImage(image: InsertPlowSiteImage): Promise<PlowSiteImage> {
    const [created] = await db.insert(plowSiteImages).values(image).returning();
    return created;
  }
  
  async updatePlowSiteImage(id: string, updates: Partial<PlowSiteImage>): Promise<PlowSiteImage | undefined> {
    const [updated] = await db.update(plowSiteImages).set(updates).where(eq(plowSiteImages.id, id)).returning();
    return updated || undefined;
  }
  
  async deletePlowSiteImage(id: string): Promise<boolean> {
    await db.delete(plowSiteImages).where(eq(plowSiteImages.id, id));
    return true;
  }

  // Site Photos
  async getSitePhotos(siteId: string): Promise<SitePhoto[]> {
    return db.select().from(sitePhotos).where(eq(sitePhotos.siteId, siteId));
  }

  async getSitePhoto(id: string): Promise<SitePhoto | undefined> {
    const [photo] = await db.select().from(sitePhotos).where(eq(sitePhotos.id, id));
    return photo || undefined;
  }

  async createSitePhoto(photo: InsertSitePhoto, createdBy: string): Promise<SitePhoto> {
    const [created] = await db.insert(sitePhotos).values({ ...photo, createdBy }).returning();
    return created;
  }

  async updateSitePhoto(id: string, updates: Partial<SitePhoto>): Promise<SitePhoto | undefined> {
    const [updated] = await db.update(sitePhotos).set(updates).where(eq(sitePhotos.id, id)).returning();
    return updated || undefined;
  }

  async deleteSitePhoto(id: string): Promise<boolean> {
    await db.delete(sitePhotos).where(eq(sitePhotos.id, id));
    return true;
  }

  // Site Photo Variants
  async getSitePhotoVariants(photoId: string): Promise<SitePhotoVariant[]> {
    return db.select().from(sitePhotoVariants).where(eq(sitePhotoVariants.photoId, photoId));
  }

  async getSitePhotoVariant(id: string): Promise<SitePhotoVariant | undefined> {
    const [variant] = await db.select().from(sitePhotoVariants).where(eq(sitePhotoVariants.id, id));
    return variant || undefined;
  }

  async createSitePhotoVariant(variant: InsertSitePhotoVariant, createdBy: string): Promise<SitePhotoVariant> {
    const [created] = await db.insert(sitePhotoVariants).values({ ...variant, createdBy }).returning();
    return created;
  }

  async updateSitePhotoVariant(id: string, updates: Partial<SitePhotoVariant>): Promise<SitePhotoVariant | undefined> {
    const [updated] = await db.update(sitePhotoVariants).set({ ...updates, updatedAt: new Date() }).where(eq(sitePhotoVariants.id, id)).returning();
    return updated || undefined;
  }

  async deleteSitePhotoVariant(id: string): Promise<boolean> {
    await db.delete(sitePhotoVariants).where(eq(sitePhotoVariants.id, id));
    return true;
  }

  // Site Map Features
  async getSiteMapFeatures(siteId: string): Promise<SiteMapFeature[]> {
    return db.select().from(siteMapFeatures).where(eq(siteMapFeatures.siteId, siteId));
  }

  async getSiteMapFeature(id: string): Promise<SiteMapFeature | undefined> {
    const [feature] = await db.select().from(siteMapFeatures).where(eq(siteMapFeatures.id, id));
    return feature || undefined;
  }

  async createSiteMapFeature(feature: InsertSiteMapFeature, createdBy: string): Promise<SiteMapFeature> {
    const [created] = await db.insert(siteMapFeatures).values({ ...feature, createdBy }).returning();
    return created;
  }

  async updateSiteMapFeature(id: string, updates: Partial<SiteMapFeature>): Promise<SiteMapFeature | undefined> {
    const [updated] = await db.update(siteMapFeatures).set(updates).where(eq(siteMapFeatures.id, id)).returning();
    return updated || undefined;
  }

  async deleteSiteMapFeature(id: string): Promise<boolean> {
    await db.delete(siteMapFeatures).where(eq(siteMapFeatures.id, id));
    return true;
  }
  
  // AI Agents
  async getAiAgents(): Promise<AiAgent[]> {
    return db.select().from(aiAgents);
  }
  
  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    return agent || undefined;
  }
  
  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const [created] = await db.insert(aiAgents).values(agent).returning();
    return created;
  }
  
  async updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const [updated] = await db.update(aiAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiAgents.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteAiAgent(id: string): Promise<boolean> {
    await db.delete(aiAgents).where(eq(aiAgents.id, id));
    return true;
  }
  
  // AI Agent Usage Logs
  async getAiAgentUsageLogs(agentId?: string): Promise<AiAgentUsageLog[]> {
    if (agentId) {
      return db.select().from(aiAgentUsageLogs).where(eq(aiAgentUsageLogs.agentId, agentId));
    }
    return db.select().from(aiAgentUsageLogs);
  }
  
  async createAiAgentUsageLog(log: InsertAiAgentUsageLog): Promise<AiAgentUsageLog> {
    const [created] = await db.insert(aiAgentUsageLogs).values(log).returning();
    return created;
  }
  
  async getTotalAgentCost(agentId?: string): Promise<number> {
    const logs = await this.getAiAgentUsageLogs(agentId);
    return logs.reduce((sum, log) => sum + parseFloat(log.estimatedCost || "0"), 0);
  }
  
  // AI Agent Suggestions
  async getAiAgentSuggestions(agentId?: string): Promise<AiAgentSuggestion[]> {
    if (agentId) {
      return db.select().from(aiAgentSuggestions).where(eq(aiAgentSuggestions.agentId, agentId));
    }
    return db.select().from(aiAgentSuggestions);
  }
  
  async createAiAgentSuggestion(suggestion: InsertAiAgentSuggestion): Promise<AiAgentSuggestion> {
    const [created] = await db.insert(aiAgentSuggestions).values(suggestion).returning();
    return created;
  }
  
  async updateAiAgentSuggestion(id: string, updates: Partial<AiAgentSuggestion>): Promise<AiAgentSuggestion | undefined> {
    const [updated] = await db.update(aiAgentSuggestions).set(updates).where(eq(aiAgentSuggestions.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteAiAgentSuggestion(id: string): Promise<boolean> {
    await db.delete(aiAgentSuggestions).where(eq(aiAgentSuggestions.id, id));
    return true;
  }
  
  // Messaging Threads
  async getMessagingThreads(filters?: { customerId?: string; assignedEmployeeId?: string; status?: string }): Promise<MessagingThread[]> {
    let query = db.select().from(messagingThreads);
    
    if (filters) {
      const conditions = [];
      if (filters.customerId) {
        conditions.push(eq(messagingThreads.customerId, filters.customerId));
      }
      if (filters.assignedEmployeeId) {
        conditions.push(eq(messagingThreads.assignedEmployeeId, filters.assignedEmployeeId));
      }
      if (filters.status) {
        conditions.push(eq(messagingThreads.status, filters.status));
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
    }
    
    return query.orderBy(messagingThreads.lastMessageAt);
  }
  
  async getMessagingThread(id: string): Promise<MessagingThread | undefined> {
    const [thread] = await db.select().from(messagingThreads).where(eq(messagingThreads.id, id));
    return thread || undefined;
  }
  
  async createMessagingThread(data: InsertMessagingThread & { initialMessage?: string }): Promise<MessagingThread> {
    const { initialMessage, ...threadData } = data;
    const [thread] = await db.insert(messagingThreads).values(threadData).returning();
    
    // If there's an initial message, create it
    if (initialMessage && thread) {
      await db.insert(threadMessages).values({
        threadId: thread.id,
        senderId: threadData.customerId,
        senderRole: "customer",
        content: initialMessage,
      });
    }
    
    return thread;
  }
  
  async updateMessagingThread(id: string, updates: Partial<MessagingThread>): Promise<MessagingThread | undefined> {
    const [updated] = await db.update(messagingThreads).set(updates).where(eq(messagingThreads.id, id)).returning();
    return updated || undefined;
  }
  
  // Thread Messages
  async getThreadMessages(threadId: string, includeInternalNotes = true): Promise<ThreadMessage[]> {
    let query = db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId));
    
    if (!includeInternalNotes) {
      query = query.where(and(
        eq(threadMessages.threadId, threadId),
        eq(threadMessages.isInternalNote, false)
      )) as any;
    }
    
    return query.orderBy(threadMessages.createdAt);
  }
  
  async createThreadMessage(message: InsertThreadMessage): Promise<ThreadMessage> {
    const [created] = await db.insert(threadMessages).values(message).returning();
    
    // Update thread's last message info
    await db.update(messagingThreads).set({
      lastMessageAt: new Date(),
      lastMessageBy: message.senderId,
      unreadByCustomer: message.senderRole === "employee" && !message.isInternalNote,
      unreadByEmployee: message.senderRole === "customer",
    }).where(eq(messagingThreads.id, message.threadId));
    
    return created;
  }
  
  async markMessagesAsRead(threadId: string, userId: string): Promise<void> {
    // Get the thread to determine if user is customer or employee
    const thread = await this.getMessagingThread(threadId);
    if (!thread) return;
    
    // Mark all messages in thread as read
    await db.update(threadMessages).set({ readAt: new Date() })
      .where(and(
        eq(threadMessages.threadId, threadId),
        eq(threadMessages.readAt, null as any)
      ));
    
    // Update thread unread status based on who is reading
    if (thread.customerId === userId) {
      await db.update(messagingThreads).set({ unreadByCustomer: false })
        .where(eq(messagingThreads.id, threadId));
    } else {
      await db.update(messagingThreads).set({ unreadByEmployee: false })
        .where(eq(messagingThreads.id, threadId));
    }
  }
  
  // Business Processes
  async getBusinessProcesses(): Promise<BusinessProcess[]> {
    return await db.select().from(businessProcesses).orderBy(businessProcesses.name);
  }
  
  async getBusinessProcess(id: string): Promise<BusinessProcess | undefined> {
    const [process] = await db.select().from(businessProcesses).where(eq(businessProcesses.id, id));
    return process || undefined;
  }
  
  async createBusinessProcess(process: InsertBusinessProcess): Promise<BusinessProcess> {
    const [created] = await db.insert(businessProcesses).values(process).returning();
    return created;
  }
  
  async updateBusinessProcess(id: string, updates: Partial<BusinessProcess>): Promise<BusinessProcess | undefined> {
    const [updated] = await db.update(businessProcesses).set({ ...updates, updatedAt: new Date() })
      .where(eq(businessProcesses.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteBusinessProcess(id: string): Promise<boolean> {
    const result = await db.delete(businessProcesses).where(eq(businessProcesses.id, id));
    return true;
  }
  
  // Process Audit Results
  async getProcessAuditResults(processId?: string): Promise<ProcessAuditResult[]> {
    if (processId) {
      return await db.select().from(processAuditResults)
        .where(eq(processAuditResults.processId, processId))
        .orderBy(desc(processAuditResults.createdAt));
    }
    return await db.select().from(processAuditResults).orderBy(desc(processAuditResults.createdAt));
  }
  
  async getProcessAuditResult(id: string): Promise<ProcessAuditResult | undefined> {
    const [result] = await db.select().from(processAuditResults).where(eq(processAuditResults.id, id));
    return result || undefined;
  }
  
  async createProcessAuditResult(result: InsertProcessAuditResult): Promise<ProcessAuditResult> {
    const [created] = await db.insert(processAuditResults).values(result).returning();
    return created;
  }
  
  async updateProcessAuditResult(id: string, updates: Partial<ProcessAuditResult>): Promise<ProcessAuditResult | undefined> {
    const [updated] = await db.update(processAuditResults).set(updates)
      .where(eq(processAuditResults.id, id)).returning();
    return updated || undefined;
  }

  // Integration Wizard implementations
  async getSoftwareIntegrations(category?: string): Promise<SoftwareIntegration[]> {
    if (category) {
      return await db.select().from(softwareIntegrations)
        .where(eq(softwareIntegrations.category, category))
        .orderBy(desc(softwareIntegrations.isPopular), softwareIntegrations.name);
    }
    return await db.select().from(softwareIntegrations)
      .orderBy(desc(softwareIntegrations.isPopular), softwareIntegrations.name);
  }

  async getSoftwareIntegration(id: string): Promise<SoftwareIntegration | undefined> {
    const [result] = await db.select().from(softwareIntegrations).where(eq(softwareIntegrations.id, id));
    return result || undefined;
  }

  async getSoftwareIntegrationByName(name: string): Promise<SoftwareIntegration | undefined> {
    const [result] = await db.select().from(softwareIntegrations).where(ilike(softwareIntegrations.name, name));
    return result || undefined;
  }

  async createSoftwareIntegration(integration: InsertSoftwareIntegration): Promise<SoftwareIntegration> {
    const [created] = await db.insert(softwareIntegrations).values(integration).returning();
    return created;
  }

  async updateSoftwareIntegration(id: string, updates: Partial<SoftwareIntegration>): Promise<SoftwareIntegration | undefined> {
    const [updated] = await db.update(softwareIntegrations).set({ ...updates, updatedAt: new Date() })
      .where(eq(softwareIntegrations.id, id)).returning();
    return updated || undefined;
  }

  async getConfiguredIntegrations(): Promise<ConfiguredIntegration[]> {
    return await db.select().from(configuredIntegrations).orderBy(desc(configuredIntegrations.createdAt));
  }

  async getConfiguredIntegration(id: string): Promise<ConfiguredIntegration | undefined> {
    const [result] = await db.select().from(configuredIntegrations).where(eq(configuredIntegrations.id, id));
    return result || undefined;
  }

  async createConfiguredIntegration(integration: InsertConfiguredIntegration): Promise<ConfiguredIntegration> {
    const [created] = await db.insert(configuredIntegrations).values(integration).returning();
    return created;
  }

  async updateConfiguredIntegration(id: string, updates: Partial<ConfiguredIntegration>): Promise<ConfiguredIntegration | undefined> {
    const [updated] = await db.update(configuredIntegrations).set({ ...updates, updatedAt: new Date() })
      .where(eq(configuredIntegrations.id, id)).returning();
    return updated || undefined;
  }

  async deleteConfiguredIntegration(id: string): Promise<void> {
    await db.delete(configuredIntegrations).where(eq(configuredIntegrations.id, id));
  }

  async getIntegrationCapabilities(softwareId: string): Promise<IntegrationCapability[]> {
    return await db.select().from(integrationCapabilities)
      .where(eq(integrationCapabilities.softwareId, softwareId));
  }

  async createIntegrationCapability(capability: InsertIntegrationCapability): Promise<IntegrationCapability> {
    const [created] = await db.insert(integrationCapabilities).values(capability).returning();
    return created;
  }

  async getIntegrationTests(configuredIntegrationId: string): Promise<IntegrationTest[]> {
    return await db.select().from(integrationTests)
      .where(eq(integrationTests.configuredIntegrationId, configuredIntegrationId))
      .orderBy(desc(integrationTests.createdAt));
  }

  async getIntegrationTest(id: string): Promise<IntegrationTest | undefined> {
    const [result] = await db.select().from(integrationTests).where(eq(integrationTests.id, id));
    return result || undefined;
  }

  async createIntegrationTest(test: InsertIntegrationTest): Promise<IntegrationTest> {
    const [created] = await db.insert(integrationTests).values(test).returning();
    return created;
  }

  async updateIntegrationTest(id: string, updates: Partial<IntegrationTest>): Promise<IntegrationTest | undefined> {
    const [updated] = await db.update(integrationTests).set(updates)
      .where(eq(integrationTests.id, id)).returning();
    return updated || undefined;
  }

  async getIntegrationResearchSession(id: string): Promise<IntegrationResearchSession | undefined> {
    const [result] = await db.select().from(integrationResearchSessions).where(eq(integrationResearchSessions.id, id));
    return result || undefined;
  }

  async createIntegrationResearchSession(session: InsertIntegrationResearchSession): Promise<IntegrationResearchSession> {
    const [created] = await db.insert(integrationResearchSessions).values(session).returning();
    return created;
  }

  async updateIntegrationResearchSession(id: string, updates: Partial<IntegrationResearchSession>): Promise<IntegrationResearchSession | undefined> {
    const [updated] = await db.update(integrationResearchSessions).set(updates)
      .where(eq(integrationResearchSessions.id, id)).returning();
    return updated || undefined;
  }

  // App Updates
  async getAppUpdates(): Promise<AppUpdate[]> {
    return await db.select().from(appUpdates).orderBy(desc(appUpdates.publishedAt));
  }

  async getAppUpdatesForRole(role: string): Promise<AppUpdate[]> {
    const roleHierarchy: Record<string, number> = { Customer: 1, Crew: 2, Manager: 3, Admin: 4 };
    const userLevel = roleHierarchy[role] || 1;
    const results = await db.select().from(appUpdates)
      .where(eq(appUpdates.isActive, true))
      .orderBy(desc(appUpdates.publishedAt));
    return results.filter(u => roleHierarchy[u.minRole] <= userLevel);
  }

  async getUnseenUpdatesForUser(userId: string, role: string): Promise<AppUpdate[]> {
    const roleHierarchy: Record<string, number> = { Customer: 1, Crew: 2, Manager: 3, Admin: 4 };
    const userLevel = roleHierarchy[role] || 1;
    const acknowledged = await db.select().from(userUpdateAcknowledgments).where(eq(userUpdateAcknowledgments.userId, userId));
    const acknowledgedIds = new Set(acknowledged.map(a => a.updateId));
    const updates = await db.select().from(appUpdates)
      .where(eq(appUpdates.isActive, true))
      .orderBy(desc(appUpdates.publishedAt));
    return updates.filter(u => roleHierarchy[u.minRole] <= userLevel && !acknowledgedIds.has(u.id));
  }

  async getAppUpdate(id: string): Promise<AppUpdate | undefined> {
    const [result] = await db.select().from(appUpdates).where(eq(appUpdates.id, id));
    return result || undefined;
  }

  async createAppUpdate(update: InsertAppUpdate): Promise<AppUpdate> {
    const [created] = await db.insert(appUpdates).values(update).returning();
    return created;
  }

  async updateAppUpdate(id: string, updates: Partial<AppUpdate>): Promise<AppUpdate | undefined> {
    const [updated] = await db.update(appUpdates).set(updates).where(eq(appUpdates.id, id)).returning();
    return updated || undefined;
  }

  async deleteAppUpdate(id: string): Promise<boolean> {
    await db.delete(userUpdateAcknowledgments).where(eq(userUpdateAcknowledgments.updateId, id));
    const result = await db.delete(appUpdates).where(eq(appUpdates.id, id));
    return true;
  }

  async acknowledgeUpdate(userId: string, updateId: string): Promise<UserUpdateAcknowledgment> {
    const [created] = await db.insert(userUpdateAcknowledgments).values({ userId, updateId }).returning();
    return created;
  }

  // Help Articles
  async getHelpArticles(role?: string): Promise<HelpArticle[]> {
    const roleHierarchy: Record<string, number> = { Customer: 1, Crew: 2, Manager: 3, Admin: 4 };
    const userLevel = role ? (roleHierarchy[role] || 1) : 4;
    const results = await db.select().from(helpArticles)
      .where(eq(helpArticles.isPublished, true))
      .orderBy(helpArticles.sortOrder);
    return results.filter(a => roleHierarchy[a.minRole] <= userLevel);
  }

  async getHelpArticle(id: string): Promise<HelpArticle | undefined> {
    const [result] = await db.select().from(helpArticles).where(eq(helpArticles.id, id));
    return result || undefined;
  }

  async getHelpArticleBySlug(slug: string): Promise<HelpArticle | undefined> {
    const [result] = await db.select().from(helpArticles).where(eq(helpArticles.slug, slug));
    return result || undefined;
  }

  async searchHelpArticles(query: string, role: string): Promise<HelpArticle[]> {
    const roleHierarchy: Record<string, number> = { Customer: 1, Crew: 2, Manager: 3, Admin: 4 };
    const userLevel = roleHierarchy[role] || 1;
    const results = await db.select().from(helpArticles)
      .where(and(
        eq(helpArticles.isPublished, true),
        or(
          ilike(helpArticles.title, `%${query}%`),
          ilike(helpArticles.summary, `%${query}%`),
          ilike(helpArticles.content, `%${query}%`)
        )
      ));
    return results.filter(a => roleHierarchy[a.minRole] <= userLevel);
  }

  async createHelpArticle(article: InsertHelpArticle): Promise<HelpArticle> {
    const [created] = await db.insert(helpArticles).values(article).returning();
    return created;
  }

  async updateHelpArticle(id: string, updates: Partial<HelpArticle>): Promise<HelpArticle | undefined> {
    const [updated] = await db.update(helpArticles).set({ ...updates, updatedAt: new Date() })
      .where(eq(helpArticles.id, id)).returning();
    return updated || undefined;
  }

  async deleteHelpArticle(id: string): Promise<boolean> {
    await db.delete(helpArticles).where(eq(helpArticles.id, id));
    return true;
  }

  // Help Categories
  async getHelpCategories(role?: string): Promise<HelpCategory[]> {
    const roleHierarchy: Record<string, number> = { Customer: 1, Crew: 2, Manager: 3, Admin: 4 };
    const userLevel = role ? (roleHierarchy[role] || 1) : 4;
    const results = await db.select().from(helpCategories).orderBy(helpCategories.sortOrder);
    return results.filter(c => roleHierarchy[c.minRole] <= userLevel);
  }

  async getHelpCategory(id: string): Promise<HelpCategory | undefined> {
    const [result] = await db.select().from(helpCategories).where(eq(helpCategories.id, id));
    return result || undefined;
  }

  async createHelpCategory(category: InsertHelpCategory): Promise<HelpCategory> {
    const [created] = await db.insert(helpCategories).values(category).returning();
    return created;
  }

  async updateHelpCategory(id: string, updates: Partial<HelpCategory>): Promise<HelpCategory | undefined> {
    const [updated] = await db.update(helpCategories).set(updates).where(eq(helpCategories.id, id)).returning();
    return updated || undefined;
  }

  async deleteHelpCategory(id: string): Promise<boolean> {
    await db.delete(helpCategories).where(eq(helpCategories.id, id));
    return true;
  }

  // Help Article Reports
  async getArticleReports(status?: string): Promise<HelpArticleReport[]> {
    if (status) {
      return await db.select().from(helpArticleReports)
        .where(eq(helpArticleReports.status, status))
        .orderBy(desc(helpArticleReports.createdAt));
    }
    return await db.select().from(helpArticleReports).orderBy(desc(helpArticleReports.createdAt));
  }

  async getArticleReportsByArticle(articleId: string): Promise<HelpArticleReport[]> {
    return await db.select().from(helpArticleReports)
      .where(eq(helpArticleReports.articleId, articleId))
      .orderBy(desc(helpArticleReports.createdAt));
  }

  async createArticleReport(report: InsertHelpArticleReport): Promise<HelpArticleReport> {
    const [created] = await db.insert(helpArticleReports).values(report).returning();
    return created;
  }

  async updateArticleReport(id: string, updates: Partial<HelpArticleReport>): Promise<HelpArticleReport | undefined> {
    const [updated] = await db.update(helpArticleReports).set(updates)
      .where(eq(helpArticleReports.id, id)).returning();
    return updated || undefined;
  }

  async getPendingReportsCount(): Promise<number> {
    const results = await db.select().from(helpArticleReports)
      .where(eq(helpArticleReports.status, "pending"));
    return results.length;
  }

  // Article Update Notifications
  async getUserArticleNotifications(userId: string): Promise<ArticleUpdateNotification[]> {
    return await db.select().from(articleUpdateNotifications)
      .where(eq(articleUpdateNotifications.userId, userId))
      .orderBy(desc(articleUpdateNotifications.createdAt));
  }

  async getUnreadArticleNotifications(userId: string): Promise<ArticleUpdateNotification[]> {
    return await db.select().from(articleUpdateNotifications)
      .where(and(
        eq(articleUpdateNotifications.userId, userId),
        eq(articleUpdateNotifications.isRead, false)
      ))
      .orderBy(desc(articleUpdateNotifications.createdAt));
  }

  async createArticleNotification(notification: InsertArticleUpdateNotification): Promise<ArticleUpdateNotification> {
    const [created] = await db.insert(articleUpdateNotifications).values(notification).returning();
    return created;
  }

  async markArticleNotificationRead(id: string): Promise<boolean> {
    await db.update(articleUpdateNotifications).set({ isRead: true })
      .where(eq(articleUpdateNotifications.id, id));
    return true;
  }

  async notifyUsersOfArticleUpdate(articleId: string, message: string, minRole: string): Promise<void> {
    const roleHierarchy: Record<string, number> = { Customer: 1, Crew: 2, Manager: 3, Admin: 4 };
    const minRoleLevel = roleHierarchy[minRole] || 1;
    const allUsers = await db.select().from(users);
    const eligibleUsers = allUsers.filter(u => roleHierarchy[u.role] >= minRoleLevel);
    
    for (const user of eligibleUsers) {
      await db.insert(articleUpdateNotifications).values({
        articleId,
        userId: user.id,
        notificationType: "updated",
        message
      });
    }
  }

  // Calendar Connections
  async getUserCalendarConnections(userId: string): Promise<CalendarConnection[]> {
    return await db.select().from(calendarConnections)
      .where(eq(calendarConnections.userId, userId))
      .orderBy(desc(calendarConnections.createdAt));
  }

  async getCalendarConnection(id: string): Promise<CalendarConnection | undefined> {
    const [result] = await db.select().from(calendarConnections).where(eq(calendarConnections.id, id));
    return result || undefined;
  }

  async getCalendarConnectionByProvider(userId: string, provider: string): Promise<CalendarConnection | undefined> {
    const [result] = await db.select().from(calendarConnections)
      .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.provider, provider)));
    return result || undefined;
  }

  async createCalendarConnection(connection: InsertCalendarConnection): Promise<CalendarConnection> {
    const [created] = await db.insert(calendarConnections).values(connection).returning();
    return created;
  }

  async updateCalendarConnection(id: string, updates: Partial<CalendarConnection>): Promise<CalendarConnection | undefined> {
    const [updated] = await db.update(calendarConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendarConnections.id, id)).returning();
    return updated || undefined;
  }

  async deleteCalendarConnection(id: string): Promise<boolean> {
    await db.delete(calendarConnections).where(eq(calendarConnections.id, id));
    return true;
  }

  // Error Logs
  async getErrorLogs(filters?: { severity?: string; feature?: string; isResolved?: boolean; limit?: number }): Promise<ErrorLog[]> {
    let query = db.select().from(errorLogs);
    const conditions: any[] = [];
    
    if (filters?.severity) {
      conditions.push(eq(errorLogs.severity, filters.severity));
    }
    if (filters?.feature) {
      conditions.push(eq(errorLogs.feature, filters.feature));
    }
    if (filters?.isResolved !== undefined) {
      conditions.push(eq(errorLogs.isResolved, filters.isResolved));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(errorLogs.createdAt)).limit(filters?.limit || 100);
  }

  async createErrorLog(log: InsertErrorLog): Promise<ErrorLog> {
    const [created] = await db.insert(errorLogs).values(log).returning();
    return created;
  }

  async updateErrorLog(id: string, updates: Partial<ErrorLog>): Promise<ErrorLog | undefined> {
    const [updated] = await db.update(errorLogs).set(updates).where(eq(errorLogs.id, id)).returning();
    return updated || undefined;
  }

  async getErrorStats(): Promise<{ total: number; unresolved: number; bySeverity: Record<string, number>; byFeature: Record<string, number> }> {
    const allErrors = await db.select().from(errorLogs);
    
    const total = allErrors.length;
    const unresolved = allErrors.filter(e => !e.isResolved).length;
    
    const bySeverity: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    
    allErrors.forEach(e => {
      const sev = e.severity || 'unknown';
      const feat = e.feature || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      byFeature[feat] = (byFeature[feat] || 0) + 1;
    });
    
    return { total, unresolved, bySeverity, byFeature };
  }

  // Marketing Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values(campaign).returning();
    return created;
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const [updated] = await db.update(campaigns).set(updates).where(eq(campaigns.id, id)).returning();
    return updated;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return result.length > 0;
  }

  // Development Tracker
  async getDevelopmentItems(filters?: { status?: string; category?: string; priority?: string }): Promise<DevelopmentTracker[]> {
    let query = db.select().from(developmentTracker);
    const conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(developmentTracker.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(developmentTracker.category, filters.category));
    }
    if (filters?.priority) {
      conditions.push(eq(developmentTracker.priority, filters.priority));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(developmentTracker.priority), developmentTracker.featureName);
  }

  async getDevelopmentItem(id: string): Promise<DevelopmentTracker | undefined> {
    const [result] = await db.select().from(developmentTracker).where(eq(developmentTracker.id, id));
    return result || undefined;
  }

  async createDevelopmentItem(item: InsertDevelopmentTracker): Promise<DevelopmentTracker> {
    const [created] = await db.insert(developmentTracker).values(item).returning();
    return created;
  }

  async updateDevelopmentItem(id: string, updates: Partial<DevelopmentTracker>): Promise<DevelopmentTracker | undefined> {
    const [updated] = await db.update(developmentTracker)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(developmentTracker.id, id)).returning();
    return updated || undefined;
  }

  async deleteDevelopmentItem(id: string): Promise<boolean> {
    await db.delete(developmentTracker).where(eq(developmentTracker.id, id));
    return true;
  }

  async getSopMedia(sopId: string): Promise<SopMedia[]> {
    return await db.select().from(sopMedia).where(eq(sopMedia.sopId, sopId));
  }

  async createSopMedia(media: InsertSopMedia): Promise<SopMedia> {
    const [created] = await db.insert(sopMedia).values(media).returning();
    return created;
  }

  async deleteSopMedia(id: string): Promise<boolean> {
    await db.delete(sopMedia).where(eq(sopMedia.id, id));
    return true;
  }

  async createAiGenerationEvent(event: InsertAiGenerationEvent): Promise<AiGenerationEvent> {
    const [created] = await db.insert(aiGenerationEvents).values(event).returning();
    return created;
  }

  async getAiGenerationEventsCount(userId: string, since: Date): Promise<number> {
    const results = await db.select().from(aiGenerationEvents)
      .where(and(
        eq(aiGenerationEvents.userId, userId),
        eq(aiGenerationEvents.status, "success")
      ));
    return results.filter(r => r.createdAt && r.createdAt >= since).length;
  }

  async getAiGenerationEventsCountAll(since: Date): Promise<number> {
    const results = await db.select().from(aiGenerationEvents)
      .where(eq(aiGenerationEvents.status, "success"));
    return results.filter(r => r.createdAt && r.createdAt >= since).length;
  }

  async getSopDrafts(ownerId: string): Promise<SopDraft[]> {
    return await db.select().from(sopDrafts)
      .where(eq(sopDrafts.ownerId, ownerId))
      .orderBy(desc(sopDrafts.updatedAt));
  }

  async getSopDraft(id: string): Promise<SopDraft | undefined> {
    const [draft] = await db.select().from(sopDrafts).where(eq(sopDrafts.id, id));
    return draft || undefined;
  }

  async upsertSopDraft(draft: InsertSopDraft & { id?: string }): Promise<SopDraft> {
    if (draft.id) {
      const [updated] = await db.update(sopDrafts)
        .set({ ...draft, updatedAt: new Date() })
        .where(eq(sopDrafts.id, draft.id))
        .returning();
      if (updated) return updated;
    }
    const { id, ...insertData } = draft;
    const [created] = await db.insert(sopDrafts).values(insertData).returning();
    return created;
  }

  async deleteSopDraft(id: string): Promise<boolean> {
    const result = await db.delete(sopDrafts).where(eq(sopDrafts.id, id));
    return (result?.rowCount ?? 0) > 0;
  }

  async getSopQuizzes(sopId: string): Promise<SopQuiz[]> {
    return await db.select().from(sopQuizzes)
      .where(eq(sopQuizzes.sopId, sopId))
      .orderBy(sopQuizzes.skillLevel);
  }

  async getSopQuiz(id: string): Promise<SopQuiz | undefined> {
    const [quiz] = await db.select().from(sopQuizzes).where(eq(sopQuizzes.id, id));
    return quiz || undefined;
  }

  async createSopQuiz(quiz: InsertSopQuiz): Promise<SopQuiz> {
    const [created] = await db.insert(sopQuizzes).values(quiz).returning();
    return created;
  }

  async deleteSopQuiz(id: string): Promise<boolean> {
    const result = await db.delete(sopQuizzes).where(eq(sopQuizzes.id, id));
    return (result?.rowCount ?? 0) > 0;
  }

  async deleteSopQuizzesBySop(sopId: string): Promise<boolean> {
    const result = await db.delete(sopQuizzes).where(eq(sopQuizzes.sopId, sopId));
    return (result?.rowCount ?? 0) >= 0;
  }

  async getQuizQuestions(quizId: string): Promise<SopQuizQuestion[]> {
    return await db.select().from(sopQuizQuestions)
      .where(eq(sopQuizQuestions.quizId, quizId))
      .orderBy(sopQuizQuestions.sortOrder);
  }

  async createQuizQuestion(question: InsertSopQuizQuestion): Promise<SopQuizQuestion> {
    const [created] = await db.insert(sopQuizQuestions).values(question).returning();
    return created;
  }

  async createQuizQuestionsBatch(questions: InsertSopQuizQuestion[]): Promise<SopQuizQuestion[]> {
    if (questions.length === 0) return [];
    return await db.insert(sopQuizQuestions).values(questions).returning();
  }

  async getUserQuizAttempts(userId: string, quizId?: string): Promise<UserQuizAttempt[]> {
    if (quizId) {
      return await db.select().from(userQuizAttempts)
        .where(and(eq(userQuizAttempts.userId, userId), eq(userQuizAttempts.quizId, quizId)))
        .orderBy(desc(userQuizAttempts.completedAt));
    }
    return await db.select().from(userQuizAttempts)
      .where(eq(userQuizAttempts.userId, userId))
      .orderBy(desc(userQuizAttempts.completedAt));
  }

  async createQuizAttempt(attempt: InsertUserQuizAttempt): Promise<UserQuizAttempt> {
    const [created] = await db.insert(userQuizAttempts).values(attempt).returning();
    return created;
  }

  async getAllQuizAttempts(quizId: string): Promise<UserQuizAttempt[]> {
    return await db.select().from(userQuizAttempts)
      .where(eq(userQuizAttempts.quizId, quizId))
      .orderBy(desc(userQuizAttempts.completedAt));
  }

  async getHqFiles(): Promise<HqFile[]> {
    return db.select().from(hqFiles).orderBy(sql`${hqFiles.createdAt} DESC`);
  }

  async getHqFile(id: string): Promise<HqFile | undefined> {
    const [file] = await db.select().from(hqFiles).where(eq(hqFiles.id, id));
    return file;
  }

  async createHqFile(file: InsertHqFile): Promise<HqFile> {
    const [created] = await db.insert(hqFiles).values(file).returning();
    return created;
  }

  async deleteHqFile(id: string): Promise<boolean> {
    const result = await db.delete(hqFiles).where(eq(hqFiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getQualifiedLeads(): Promise<QualifiedLead[]> {
    return await db.select().from(qualifiedLeads).orderBy(desc(qualifiedLeads.createdAt));
  }

  async getQualifiedLead(id: string): Promise<QualifiedLead | undefined> {
    const [lead] = await db.select().from(qualifiedLeads).where(eq(qualifiedLeads.id, id));
    return lead;
  }

  async createQualifiedLead(lead: InsertQualifiedLead): Promise<QualifiedLead> {
    const [created] = await db.insert(qualifiedLeads).values(lead).returning();
    return created;
  }

  async updateQualifiedLead(id: string, updates: Partial<QualifiedLead>): Promise<QualifiedLead | undefined> {
    const [updated] = await db.update(qualifiedLeads).set(updates).where(eq(qualifiedLeads.id, id)).returning();
    return updated;
  }

  async deleteQualifiedLead(id: string): Promise<boolean> {
    const result = await db.delete(qualifiedLeads).where(eq(qualifiedLeads.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getApplicantNotes(candidateId: string): Promise<ApplicantNote[]> {
    return await db.select().from(applicantNotes).where(eq(applicantNotes.candidateId, candidateId)).orderBy(desc(applicantNotes.createdAt));
  }

  async createApplicantNote(note: InsertApplicantNote): Promise<ApplicantNote> {
    const [created] = await db.insert(applicantNotes).values(note).returning();
    return created;
  }

  async getApplicantCommunications(candidateId: string): Promise<ApplicantCommunication[]> {
    return await db.select().from(applicantCommunications).where(eq(applicantCommunications.candidateId, candidateId)).orderBy(desc(applicantCommunications.createdAt));
  }

  async createApplicantCommunication(comm: InsertApplicantCommunication): Promise<ApplicantCommunication> {
    const [created] = await db.insert(applicantCommunications).values(comm).returning();
    return created;
  }

  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    return emp;
  }

  async getEmployeeByCandidateId(candidateId: string): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.candidateId, candidateId));
    return emp;
  }

  async createEmployee(emp: InsertEmployee): Promise<Employee> {
    const [created] = await db.insert(employees).values(emp).returning();
    return created;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | undefined> {
    const [updated] = await db.update(employees).set({ ...updates, updatedAt: new Date() }).where(eq(employees.id, id)).returning();
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getEmployeePayHistory(employeeId: string): Promise<EmployeePayHistory[]> {
    return await db.select().from(employeePayHistory).where(eq(employeePayHistory.employeeId, employeeId)).orderBy(desc(employeePayHistory.createdAt));
  }

  async createEmployeePayHistory(entry: InsertEmployeePayHistory): Promise<EmployeePayHistory> {
    const [created] = await db.insert(employeePayHistory).values(entry).returning();
    return created;
  }

  async getEmployeeHistory(employeeId: string): Promise<EmployeeHistory[]> {
    return await db.select().from(employeeHistory).where(eq(employeeHistory.employeeId, employeeId)).orderBy(desc(employeeHistory.createdAt));
  }

  async createEmployeeHistory(entry: InsertEmployeeHistory): Promise<EmployeeHistory> {
    const [created] = await db.insert(employeeHistory).values(entry).returning();
    return created;
  }

  async getEmployeeNotes(employeeId: string): Promise<EmployeeNote[]> {
    return await db.select().from(employeeNotes).where(eq(employeeNotes.employeeId, employeeId)).orderBy(desc(employeeNotes.createdAt));
  }

  async createEmployeeNote(note: InsertEmployeeNote): Promise<EmployeeNote> {
    const [created] = await db.insert(employeeNotes).values(note).returning();
    return created;
  }

  async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    return await db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId)).orderBy(desc(employeeDocuments.createdAt));
  }

  async createEmployeeDocument(doc: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const [created] = await db.insert(employeeDocuments).values(doc).returning();
    return created;
  }

  async updateEmployeeDocument(id: string, updates: Partial<EmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const [updated] = await db.update(employeeDocuments).set(updates).where(eq(employeeDocuments.id, id)).returning();
    return updated;
  }

  async deleteEmployeeDocument(id: string): Promise<boolean> {
    const result = await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getOnboardingItems(employeeId: string): Promise<OnboardingItem[]> {
    return await db.select().from(onboardingItems).where(eq(onboardingItems.employeeId, employeeId)).orderBy(onboardingItems.createdAt);
  }

  async createOnboardingItem(item: InsertOnboardingItem): Promise<OnboardingItem> {
    const [created] = await db.insert(onboardingItems).values(item).returning();
    return created;
  }

  async updateOnboardingItem(id: string, updates: Partial<OnboardingItem>): Promise<OnboardingItem | undefined> {
    const [updated] = await db.update(onboardingItems).set(updates).where(eq(onboardingItems.id, id)).returning();
    return updated;
  }

  async getHrFormSubmissions(employeeId?: string, candidateId?: string): Promise<HrFormSubmission[]> {
    if (employeeId) {
      return await db.select().from(hrFormSubmissions).where(eq(hrFormSubmissions.employeeId, employeeId)).orderBy(desc(hrFormSubmissions.createdAt));
    }
    if (candidateId) {
      return await db.select().from(hrFormSubmissions).where(eq(hrFormSubmissions.candidateId, candidateId)).orderBy(desc(hrFormSubmissions.createdAt));
    }
    return await db.select().from(hrFormSubmissions).orderBy(desc(hrFormSubmissions.createdAt));
  }

  async getHrFormSubmission(id: string): Promise<HrFormSubmission | undefined> {
    const [form] = await db.select().from(hrFormSubmissions).where(eq(hrFormSubmissions.id, id));
    return form;
  }

  async createHrFormSubmission(form: InsertHrFormSubmission): Promise<HrFormSubmission> {
    const [created] = await db.insert(hrFormSubmissions).values(form).returning();
    return created;
  }

  async updateHrFormSubmission(id: string, updates: Partial<HrFormSubmission>): Promise<HrFormSubmission | undefined> {
    const [updated] = await db.update(hrFormSubmissions).set({ ...updates, updatedAt: new Date() }).where(eq(hrFormSubmissions.id, id)).returning();
    return updated;
  }

  async getHiringEmailTemplates(): Promise<HiringEmailTemplate[]> {
    return await db.select().from(hiringEmailTemplates);
  }

  async getHiringEmailTemplate(stage: string): Promise<HiringEmailTemplate | undefined> {
    const [template] = await db.select().from(hiringEmailTemplates).where(eq(hiringEmailTemplates.stage, stage));
    return template;
  }

  async updateHiringEmailTemplate(id: string, updates: Partial<HiringEmailTemplate>): Promise<HiringEmailTemplate | undefined> {
    const [updated] = await db.update(hiringEmailTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(hiringEmailTemplates.id, id)).returning();
    return updated;
  }

  // Customer Hub - Customer Jobs
  async getCustomerJobs(customerId: string): Promise<CustomerJob[]> {
    return await db.select().from(customerJobs).where(eq(customerJobs.customerId, customerId)).orderBy(desc(customerJobs.createdAt));
  }

  async createCustomerJob(data: InsertCustomerJob): Promise<CustomerJob> {
    const [created] = await db.insert(customerJobs).values(data).returning();
    return created;
  }

  async deleteCustomerJob(id: string): Promise<boolean> {
    const [deleted] = await db.delete(customerJobs).where(eq(customerJobs.id, id)).returning();
    return !!deleted;
  }

  async getCustomerJobsByJobId(jobId: string): Promise<CustomerJob[]> {
    return await db.select().from(customerJobs).where(eq(customerJobs.jobId, jobId));
  }

  // Customer Hub - Customer Documents
  async getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
    return await db.select().from(customerDocuments).where(eq(customerDocuments.customerId, customerId)).orderBy(desc(customerDocuments.createdAt));
  }

  async createCustomerDocument(data: InsertCustomerDocument): Promise<CustomerDocument> {
    const [created] = await db.insert(customerDocuments).values(data).returning();
    return created;
  }

  async updateCustomerDocument(id: string, updates: Partial<CustomerDocument>): Promise<CustomerDocument | undefined> {
    const [updated] = await db.update(customerDocuments).set(updates).where(eq(customerDocuments.id, id)).returning();
    return updated;
  }

  async deleteCustomerDocument(id: string): Promise<boolean> {
    const [deleted] = await db.delete(customerDocuments).where(eq(customerDocuments.id, id)).returning();
    return !!deleted;
  }

  // Customer Hub - Care Guides
  async getCareGuides(): Promise<CareGuide[]> {
    return await db.select().from(careGuides).orderBy(desc(careGuides.createdAt));
  }

  async getPublishedCareGuides(): Promise<CareGuide[]> {
    return await db.select().from(careGuides).where(eq(careGuides.isPublished, true)).orderBy(desc(careGuides.createdAt));
  }

  async getCareGuide(id: string): Promise<CareGuide | undefined> {
    const [guide] = await db.select().from(careGuides).where(eq(careGuides.id, id));
    return guide;
  }

  async createCareGuide(data: InsertCareGuide): Promise<CareGuide> {
    const [created] = await db.insert(careGuides).values(data).returning();
    return created;
  }

  async updateCareGuide(id: string, updates: Partial<CareGuide>): Promise<CareGuide | undefined> {
    const [updated] = await db.update(careGuides).set({ ...updates, updatedAt: new Date() }).where(eq(careGuides.id, id)).returning();
    return updated;
  }

  async deleteCareGuide(id: string): Promise<boolean> {
    await db.delete(customerSavedGuides).where(eq(customerSavedGuides.guideId, id));
    const [deleted] = await db.delete(careGuides).where(eq(careGuides.id, id)).returning();
    return !!deleted;
  }

  // Customer Hub - Saved Guides
  async getCustomerSavedGuides(customerId: string): Promise<CustomerSavedGuide[]> {
    return await db.select().from(customerSavedGuides).where(eq(customerSavedGuides.customerId, customerId));
  }

  async createCustomerSavedGuide(data: InsertCustomerSavedGuide): Promise<CustomerSavedGuide> {
    const [created] = await db.insert(customerSavedGuides).values(data).returning();
    return created;
  }

  async deleteCustomerSavedGuide(customerId: string, guideId: string): Promise<boolean> {
    const [deleted] = await db.delete(customerSavedGuides).where(and(eq(customerSavedGuides.customerId, customerId), eq(customerSavedGuides.guideId, guideId))).returning();
    return !!deleted;
  }

  // Customer Hub - Notifications
  async getCustomerNotifications(customerId: string): Promise<CustomerNotification[]> {
    return await db.select().from(customerNotifications).where(eq(customerNotifications.customerId, customerId)).orderBy(desc(customerNotifications.createdAt));
  }

  async getUnreadNotificationCount(customerId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(customerNotifications).where(and(eq(customerNotifications.customerId, customerId), eq(customerNotifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async createCustomerNotification(data: InsertCustomerNotification): Promise<CustomerNotification> {
    const [created] = await db.insert(customerNotifications).values(data).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const [updated] = await db.update(customerNotifications).set({ isRead: true }).where(eq(customerNotifications.id, id)).returning();
    return !!updated;
  }

  async markAllNotificationsRead(customerId: string): Promise<void> {
    await db.update(customerNotifications).set({ isRead: true }).where(and(eq(customerNotifications.customerId, customerId), eq(customerNotifications.isRead, false)));
  }

  // Staff Notifications
  async getStaffNotifications(userId: string): Promise<StaffNotification[]> {
    return await db.select().from(staffNotifications).where(eq(staffNotifications.userId, userId)).orderBy(desc(staffNotifications.createdAt));
  }

  async getUnreadStaffNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(staffNotifications).where(and(eq(staffNotifications.userId, userId), eq(staffNotifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async createStaffNotification(data: InsertStaffNotification): Promise<StaffNotification> {
    const [created] = await db.insert(staffNotifications).values(data).returning();
    return created;
  }

  async markStaffNotificationRead(id: string, userId: string): Promise<boolean> {
    const [updated] = await db.update(staffNotifications).set({ isRead: true }).where(and(eq(staffNotifications.id, id), eq(staffNotifications.userId, userId))).returning();
    return !!updated;
  }

  async markAllStaffNotificationsRead(userId: string): Promise<void> {
    await db.update(staffNotifications).set({ isRead: true }).where(and(eq(staffNotifications.userId, userId), eq(staffNotifications.isRead, false)));
  }

  // Task Management System
  async getNextTaskId(): Promise<string> {
    const result = await pool.query(`SELECT task_id FROM tasks WHERE task_id IS NOT NULL ORDER BY task_id DESC LIMIT 1`);
    if (result.rows.length === 0) return "TK-0001";
    const last = result.rows[0].task_id;
    const num = parseInt(last.replace("TK-", "")) + 1;
    return `TK-${String(num).padStart(4, "0")}`;
  }

  async createTask(data: any): Promise<Task> {
    const taskId = await this.getNextTaskId();
    const [created] = await db.insert(tasks).values({ ...data, taskId }).returning();
    return created;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set({ ...updates, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return !!deleted;
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.assignedToUserId, userId)).orderBy(desc(tasks.createdAt));
  }

  async getTasksByCreator(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.createdByUserId, userId)).orderBy(desc(tasks.createdAt));
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getOpenPoolTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(isNull(tasks.assignedToUserId), notInArray(tasks.status, ["complete", "cancelled"]))
    ).orderBy(desc(tasks.createdAt));
  }

  async getTasksByLinkedRecord(recordType: string, recordId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(eq(tasks.linkedRecordType, recordType), eq(tasks.linkedRecordId, recordId))
    ).orderBy(desc(tasks.createdAt));
  }

  async getTaskDashboardCounts(userId: string): Promise<any> {
    const myTasks = await db.select().from(tasks).where(eq(tasks.assignedToUserId, userId));
    const now = new Date();
    const overdue = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && !["complete", "cancelled"].includes(t.status));
    const urgent = myTasks.filter(t => t.priority === "urgent" && !["complete", "cancelled"].includes(t.status));
    const active = myTasks.filter(t => !["complete", "cancelled"].includes(t.status));
    const openPool = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(
      and(isNull(tasks.assignedToUserId), notInArray(tasks.status, ["complete", "cancelled"]))
    );
    return {
      total: active.length,
      overdue: overdue.length,
      urgent: urgent.length,
      active: active.length,
      openPool: openPool[0]?.count || 0,
    };
  }

  async createTaskChecklistItem(data: any): Promise<TaskChecklistItem> {
    const [created] = await db.insert(taskChecklistItems).values(data).returning();
    return created;
  }

  async getTaskChecklistItems(taskId: string): Promise<TaskChecklistItem[]> {
    return await db.select().from(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId)).orderBy(taskChecklistItems.sortOrder);
  }

  async updateTaskChecklistItem(id: string, updates: Partial<TaskChecklistItem>): Promise<TaskChecklistItem | undefined> {
    const [updated] = await db.update(taskChecklistItems).set(updates).where(eq(taskChecklistItems.id, id)).returning();
    return updated;
  }

  async deleteTaskChecklistItem(id: string): Promise<boolean> {
    const [deleted] = await db.delete(taskChecklistItems).where(eq(taskChecklistItems.id, id)).returning();
    return !!deleted;
  }

  async createTaskHistory(data: any): Promise<TaskHistoryEntry> {
    const [created] = await db.insert(taskHistoryTable).values(data).returning();
    return created;
  }

  async getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
    return await db.select().from(taskHistoryTable).where(eq(taskHistoryTable.taskId, taskId)).orderBy(desc(taskHistoryTable.createdAt));
  }

  async createTaskAttachment(data: any): Promise<TaskAttachment> {
    const [created] = await db.insert(taskAttachments).values(data).returning();
    return created;
  }

  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    return await db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId)).orderBy(desc(taskAttachments.uploadedAt));
  }

  async deleteTaskAttachment(id: string): Promise<boolean> {
    const [deleted] = await db.delete(taskAttachments).where(eq(taskAttachments.id, id)).returning();
    return !!deleted;
  }

  async createTaskComment(data: any): Promise<TaskComment> {
    const [created] = await db.insert(taskComments).values(data).returning();
    return created;
  }

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return await db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(desc(taskComments.createdAt));
  }

  async deleteTaskComment(id: string): Promise<boolean> {
    const [deleted] = await db.delete(taskComments).where(eq(taskComments.id, id)).returning();
    return !!deleted;
  }

  async createTaskCustomField(data: any): Promise<TaskCustomField> {
    const [created] = await db.insert(taskCustomFields).values(data).returning();
    return created;
  }

  async getTaskCustomFields(taskId: string): Promise<TaskCustomField[]> {
    return await db.select().from(taskCustomFields).where(eq(taskCustomFields.taskId, taskId)).orderBy(taskCustomFields.createdAt);
  }

  async updateTaskCustomField(id: string, updates: Partial<TaskCustomField>): Promise<TaskCustomField | undefined> {
    const [updated] = await db.update(taskCustomFields).set(updates).where(eq(taskCustomFields.id, id)).returning();
    return updated;
  }

  async deleteTaskCustomField(id: string): Promise<boolean> {
    const [deleted] = await db.delete(taskCustomFields).where(eq(taskCustomFields.id, id)).returning();
    return !!deleted;
  }

  async createTaskDelegation(data: any): Promise<TaskDelegation> {
    const [created] = await db.insert(taskDelegationChain).values(data).returning();
    return created;
  }

  async getTaskDelegationChain(taskId: string): Promise<TaskDelegation[]> {
    return await db.select().from(taskDelegationChain).where(eq(taskDelegationChain.taskId, taskId)).orderBy(taskDelegationChain.delegatedAt);
  }

  async createSharedLink(data: InsertSharedLink): Promise<SharedLink> {
    const [created] = await db.insert(sharedLinks).values(data).returning();
    return created;
  }

  async getSharedLinks(): Promise<SharedLink[]> {
    return await db.select().from(sharedLinks).orderBy(desc(sharedLinks.createdAt));
  }

  async getSharedLinkByToken(token: string): Promise<SharedLink | undefined> {
    const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.token, token));
    return link;
  }

  async getSharedLink(id: string): Promise<SharedLink | undefined> {
    const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.id, id));
    return link;
  }

  async revokeSharedLink(id: string): Promise<SharedLink | undefined> {
    const [updated] = await db.update(sharedLinks).set({ isRevoked: true }).where(eq(sharedLinks.id, id)).returning();
    return updated;
  }

  async incrementSharedLinkViewCount(id: string): Promise<void> {
    await db.update(sharedLinks).set({ viewCount: sql`${sharedLinks.viewCount} + 1` }).where(eq(sharedLinks.id, id));
  }

  async logSharedLinkAccess(sharedLinkId: string, ipAddress: string | null, userAgent: string | null): Promise<SharedLinkAccessLog> {
    const [log] = await db.insert(sharedLinkAccessLogs).values({ sharedLinkId, ipAddress, userAgent }).returning();
    return log;
  }

  async getSharedLinkAccessLogs(sharedLinkId: string): Promise<SharedLinkAccessLog[]> {
    return await db.select().from(sharedLinkAccessLogs).where(eq(sharedLinkAccessLogs.sharedLinkId, sharedLinkId)).orderBy(desc(sharedLinkAccessLogs.accessedAt));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getDocumentsByEntity(entityType: string, entityId: string): Promise<Document[]> {
    return await db.select().from(documents)
      .where(and(eq(documents.homeEntityType, entityType), eq(documents.homeEntityId, entityId)))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByEntityWithLinks(entityType: string, entityId: string): Promise<Document[]> {
    const homeDocs = await db.select().from(documents)
      .where(and(eq(documents.homeEntityType, entityType), eq(documents.homeEntityId, entityId)))
      .orderBy(desc(documents.createdAt));

    const linkedRows = await db.select({ documentId: documentLinks.documentId })
      .from(documentLinks)
      .where(and(eq(documentLinks.linkedEntityType, entityType), eq(documentLinks.linkedEntityId, entityId)));

    if (linkedRows.length > 0) {
      const linkedDocIds = linkedRows.map(r => r.documentId);
      const linkedDocs = await db.select().from(documents)
        .where(or(...linkedDocIds.map(id => eq(documents.id, id))));
      const homeIds = new Set(homeDocs.map(d => d.id));
      const uniqueLinked = linkedDocs.filter(d => !homeIds.has(d.id));
      return [...homeDocs, ...uniqueLinked];
    }

    return homeDocs;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [doc] = await db.update(documents).set({ ...data, updatedAt: new Date() }).where(eq(documents.id, id)).returning();
    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documentLinks).where(eq(documentLinks.documentId, id));
    await db.delete(documents).where(eq(documents.id, id));
  }

  async searchDocuments(query: { fileName?: string; category?: string; entityType?: string; uploadedByUserId?: string }): Promise<Document[]> {
    const conditions = [];
    if (query.fileName) conditions.push(ilike(documents.fileName, `%${query.fileName}%`));
    if (query.category) conditions.push(eq(documents.category, query.category));
    if (query.entityType) conditions.push(eq(documents.homeEntityType, query.entityType));
    if (query.uploadedByUserId) conditions.push(eq(documents.uploadedByUserId, query.uploadedByUserId));
    
    return await db.select().from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documents.createdAt))
      .limit(200);
  }

  async createDocumentLink(data: InsertDocumentLink): Promise<DocumentLink> {
    const [link] = await db.insert(documentLinks).values(data).returning();
    return link;
  }

  async getDocumentLinks(documentId: string): Promise<DocumentLink[]> {
    return await db.select().from(documentLinks).where(eq(documentLinks.documentId, documentId));
  }

  async deleteDocumentLink(id: string): Promise<void> {
    await db.delete(documentLinks).where(eq(documentLinks.id, id));
  }

  async createDocumentShare(data: InsertDocumentShare): Promise<DocumentShare> {
    const [share] = await db.insert(documentShares).values(data).returning();
    return share;
  }

  async getDocumentSharesByDocument(documentId: string): Promise<DocumentShare[]> {
    return await db.select().from(documentShares)
      .where(eq(documentShares.documentId, documentId))
      .orderBy(desc(documentShares.sharedAt));
  }

  async getDocumentSharesByModule(module: string, recordId?: string): Promise<DocumentShare[]> {
    if (recordId) {
      return await db.select().from(documentShares)
        .where(and(
          eq(documentShares.module, module),
          or(eq(documentShares.recordId, recordId), isNull(documentShares.recordId))
        ))
        .orderBy(desc(documentShares.sharedAt));
    }
    return await db.select().from(documentShares)
      .where(eq(documentShares.module, module))
      .orderBy(desc(documentShares.sharedAt));
  }

  async getSharedDocumentsForModule(module: string, recordId?: string): Promise<Document[]> {
    const shares = await this.getDocumentSharesByModule(module, recordId);
    if (shares.length === 0) return [];
    const docIds = [...new Set(shares.map(s => s.documentId))];
    const docs = await db.select().from(documents)
      .where(or(...docIds.map(id => eq(documents.id, id))))
      .orderBy(desc(documents.createdAt));
    return docs;
  }

  async deleteDocumentShare(id: string): Promise<void> {
    await db.delete(documentShares).where(eq(documentShares.id, id));
  }

  async deleteDocumentSharesByDocument(documentId: string): Promise<void> {
    await db.delete(documentShares).where(eq(documentShares.documentId, documentId));
  }

  async createOnboardingFormSubmission(data: InsertOnboardingFormSubmission): Promise<OnboardingFormSubmission> {
    const [sub] = await db.insert(onboardingFormSubmissions).values(data).returning();
    return sub;
  }

  async getOnboardingFormSubmission(id: string): Promise<OnboardingFormSubmission | undefined> {
    const [sub] = await db.select().from(onboardingFormSubmissions).where(eq(onboardingFormSubmissions.id, id));
    return sub;
  }

  async getOnboardingFormSubmissionsByEmployee(employeeId: string): Promise<OnboardingFormSubmission[]> {
    return await db.select().from(onboardingFormSubmissions)
      .where(eq(onboardingFormSubmissions.employeeId, employeeId))
      .orderBy(desc(onboardingFormSubmissions.createdAt));
  }

  async updateOnboardingFormSubmission(id: string, data: Partial<InsertOnboardingFormSubmission>): Promise<OnboardingFormSubmission | undefined> {
    const [sub] = await db.update(onboardingFormSubmissions).set(data).where(eq(onboardingFormSubmissions.id, id)).returning();
    return sub;
  }

  async getEstimates(): Promise<Estimate[]> {
    return await db.select().from(estimates).orderBy(desc(estimates.createdAt));
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [est] = await db.select().from(estimates).where(eq(estimates.id, id));
    return est;
  }

  async createEstimate(data: InsertEstimate): Promise<Estimate> {
    const [est] = await db.insert(estimates).values(data).returning();
    return est;
  }

  async updateEstimate(id: string, data: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    const [est] = await db.update(estimates).set({ ...data, updatedAt: new Date() }).where(eq(estimates.id, id)).returning();
    return est;
  }

  async deleteEstimate(id: string): Promise<boolean> {
    const result = await db.delete(estimates).where(eq(estimates.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();

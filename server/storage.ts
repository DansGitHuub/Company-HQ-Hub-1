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
  activityLogs, type ActivityLog, type InsertActivityLog,
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
  qualifiedLeads, type QualifiedLead, type InsertQualifiedLead
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, ilike, or, and, desc, isNull, sql } from "drizzle-orm";
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
  
  // Activity Logs
  getActivityLogs(filters?: { feature?: string; action?: string; userId?: string; limit?: number }): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
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
      await db.delete(todoAssignments).where(eq(todoAssignments.userId, id));
      await db.delete(todoActiveUsers).where(eq(todoActiveUsers.userId, id));
      await db.delete(userUpdateAcknowledgments).where(eq(userUpdateAcknowledgments.userId, id));
      await db.delete(savedResources).where(eq(savedResources.userId, id));
      await db.delete(calendarConnections).where(eq(calendarConnections.userId, id));
      await db.delete(accessRequests).where(eq(accessRequests.userId, id));
      await db.delete(articleUpdateNotifications).where(eq(articleUpdateNotifications.userId, id));
      await db.delete(aiGenerationEvents).where(eq(aiGenerationEvents.userId, id));
      await db.delete(plowSiteManagerPermissions).where(eq(plowSiteManagerPermissions.userId, id));
      await db.delete(errorLogs).where(eq(errorLogs.userId, id));
      await db.delete(activityLogs).where(eq(activityLogs.userId, id));
      await db.delete(featureRequests).where(eq(featureRequests.userId, id));
      const userConversations = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.userId, id));
      for (const c of userConversations) {
        await db.delete(chatMessages).where(eq(chatMessages.conversationId, c.id));
      }
      await db.delete(conversations).where(eq(conversations.userId, id));
      await db.delete(customerMessages).where(eq(customerMessages.customerId, id));
      await db.update(customerMessages).set({ repliedBy: null }).where(eq(customerMessages.repliedBy, id));
      await db.update(customerMessages).set({ targetEmployeeId: null }).where(eq(customerMessages.targetEmployeeId, id));
      await db.delete(sopDrafts).where(eq(sopDrafts.ownerId, id));
      const userThreads = await db.select({ id: messagingThreads.id }).from(messagingThreads).where(eq(messagingThreads.customerId, id));
      for (const t of userThreads) {
        await db.delete(threadMessages).where(eq(threadMessages.threadId, t.id));
      }
      await db.delete(threadMessages).where(eq(threadMessages.senderId, id));
      await db.delete(messagingThreads).where(eq(messagingThreads.customerId, id));
      await db.update(messagingThreads).set({ assignedEmployeeId: null }).where(eq(messagingThreads.assignedEmployeeId, id));
      await db.update(messagingThreads).set({ lastMessageBy: null }).where(eq(messagingThreads.lastMessageBy, id));
      await db.update(messagingThreads).set({ closedBy: null }).where(eq(messagingThreads.closedBy, id));
      await db.update(workRequests).set({ assignedTo: null }).where(eq(workRequests.assignedTo, id));
      await db.delete(workRequests).where(eq(workRequests.customerId, id));
      await db.update(sops).set({ ownerId: null }).where(eq(sops.ownerId, id));
      await db.update(todos).set({ createdBy: null }).where(eq(todos.createdBy, id));
      await db.update(todoHistory).set({ changedBy: null }).where(eq(todoHistory.changedBy, id));
      await db.update(customForms).set({ createdBy: null }).where(eq(customForms.createdBy, id));
      await db.update(formSubmissions).set({ submittedBy: null }).where(eq(formSubmissions.submittedBy, id));
      await db.update(formSubmissions).set({ reviewedBy: null }).where(eq(formSubmissions.reviewedBy, id));
      await db.update(customerResources).set({ createdBy: null }).where(eq(customerResources.createdBy, id));
      await db.update(candidates).set({ userId: null }).where(eq(candidates.userId, id));
      await db.update(maintenanceLogs).set({ performedBy: null }).where(eq(maintenanceLogs.performedBy, id));
      await db.update(equipmentUploads).set({ uploadedBy: null }).where(eq(equipmentUploads.uploadedBy, id));
      await db.update(plowSiteGroups).set({ createdBy: null }).where(eq(plowSiteGroups.createdBy, id));
      await db.update(plowSites).set({ createdBy: null }).where(eq(plowSites.createdBy, id));
      await db.delete(helpArticleReports).where(eq(helpArticleReports.reportedBy, id));
      await db.update(helpArticleReports).set({ resolvedBy: null }).where(eq(helpArticleReports.resolvedBy, id));
      await db.update(developmentTracker).set({ updatedBy: null }).where(eq(developmentTracker.updatedBy, id));
      await db.update(sitePhotos).set({ createdBy: null }).where(eq(sitePhotos.createdBy, id));
      await db.update(sitePhotoVariants).set({ createdBy: null }).where(eq(sitePhotoVariants.createdBy, id));
      await db.update(siteMapFeatures).set({ createdBy: null }).where(eq(siteMapFeatures.createdBy, id));
      await db.update(sopMedia).set({ createdBy: null }).where(eq(sopMedia.createdBy, id));
      await db.update(accessRequests).set({ reviewedBy: null }).where(eq(accessRequests.reviewedBy, id));
      await db.update(errorLogs).set({ resolvedBy: null }).where(eq(errorLogs.resolvedBy, id));
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

  // Activity Logs
  async getActivityLogs(filters?: { feature?: string; action?: string; userId?: string; limit?: number }): Promise<ActivityLog[]> {
    let query = db.select().from(activityLogs);
    const conditions: any[] = [];
    
    if (filters?.feature) {
      conditions.push(eq(activityLogs.feature, filters.feature));
    }
    if (filters?.action) {
      conditions.push(eq(activityLogs.action, filters.action));
    }
    if (filters?.userId) {
      conditions.push(eq(activityLogs.userId, filters.userId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(activityLogs.createdAt)).limit(filters?.limit || 100);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
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
}

export const storage = new DatabaseStorage();

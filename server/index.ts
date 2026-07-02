import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStaticFiles, serveStaticCatchAll } from "./static";
import { createServer } from "http";
import { seedUsers, seedSampleData, seedDevelopmentTracker, cleanupGibberishRecords } from "./seed";
import { startMaintenanceScheduler } from "./maintenanceScheduler";
import { runEquipmentMigration } from "./equipmentMigration";
import { runTaskMigration } from "./taskMigration";
import { runAssistantMigration } from "./assistantMigration";
import { runQuizAdaptiveMigration } from "./quizMigration";
import { runNotificationMigration } from "./notificationMigration";
import { startTaskScheduler } from "./taskScheduler";
import { startSopPipelineScheduler } from "./sopPipelineScheduler";
import { startProcessAuditScheduler } from "./processAuditScheduler";
import { startNotificationScheduler } from "./notificationScheduler";
import { registerNotificationPreferenceRoutes } from "./notificationPreferencesRoutes";
import { seedOemTemplates } from "./equipmentSeed";
import { runSharedLinksMigration } from "./sharedLinksMigration";
import { runDocumentMigration } from "./documentMigration";
import { runCalendarMigration } from "./calendarMigration";
import { runDocumentSharesMigration } from "./documentSharesMigration";
import { runSuggestionsMigration } from "./suggestionsMigration";
import { runEstimatesMigration } from "./estimatesMigration";
import { runLanguageMigration } from "./languageMigration";
import { runActivityLogMigration } from "./activityLogMigration";
import { seedHiringEmailTemplates, startApplicationTokenScheduler } from "./applicationTokenScheduler";
import { startQuickBooksScheduler } from "./quickbooksScheduler";
import { runCustomerDataMigration } from "./customerDataMigration";
import { runTimeTrackingMigration } from "./timeTrackingMigration";
import { runJobsMigration } from "./jobsMigration";
import { runInvoicesMigration } from "./migrations/invoices";
import { runSmsOptInsMigration } from "./migrations/smsOptIns";
import { runWorkAreasMigration } from "./migrations/workAreas";
import { runNewEstimatesMigration } from "./migrations/newEstimates";
import { runSchedulingMigration } from "./migrations/scheduling";
import { runRouteModeMigration } from "./migrations/routeMode";
import { runAppSettingsMigration } from "./migrations/appSettings";
import { runMaterialsCatalogColumnsMigration } from "./migrations/materialsCatalogColumns";
import { runCatalogExtendedMigration } from "./migrations/catalogExtended";
import { runTermsAndConditionsMigration } from "./migrations/termsAndConditions";
import { runWorksheetTablesMigration } from "./migrations/worksheetTables";
import { runWorksheetPhase3Migration } from "./migrations/worksheetPhase3";
import { runPortalInviteMigration } from "./migrations/portalInvite";
import { runPortalInviteUserMigration } from "./migrations/portalInviteUser";
import { runEstimatingPhaseAMigration } from "./migrations/estimatingPhaseA";
import { runEstimatingPhaseBMigration } from "./migrations/estimatingPhaseB";
import { runEstimatingPhaseE2Migration } from "./migrations/estimatingPhaseE2";
import { runEstimatingPhaseE2PolishMigration } from "./migrations/estimatingPhaseE2Polish";
import { runEstimatingPhaseE3Migration } from "./migrations/estimatingPhaseE3";
import { runCompanyCamPhase1Migration } from "./migrations/companyCamPhase1";
import { runPlantCardsMigration } from "./migrations/plantCards";
import { runWorkOrdersMigration } from "./migrations/workOrders";
import { runJobPacketGateMigration } from "./jobPacketGateMigration";
import { runChangeOrdersMigration } from "./migrations/changeOrders";
import { runCheckpointsMigration } from "./migrations/checkpoints";
import { runCloseoutMigration } from "./migrations/closeout";
import { runCloseoutCleanupMigration } from "./migrations/closeoutCleanup";
import { runWarrantyMigration } from "./migrations/warranty";
import { runPhase4Migration } from "./migrations/phase4";
import { runPhase6Migration } from "./migrations/phase6";
import { runBuilderFormSubmissionsMigration } from "./migrations/builderFormSubmissions";
import { runCandidateGradeStatusMigration } from "./migrations/candidateGradeStatus";
import { runEmployeeStatusColumnMigration } from "./migrations/employeeStatusColumn";
import { runOfferDeclineCounterMigration } from "./migrations/offerDeclineCounter";
import { runQbSyncSkipMigration } from "./migrations/qbSyncSkip";
import { runGpsPingsIndexMigration } from "./migrations/gpsPingsIndex";
import { runResourcesSeasonMigration } from "./migrations/resourcesSeason";
import { runCompanyCamPhotosPhase2Migration } from "./migrations/companyCamPhotosPhase2";
import { runCompanyCamWave3Migration } from "./migrations/companyCamWave3";
import { runWave4Migration } from "./migrations/wave4";
import { syncCCProjectsFromApi } from "./companyCamRoutes";
import { registerPublicPages } from "./publicPages";
import { startLeadAlertScheduler } from "./consultationRoutes";
import { startGpsPingCleanupScheduler } from "./gpsPingCleanupScheduler";
import { startInvoiceOverdueScheduler } from "./invoiceOverdueScheduler";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const port = parseInt(process.env.PORT || "5000", 10);

  // ── Step 1: Serve static files and bind port BEFORE migrations ─────────────
  // The autoscale startup probe (GET /) fires within seconds of container start.
  // Previously, listen() was called AFTER all 60+ migrations, meaning the probe
  // saw 500 errors for ~2+ minutes and the deployment was marked failed even
  // though the app eventually became healthy.
  //
  // Fix: register express.static (serves dist/public/index.html → 200 for GET /)
  // and call listen() immediately. express.static() only intercepts requests for
  // files that actually exist on disk; /api/* and any unknown path fall through
  // via next() and reach the API routes registered further below.
  // The React catch-all (which must come after API routes) is added in Step 5.
  if (process.env.NODE_ENV === "production") {
    serveStaticFiles(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => { log(`serving on port ${port}`); },
  );

  // ── Step 2: Run all migrations ─────────────────────────────────────────────
  // Server is already accepting connections above; migrations run while the
  // health probe receives 200 from the static file layer.
  await runEquipmentMigration();
  await runTaskMigration();
  await runAssistantMigration();
  await runQuizAdaptiveMigration();
  await runNotificationMigration();
  await runSharedLinksMigration();
  await runDocumentMigration();
  await runDocumentSharesMigration();
  await runCalendarMigration();
  await runSuggestionsMigration();
  await runEstimatesMigration();
  await runLanguageMigration();
  await runActivityLogMigration();
  await runTimeTrackingMigration();
  await runJobsMigration();
  await runInvoicesMigration();
  await runSmsOptInsMigration();
  await runWorkAreasMigration();
  await runNewEstimatesMigration();
  await runSchedulingMigration();
  await runRouteModeMigration();
  await runAppSettingsMigration();
  await runMaterialsCatalogColumnsMigration();
  await runCatalogExtendedMigration();
  await runTermsAndConditionsMigration();
  await runWorksheetTablesMigration();
  await runWorksheetPhase3Migration();
  await runPortalInviteMigration();
  await runPortalInviteUserMigration();
  await runEstimatingPhaseAMigration();
  await runEstimatingPhaseBMigration();
  await runEstimatingPhaseE2Migration();
  await runEstimatingPhaseE2PolishMigration();
  await runEstimatingPhaseE3Migration();
  await runCompanyCamPhase1Migration();
  await runCompanyCamPhotosPhase2Migration();
  await runCompanyCamWave3Migration();
  await runWave4Migration();
  await runPlantCardsMigration();
  await runWorkOrdersMigration();
  await runResourcesSeasonMigration();
  await runJobPacketGateMigration();
  await runChangeOrdersMigration();
  await runCheckpointsMigration();
  await runCloseoutMigration();
  await runCloseoutCleanupMigration();
  await runWarrantyMigration();
  await runPhase4Migration();
  await runPhase6Migration();
  await runBuilderFormSubmissionsMigration();
  await runCandidateGradeStatusMigration();
  await runEmployeeStatusColumnMigration();
  await runOfferDeclineCounterMigration();
  await runQbSyncSkipMigration();
  await runGpsPingsIndexMigration();

  // ── Step 3: Register routes and seeds ──────────────────────────────────────
  // Public pages must come before registerRoutes (which sets up the catch-all).
  registerPublicPages(app);

  const missingEnv: string[] = [];
  if (!process.env.COMPANYCAM_API_TOKEN)      missingEnv.push("COMPANYCAM_API_TOKEN");
  if (!process.env.COMPANYCAM_WEBHOOK_SECRET) missingEnv.push("COMPANYCAM_WEBHOOK_SECRET");
  if (!process.env.PLAUD_WEBHOOK_SECRET)      missingEnv.push("PLAUD_WEBHOOK_SECRET");
  if (missingEnv.length > 0) {
    console.warn(`[env] Missing env vars (CompanyCam/Plaud features degraded): ${missingEnv.join(", ")}`);
  }

  console.log('[boot] companycam v1.4.0 — Wave 3 reconciliation queue (sync + match + dismiss) ready');

  syncCCProjectsFromApi().catch((e) =>
    console.error("[companycam-sync] Boot sync failed:", e.message)
  );
  setInterval(() => {
    syncCCProjectsFromApi().catch((e) =>
      console.error("[companycam-sync] Scheduled sync failed:", e.message)
    );
  }, 6 * 60 * 60 * 1000);

  registerNotificationPreferenceRoutes(app);
  await registerRoutes(httpServer, app);

  await seedUsers();
  await cleanupGibberishRecords();
  await seedSampleData();
  await seedOemTemplates();
  await seedDevelopmentTracker();
  await seedHiringEmailTemplates();

  // ── Step 4: Error handler ───────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // ── Step 5: React catch-all (MUST be after all API routes) ─────────────────
  // Serves index.html for any path that didn't match an API route, enabling
  // client-side React routing (/reports, /jobs, etc.).
  if (process.env.NODE_ENV === "production") {
    serveStaticCatchAll(app);
  }

  // ── Step 6: Start background schedulers ────────────────────────────────────
  runCustomerDataMigration().catch((err) =>
    console.error("[customer-data] Background seed error:", err.message)
  );
  startMaintenanceScheduler();
  startTaskScheduler();
  startSopPipelineScheduler();
  startProcessAuditScheduler();
  startApplicationTokenScheduler();
  startQuickBooksScheduler();
  startNotificationScheduler();
  startLeadAlertScheduler();
  startGpsPingCleanupScheduler();
  startInvoiceOverdueScheduler();
})();

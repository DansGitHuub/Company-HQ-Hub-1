import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedUsers, seedSampleData, seedDevelopmentTracker } from "./seed";
import { startMaintenanceScheduler } from "./maintenanceScheduler";
import { runEquipmentMigration } from "./equipmentMigration";
import { runTaskMigration } from "./taskMigration";
import { runAssistantMigration } from "./assistantMigration";
import { runQuizAdaptiveMigration } from "./quizMigration";
import { runNotificationMigration } from "./notificationMigration";
import { startTaskScheduler } from "./taskScheduler";
import { startSopPipelineScheduler } from "./sopPipelineScheduler";
import { startProcessAuditScheduler } from "./processAuditScheduler";
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
import { runCustomerDataMigration } from "./customerDataMigration";
import { runTimeTrackingMigration } from "./timeTrackingMigration";
import { runJobsMigration } from "./jobsMigration";
import { runInvoicesMigration } from "./migrations/invoices";
import { runSmsOptInsMigration } from "./migrations/smsOptIns";
import { runWorkAreasMigration } from "./migrations/workAreas";
import { runNewEstimatesMigration } from "./migrations/newEstimates";
import { runSchedulingMigration } from "./migrations/scheduling";
import { runAppSettingsMigration } from "./migrations/appSettings";
import { registerPublicPages } from "./publicPages";

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
  await runAppSettingsMigration();

  // Public pages must be registered BEFORE registerRoutes (which sets up the React catch-all)
  registerPublicPages(app);

  await registerRoutes(httpServer, app);
  
  await seedUsers();
  await seedSampleData();
  await seedOemTemplates();
  await seedDevelopmentTracker();
  await seedHiringEmailTemplates();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      runCustomerDataMigration().catch((err) =>
        console.error("[customer-data] Background seed error:", err.message)
      );
      startMaintenanceScheduler();
      startTaskScheduler();
      startSopPipelineScheduler();
      startProcessAuditScheduler();
      startApplicationTokenScheduler();
    },
  );
})();

import type { Express, Request, Response } from "express";
import { pool } from "./db";

// ── In-memory ring buffers (resets on redeploy — no DB needed) ────────────────

const RING_SIZE = 50;
const SLOW_THRESHOLD_MS = 2000;

interface ErrorEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  message: string;
}

interface SlowEntry {
  timestamp: string;
  method: string;
  path: string;
  durationMs: number;
}

const recentErrors: ErrorEntry[] = [];
const slowRequests: SlowEntry[] = [];

function pushRing<T>(ring: T[], item: T) {
  ring.unshift(item);
  if (ring.length > RING_SIZE) ring.length = RING_SIZE;
}

/**
 * Called by the Express request-logging middleware in index.ts
 * for every /api response.  No external I/O.
 */
export function recordRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  message?: string,
) {
  const ts = new Date().toISOString();

  if (status >= 500) {
    pushRing(recentErrors, {
      timestamp: ts,
      method,
      path,
      status,
      message: message ?? `HTTP ${status}`,
    });
  }

  if (durationMs >= SLOW_THRESHOLD_MS) {
    pushRing(slowRequests, {
      timestamp: ts,
      method,
      path,
      durationMs,
    });
  }
}

// ── Subsystem checkers ────────────────────────────────────────────────────────

type SubsystemStatus = "operational" | "degraded" | "not_configured" | "down";

interface SubsystemResult {
  key: string;
  label: string;
  status: SubsystemStatus;
  detail: string;
  lastChecked: string;
}

async function checkDatabase(): Promise<SubsystemResult> {
  const key = "database";
  const label = "Database";
  const lastChecked = new Date().toISOString();
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - start;
    return {
      key, label, lastChecked,
      status: "operational",
      detail: `PostgreSQL responding (${latencyMs} ms)`,
    };
  } catch (err: any) {
    return {
      key, label, lastChecked,
      status: "down",
      detail: `Connection error: ${err?.message ?? "unknown"}`,
    };
  }
}

async function checkEmail(): Promise<SubsystemResult> {
  const key = "email";
  const label = "Email";
  const lastChecked = new Date().toISOString();

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "(not set)";

  if (!apiKey) {
    return {
      key, label, lastChecked,
      status: "not_configured",
      detail: "RESEND_API_KEY not set — email sending disabled",
    };
  }

  const isLive = process.env.EMAIL_SENDING_LIVE === "true";
  const mode = isLive ? "live" : "test/redirect";

  return {
    key, label, lastChecked,
    status: "operational",
    detail: `Resend configured · From: ${fromEmail} · Mode: ${mode}`,
  };
}

async function checkSms(): Promise<SubsystemResult> {
  const key = "sms";
  const label = "SMS (Twilio)";
  const lastChecked = new Date().toISOString();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return {
      key, label, lastChecked,
      status: "not_configured",
      detail: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set",
    };
  }

  // Read from-numbers from app_settings (no send — read-only)
  let customerNumber: string | null = null;
  let employeeNumber: string | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM app_settings WHERE key IN ('sms_customer_number', 'sms_employee_number')`,
    );
    for (const r of rows) {
      if (r.key === "sms_customer_number") customerNumber = r.value?.trim() || null;
      if (r.key === "sms_employee_number") employeeNumber = r.value?.trim() || null;
    }
  } catch {}

  // Env-var fallbacks
  if (!customerNumber) customerNumber = process.env.TWILIO_CUSTOMER_PHONE_NUMBER ?? null;
  if (!employeeNumber) employeeNumber = process.env.TWILIO_PHONE_NUMBER ?? null;

  const messagingServiceCustomer = process.env.TWILIO_CUSTOMER_MESSAGING_SERVICE_SID;
  const messagingServiceEmployee = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const customerFrom = messagingServiceCustomer
    ? `MessagingService ${messagingServiceCustomer.slice(-6)}`
    : customerNumber ?? "(not set)";
  const employeeFrom = messagingServiceEmployee
    ? `MessagingService ${messagingServiceEmployee.slice(-6)}`
    : employeeNumber ?? "(not set)";

  const hasCustomer = !!(messagingServiceCustomer || customerNumber);
  const hasEmployee = !!(messagingServiceEmployee || employeeNumber);

  const isLive = process.env.SMS_SENDING_LIVE === "true";
  const mode = isLive ? "live" : "test/disabled";

  if (hasCustomer && hasEmployee) {
    return {
      key, label, lastChecked,
      status: "operational",
      detail: `Customer: ${customerFrom} · Employee: ${employeeFrom} · Mode: ${mode}`,
    };
  }

  if (hasCustomer && !hasEmployee) {
    return {
      key, label, lastChecked,
      status: "degraded",
      detail: `Customer number OK (${customerFrom}) · Employee number not configured (will fall back to customer number) · Mode: ${mode}`,
    };
  }

  return {
    key, label, lastChecked,
    status: "degraded",
    detail: `Twilio creds present but no From numbers configured · Mode: ${mode}`,
  };
}

async function checkStorage(): Promise<SubsystemResult> {
  const key = "storage";
  const label = "Object Storage";
  const lastChecked = new Date().toISOString();

  const searchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  const privateDir = process.env.PRIVATE_OBJECT_DIR;

  if (!searchPaths && !privateDir) {
    return {
      key, label, lastChecked,
      status: "not_configured",
      detail: "PUBLIC_OBJECT_SEARCH_PATHS / PRIVATE_OBJECT_DIR not set — object storage not initialised",
    };
  }

  // Cheap liveness: list objects under the first configured prefix (object-level
  // IAM — storage.objects.list).  Never calls buckets.get / bucket.getMetadata.
  try {
    const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");

    // Path format: /<bucket_name>/<prefix>  (comma-separated for PUBLIC_OBJECT_SEARCH_PATHS)
    const firstPath = (searchPaths || privateDir || "").split(",")[0].trim();
    const parts = firstPath.split("/").filter(Boolean);
    const bucketName = parts[0];
    const objectPrefix = parts.slice(1).join("/");

    if (!bucketName) throw new Error("Could not parse bucket name from search path");

    // getFiles with maxResults:1 is a storage.objects.list call — no bucket IAM needed
    const [files] = await objectStorageClient
      .bucket(bucketName)
      .getFiles({ prefix: objectPrefix || "", maxResults: 1 });

    return {
      key, label, lastChecked,
      status: "operational",
      detail: `Object storage accessible (bucket: ${bucketName}, prefix: ${objectPrefix || "(root)"}, objects sampled: ${files.length})`,
    };
  } catch (err: any) {
    const msg = err?.message ?? "unknown";
    return {
      key, label, lastChecked,
      status: "degraded",
      detail: `Object-level access failed: ${msg}`,
    };
  }
}

function checkAI(): SubsystemResult {
  const key = "ai";
  const label = "AI (OpenAI)";
  const lastChecked = new Date().toISOString();

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    return {
      key, label, lastChecked,
      status: "not_configured",
      detail: "AI_INTEGRATIONS_OPENAI_API_KEY not set — AI features disabled",
    };
  }

  const keyHint = `…${apiKey.slice(-6)}`;
  return {
    key, label, lastChecked,
    status: "operational",
    detail: `API key present (${keyHint}) · Endpoint: ${baseURL}`,
  };
}

function checkBackups(): SubsystemResult {
  return {
    key: "backups",
    label: "Backups",
    status: "not_configured",
    detail: "Automated backups are managed by the Replit hosting platform. No application-level backup timestamp is tracked.",
    lastChecked: new Date().toISOString(),
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerSystemHealthRoutes(
  app: Express,
  requireAuth: any,
  requireRole: any,
) {
  app.get(
    "/api/admin/system-health",
    requireAuth,
    requireRole(["Admin"]),
    async (_req: Request, res: Response) => {
      try {
        const [dbResult, emailResult, smsResult, storageResult] = await Promise.all([
          checkDatabase(),
          checkEmail(),
          checkSms(),
          checkStorage(),
        ]);

        const subsystems: SubsystemResult[] = [
          dbResult,
          emailResult,
          smsResult,
          storageResult,
          checkAI(),
          checkBackups(),
        ];

        return res.json({
          subsystems,
          recentErrors: [...recentErrors],
          slowRequests: [...slowRequests],
          generatedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        return res.status(500).json({ message: err?.message ?? "Error generating system health" });
      }
    },
  );
}

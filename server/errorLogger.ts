import { Request } from "express";
import { storage } from "./storage";
import type { InsertErrorLog, InsertActivityLogs } from "@shared/schema";

type ErrorSeverity = "info" | "warning" | "error" | "critical";
type FeatureType = "sops" | "materials" | "jobs" | "hiring" | "todos" | "equipment" | "forms" | "messages" | "users" | "settings" | "auth" | "calendar" | "plow_sites" | "ai_agents" | "help" | "updates" | "frontend" | "general";

interface ErrorLogOptions {
  errorCode?: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  endpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  requestBody?: Record<string, any>;
  feature?: FeatureType;
  severity?: ErrorSeverity;
  req?: Request;
}

interface ActivityLogOptions {
  action: string;
  feature: FeatureType;
  description?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  success?: boolean;
  req?: Request;
}

function sanitizeRequestBody(body: Record<string, any> | undefined): string | undefined {
  if (!body) return undefined;
  
  const sanitized = { ...body };
  const sensitiveFields = ["password", "newPassword", "currentPassword", "confirmPassword", "token", "accessToken", "refreshToken", "secret"];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }
  
  return JSON.stringify(sanitized);
}

function extractUserFromRequest(req: Request | undefined): { userId?: string; userRole?: string; ipAddress?: string; userAgent?: string } {
  if (!req) return {};
  
  const user = req.user as any;
  
  return {
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress || undefined,
    userAgent: req.get("User-Agent") || undefined,
  };
}

export async function logError(options: ErrorLogOptions): Promise<void> {
  try {
    const userInfo = extractUserFromRequest(options.req);
    
    const log: InsertErrorLog = {
      errorCode: options.errorCode,
      errorType: options.errorType,
      errorMessage: options.errorMessage,
      stackTrace: options.stackTrace,
      endpoint: options.endpoint || options.req?.originalUrl,
      httpMethod: options.httpMethod || options.req?.method,
      statusCode: options.statusCode,
      userId: userInfo.userId,
      userRole: userInfo.userRole,
      requestBody: sanitizeRequestBody(options.requestBody || (options.req?.body as Record<string, any>)),
      userAgent: userInfo.userAgent,
      ipAddress: userInfo.ipAddress,
      feature: options.feature,
      severity: options.severity || "error",
      isResolved: false,
    };
    
    await storage.createErrorLog(log);
  } catch (e) {
    console.error("Failed to log error:", e);
  }
}

export async function logActivity(options: ActivityLogOptions): Promise<void> {
  try {
    const userInfo = extractUserFromRequest(options.req);
    
    const log: InsertActivityLogs = {
      action: options.action,
      feature: options.feature,
      description: options.description,
      entityType: options.entityType,
      entityId: options.entityId,
      userId: userInfo.userId,
      userRole: userInfo.userRole,
      metadata: options.metadata ? JSON.stringify(options.metadata) : undefined,
      ipAddress: userInfo.ipAddress,
      userAgent: userInfo.userAgent,
      success: options.success !== false,
    };
    
    await storage.createActivityLog(log);
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

export async function logApiError(error: Error, req: Request, feature: FeatureType, statusCode = 500, errorCode?: string): Promise<void> {
  await logError({
    errorCode: errorCode || deriveErrorCode(feature, statusCode),
    errorType: "api_error",
    errorMessage: error.message,
    stackTrace: error.stack,
    statusCode,
    feature,
    severity: statusCode >= 500 ? "error" : "warning",
    req,
  });
}

export function deriveErrorCode(feature: FeatureType, statusCode?: number): string {
  if (statusCode === 401 || statusCode === 403) return "AUTH-003";
  if (statusCode === 400) return "SYS-003";

  const featureCodeMap: Record<string, string> = {
    sops: "SOP-001",
    materials: "MAT-001",
    jobs: "JOB-001",
    hiring: "HIRE-001",
    todos: "TODO-001",
    equipment: "EQP-001",
    forms: "FORM-001",
    messages: "MSG-001",
    users: "USR-001",
    auth: "AUTH-001",
    calendar: "CAL-001",
    plow_sites: "PLOW-001",
    ai_agents: "AI-001",
    general: "SYS-001",
    frontend: "SYS-001",
    settings: "SYS-001",
    help: "SYS-001",
    updates: "SYS-001",
  };
  return featureCodeMap[feature] || "SYS-001";
}

export function createErrorMiddleware() {
  return async (err: Error, req: Request, res: any, next: any) => {
    const feature = detectFeatureFromPath(req.path);
    const errorCode = deriveErrorCode(feature, 500);
    
    await logError({
      errorCode,
      errorType: "unhandled_error",
      errorMessage: err.message,
      stackTrace: err.stack,
      statusCode: 500,
      feature,
      severity: "critical",
      req,
    });
    
    res.status(500).json({
      message: "An unexpected error occurred",
      errorCode,
    });
  };
}

function detectFeatureFromPath(path: string): FeatureType {
  if (path.includes("/sops")) return "sops";
  if (path.includes("/materials")) return "materials";
  if (path.includes("/jobs")) return "jobs";
  if (path.includes("/hiring") || path.includes("/candidates")) return "hiring";
  if (path.includes("/todos")) return "todos";
  if (path.includes("/equipment") || path.includes("/maintenance")) return "equipment";
  if (path.includes("/forms")) return "forms";
  if (path.includes("/messages") || path.includes("/threads")) return "messages";
  if (path.includes("/users") || path.includes("/user")) return "users";
  if (path.includes("/settings") || path.includes("/company")) return "settings";
  if (path.includes("/auth") || path.includes("/login") || path.includes("/register")) return "auth";
  if (path.includes("/calendar")) return "calendar";
  if (path.includes("/plow")) return "plow_sites";
  if (path.includes("/ai-agent")) return "ai_agents";
  if (path.includes("/help") || path.includes("/articles")) return "help";
  if (path.includes("/updates")) return "updates";
  return "general";
}

import { pool } from "./db";

export type AuditEventType =
  | "login_success"
  | "login_failure"
  | "permission_change"
  | "settings_change";

export interface LogAuditEventParams {
  eventType: AuditEventType;
  actorUserId?: string | null;
  actorName?: string | null;
  targetUserId?: string | null;
  targetLabel?: string | null;
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (id, event_type, actor_user_id, actor_name, target_user_id, target_label, description, old_value, new_value, ip_address, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        params.eventType,
        params.actorUserId ?? null,
        params.actorName ?? null,
        params.targetUserId ?? null,
        params.targetLabel ?? null,
        params.description,
        params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null,
        params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
        params.ipAddress ?? null,
      ]
    );
  } catch (err) {
    console.error("[security_audit_log] Failed to record audit event:", err);
  }
}

export interface AuditLogFilters {
  eventType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function queryAuditLog(filters: AuditLogFilters) {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.eventType) {
    conditions.push(`event_type = $${idx++}`);
    values.push(filters.eventType);
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${idx++}::date + interval '1 day'`);
    values.push(filters.endDate);
  }
  if (filters.search) {
    conditions.push(`(description ILIKE $${idx} OR actor_name ILIKE $${idx} OR target_label ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 100, 500);
  const offset = filters.offset ?? 0;

  const { rows } = await pool.query(
    `SELECT al.*, u.name AS actor_user_name, tu.name AS target_user_name
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.actor_user_id
     LEFT JOIN users tu ON tu.id = al.target_user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM audit_log al ${whereClause}`,
    values
  );

  return { rows, total: countRows[0]?.count ?? 0 };
}

import { pool } from "./db";

export interface AuditEntry {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  fieldChanged?: string;
  oldValue?: string | null;
  newValue?: string | null;
  action?: "create" | "update" | "delete" | "approve" | "submit" | "status_change";
  changedById?: string | null;
  changedByName?: string | null;
  notes?: string;
}

export async function logChange(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO record_history
         (entity_type, entity_id, entity_label, field_changed, old_value, new_value,
          action, changed_by_id, changed_by_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.entityType,
        entry.entityId,
        entry.entityLabel ?? null,
        entry.fieldChanged ?? null,
        entry.oldValue ?? null,
        entry.newValue ?? null,
        entry.action ?? "update",
        entry.changedById ?? null,
        entry.changedByName ?? null,
        entry.notes ?? null,
      ]
    );
  } catch (err: any) {
    // Audit logging should never break the main flow
    console.error("[audit] failed to log change:", err.message);
  }
}

export async function logJobStatusChange(
  jobId: string, jobTitle: string,
  oldStatus: string, newStatus: string,
  userId: string, userName: string
): Promise<void> {
  return logChange({
    entityType: "job",
    entityId: jobId,
    entityLabel: jobTitle,
    fieldChanged: "status",
    oldValue: oldStatus,
    newValue: newStatus,
    action: "status_change",
    changedById: userId,
    changedByName: userName,
  });
}

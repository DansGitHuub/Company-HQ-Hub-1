import { pool } from "./db";

type PermissionMap = Map<string, Set<string>>;

let cache: PermissionMap = new Map();

export async function loadPermissionCache(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT role, permission FROM role_permissions WHERE granted = true`
  );
  const next: PermissionMap = new Map();
  for (const row of rows) {
    if (!next.has(row.role)) next.set(row.role, new Set());
    next.get(row.role)!.add(row.permission);
  }
  cache = next;
}

export async function reloadPermissionCache(): Promise<void> {
  return loadPermissionCache();
}

export function hasPermission(user: any, perm: string): boolean {
  if (!user) return false;
  if (user.isMasterAdmin) return true;
  if (user.role === "Customer") return false;
  return cache.get(user.role)?.has(perm) ?? false;
}

export function getAllRolePermissions(): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [role, perms] of cache.entries()) {
    out[role] = {};
    for (const perm of perms) {
      out[role][perm] = true;
    }
  }
  return out;
}

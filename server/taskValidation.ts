import type { User } from "@shared/schema";

const ROLE_HIERARCHY: Record<string, string[]> = {
  Admin: ["Admin", "Manager", "Crew Lead", "Crew", "New Hire", "HR"],
  Manager: ["Crew Lead", "Crew", "New Hire"],
  "Crew Lead": ["Crew"],
  Crew: [],
  "New Hire": [],
  HR: ["Admin", "Manager"],
  Sales: [],
  Customer: [],
};

export function canAssignTo(fromUser: User, toUser: User): boolean {
  if (fromUser.isMasterAdmin) return true;
  if (fromUser.role === "Sales" || fromUser.role === "Customer") return false;
  if (fromUser.id === toUser.id) return true;
  const allowed = ROLE_HIERARCHY[fromUser.role] || [];
  return allowed.includes(toUser.role);
}

export function canCreateTasks(user: User): boolean {
  if (user.isMasterAdmin) return true;
  return !["Sales", "Customer"].includes(user.role);
}

export function getAssignableRoles(user: User): string[] {
  if (user.isMasterAdmin) return ["Admin", "Manager", "Crew Lead", "Crew", "New Hire", "HR"];
  if (user.role === "Sales" || user.role === "Customer") return [];
  const allowed = ROLE_HIERARCHY[user.role] || [];
  return [user.role, ...allowed];
}

export function canTransitionStatus(from: string, to: string): boolean {
  const validTransitions: Record<string, string[]> = {
    todo: ["in_progress", "waiting", "complete", "cancelled"],
    in_progress: ["todo", "waiting", "complete", "cancelled"],
    waiting: ["todo", "in_progress", "complete", "cancelled"],
    complete: ["todo", "in_progress"],
    cancelled: ["todo"],
  };
  return validTransitions[from]?.includes(to) ?? false;
}

export function canUserTransition(user: User, task: any, newStatus: string): boolean {
  const isAssignee = user.id === task.assignedToUserId;
  const isCreator = user.id === task.createdByUserId;
  const isAdmin = user.role === "Admin" || user.isMasterAdmin;
  const isManager = user.role === "Manager";

  if (isAdmin || isManager) return true;
  if (isAssignee || isCreator) return true;
  return false;
}

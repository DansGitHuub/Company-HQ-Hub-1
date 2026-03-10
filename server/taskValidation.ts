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

export function canReassignTask(currentHolder: User, newAssignee: User): boolean {
  if (currentHolder.isMasterAdmin) return true;
  return canAssignTo(currentHolder, newAssignee);
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  assigned: ["acknowledged", "cancelled"],
  acknowledged: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "reassigned", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  reassigned: ["acknowledged", "cancelled"],
  completed: ["confirmed", "assigned"],
  confirmed: [],
  cancelled: [],
  overdue: ["acknowledged", "in_progress", "completed", "cancelled"],
};

export function canTransitionStatus(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function canUserTransition(user: User, task: any, newStatus: string): boolean {
  const isAssignee = user.id === task.assignedToUserId;
  const isCreator = user.id === task.createdByUserId;
  const isAdmin = user.role === "Admin" || user.isMasterAdmin;
  const isManager = user.role === "Manager";

  switch (newStatus) {
    case "acknowledged":
      return isAssignee;
    case "in_progress":
      return isAssignee;
    case "completed":
      return isAssignee;
    case "confirmed":
      return isCreator || isAdmin || isManager;
    case "assigned":
      return isCreator || isAdmin || isManager;
    case "on_hold":
      return isAssignee || isCreator || isAdmin;
    case "cancelled":
      return isCreator || isAdmin;
    case "reassigned":
      return isAssignee || isCreator || isAdmin || isManager;
    default:
      return false;
  }
}

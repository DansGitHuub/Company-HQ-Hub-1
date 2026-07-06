// Central role-visibility config for the Tools page (client/src/pages/Tools.tsx)
// and the underlying tool routes (see client/src/App.tsx). Keeping this in one
// place ensures the tool grid and the actual page routes never drift apart.
export const TOOL_ROLES: Record<string, string[]> = {
  "property-report-card": ["Admin"],
  "pdf-field-placer": ["Admin"],
  "calculator": ["Admin", "Manager", "Crew"],
  "plow-mapper": ["Admin"],
  "lead-qualifier": ["Admin"],
  "forms": ["Admin"],
};

export function canAccessTool(toolId: string, role: string | null | undefined, isMasterAdmin?: boolean): boolean {
  if (isMasterAdmin) return true;
  const roles = TOOL_ROLES[toolId];
  if (!roles) return true;
  return !!role && roles.includes(role);
}

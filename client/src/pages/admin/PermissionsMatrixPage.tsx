import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Lock, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const ALL_ROLES = ["Customer", "New Hire", "Crew", "Crew Lead", "HR", "Sales", "Manager", "Admin"] as const;
type Role = typeof ALL_ROLES[number];

const ALL_PERMS = [
  "see_finance",
  "see_people_hr",
  "see_hiring",
  "see_customers",
  "see_jobs_work",
  "see_time_reports",
  "manage_content",
  "manage_equipment",
  "approve_work",
  "manage_marketing",
  "manage_settings",
  "manage_spanish_content",
] as const;
type Perm = typeof ALL_PERMS[number];

type Matrix = Record<string, Record<string, boolean>>;

function isLocked(role: Role, perm: Perm): boolean {
  if (role === "Customer") return true;
  if (role === "Admin" && perm === "manage_settings") return true;
  return false;
}

function lockedValue(role: Role, perm: Perm): boolean {
  if (role === "Customer") return false;
  if (role === "Admin" && perm === "manage_settings") return true;
  return false;
}

export default function PermissionsMatrixPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: matrix, isLoading } = useQuery<Matrix>({
    queryKey: ["/api/role-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/role-permissions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load permissions");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (vars: { role: string; permission: string; granted: boolean }) => {
      const res = await apiRequest("PATCH", "/api/role-permissions", vars);
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: (_data, vars) => {
      queryClient.setQueryData<Matrix>(["/api/role-permissions"], (old) => {
        if (!old) return old;
        return {
          ...old,
          [vars.role]: { ...(old[vars.role] ?? {}), [vars.permission]: vars.granted },
        };
      });
      toast({ title: t("permissionsMatrix.saveSuccess") });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-permissions"] });
      toast({ title: t("permissionsMatrix.saveError"), variant: "destructive" });
    },
  });

  const getValue = (role: Role, perm: Perm): boolean => {
    if (isLocked(role, perm)) return lockedValue(role, perm);
    return matrix?.[role]?.[perm] ?? false;
  };

  const handleToggle = (role: Role, perm: Perm, newVal: boolean) => {
    if (isLocked(role, perm) || mutation.isPending) return;
    mutation.mutate({ role, permission: perm, granted: newVal });
  };

  return (
    <div className="p-6 lg:p-8 max-w-full">
      <div className="flex items-start gap-3 mb-6">
        <ShieldCheck className="h-7 w-7 text-primary mt-0.5 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("permissionsMatrix.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            {t("permissionsMatrix.pageSubtitle")}
          </p>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span>{t("permissionsMatrix.masterAdminNote")}</span>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="w-full text-sm border-collapse min-w-max">
            <thead>
              <tr className="bg-muted/70">
                <th className="sticky left-0 z-10 bg-muted/80 text-left px-4 py-3 font-semibold text-foreground min-w-[130px] border-b border-r border-border whitespace-nowrap">
                  Role
                </th>
                {ALL_PERMS.map((perm) => (
                  <th
                    key={perm}
                    className="text-center px-3 py-2 font-medium text-foreground border-b border-r border-border last:border-r-0 min-w-[100px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-semibold leading-tight text-center">
                        {t(`permissionsMatrix.permissions.${perm}`)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-normal leading-snug text-center hidden xl:block">
                        {t(`permissionsMatrix.permissionDesc.${perm}`)}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.map((role, ri) => (
                <tr
                  key={role}
                  className={`transition-colors ${ri % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}
                >
                  <td
                    className={`sticky left-0 z-10 px-4 py-3 font-semibold border-r border-b border-border min-w-[130px] whitespace-nowrap ${ri % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{t(`permissionsMatrix.roles.${role}`, role)}</span>
                      {role === "Customer" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
                        >
                          {t("permissionsMatrix.locked")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  {ALL_PERMS.map((perm) => {
                    const locked = isLocked(role, perm);
                    const value = getValue(role, perm);
                    return (
                      <td
                        key={perm}
                        className="text-center px-2 py-3 border-r border-b border-border last:border-r-0"
                      >
                        {locked ? (
                          <div className="flex flex-col items-center gap-0.5" title={t("permissionsMatrix.locked")}>
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                            <span className="text-[10px] text-muted-foreground/50 font-medium">
                              {value ? "✓" : "—"}
                            </span>
                          </div>
                        ) : (
                          <Switch
                            data-testid={`perm-${role.replace(/\s/g, "_")}-${perm}`}
                            checked={value}
                            onCheckedChange={(checked) => handleToggle(role, perm, checked)}
                            disabled={mutation.isPending}
                            className="scale-[0.8] origin-center"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
          <p className="font-semibold mb-0.5">{t("permissionsMatrix.customerNote")}</p>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-400">
          <p className="font-semibold mb-0.5">{t("permissionsMatrix.adminSettingsNote")}</p>
        </div>
      </div>
    </div>
  );
}

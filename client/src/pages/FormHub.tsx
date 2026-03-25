import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";

const FORM_LABELS: Record<string, string> = {
  w4: "W-4 (Federal Tax Withholding)",
  i9: "I-9 (Employment Eligibility Verification)",
  ohio_it4: "Ohio IT-4 (State Tax Withholding)",
  direct_deposit: "Direct Deposit Authorization",
  handbook_acknowledgment: "Employee Handbook Acknowledgment",
  emergency_contact: "Emergency Contact Form",
  background_check_auth: "Background Check Authorization",
  workers_comp_first_report: "Workers' Comp First Report of Injury",
  osha_incident: "OSHA Incident Report (Form 301)",
  nda: "Non-Disclosure Agreement",
  employment_application: "Employment Application",
};

const FORM_DESCRIPTIONS: Record<string, string> = {
  w4: "Federal tax withholding form. Complete all 5 steps to determine your withholding.",
  i9: "Verify your identity and employment eligibility. Section 1 must be completed by you.",
  ohio_it4: "Ohio state income tax withholding certificate.",
  direct_deposit: "Set up direct deposit for your paycheck.",
  handbook_acknowledgment: "Confirm you have read and understood the employee handbook.",
  emergency_contact: "Provide emergency contact information.",
  background_check_auth: "Authorize a background check as part of the hiring process.",
  workers_comp_first_report: "Report a workplace injury.",
  osha_incident: "OSHA injury and illness incident report.",
  nda: "Non-disclosure and confidentiality agreement.",
  employment_application: "Complete employment application.",
};

export default function FormHub() {
  const { t } = useTranslation();
  const params = useParams<{ formType?: string; submissionId?: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  if (params.formType && params.submissionId) {
    return <FormRenderer formType={params.formType} submissionId={params.submissionId} />;
  }

  if (params.formType) {
    return <FormRenderer formType={params.formType} />;
  }

  return <FormList />;
}

function FormList() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/onboarding-forms", user?.id],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const res = await apiRequest("GET", `/api/onboarding-forms?employeeId=${user.employeeId}`);
      return res.json();
    },
    enabled: !!user?.employeeId,
  });

  const pendingForms = assignments.filter((a: any) => ["draft", "pending_review"].includes(a.status));
  const completedForms = assignments.filter((a: any) => ["submitted", "approved"].includes(a.status));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="form-hub">
      <div>
        <h1 className="text-2xl font-bold">My Forms</h1>
        <p className="text-muted-foreground mt-1">View and complete forms assigned to you.</p>
      </div>

      {pendingForms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Badge variant="destructive">{pendingForms.length}</Badge>
            Action Required
          </h2>
          {pendingForms.map((form: any) => (
            <Card
              key={form.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/onboarding-forms/${form.formType}/${form.id}`)}
              data-testid={`pending-form-${form.id}`}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{FORM_LABELS[form.formType] || form.formType}</p>
                    <p className="text-xs text-muted-foreground">
                      Assigned {form.assignedAt ? new Date(form.assignedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <Badge variant={form.status === "draft" ? "outline" : "secondary"}>
                  {form.status === "draft" ? "Not Started" : form.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {completedForms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Completed Forms</h2>
          {completedForms.map((form: any) => (
            <Card key={form.id} className="opacity-75" data-testid={`completed-form-${form.id}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">{FORM_LABELS[form.formType] || form.formType}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {form.submittedAt ? new Date(form.submittedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {form.status === "approved" ? "Approved" : "Submitted"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingForms.length === 0 && completedForms.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">No forms have been assigned to you yet.</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All Forms</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(FORM_LABELS).map(([type, label]) => (
            <Card
              key={type}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/onboarding-forms/${type}/new`)}
              data-testid={`form-type-${type}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{FORM_DESCRIPTIONS[type]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormRenderer({ formType, submissionId }: { formType: string; submissionId?: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: submission, isLoading } = useQuery({
    queryKey: ["/api/onboarding-forms", submissionId],
    queryFn: async () => {
      if (!submissionId || submissionId === "new") return null;
      const res = await apiRequest("GET", `/api/onboarding-forms/${submissionId}`);
      return res.json();
    },
    enabled: !!submissionId && submissionId !== "new",
  });

  const [FormComponent, setFormComponent] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState(false);

  React.useEffect(() => {
    const loadForm = async () => {
      try {
        const formsModule = await import("@/components/forms/index");
        const Component = formsModule.FORM_REGISTRY[formType];
        if (Component) {
          setFormComponent(() => Component);
        } else {
          setLoadError(true);
        }
      } catch {
        setLoadError(true);
      }
    };
    loadForm();
  }, [formType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Button variant="ghost" onClick={() => navigate("/onboarding-forms")} className="mb-4" data-testid="button-back-to-forms">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Forms
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{FORM_LABELS[formType] || formType}</h1>
        <p className="text-muted-foreground mt-1">{FORM_DESCRIPTIONS[formType]}</p>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">This form is not available.</p>
            <p className="text-xs text-muted-foreground mt-1">Form type: {formType}</p>
          </CardContent>
        </Card>
      ) : FormComponent ? (
        <React.Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <FormComponent
            submissionId={submissionId !== "new" ? submissionId : undefined}
            employeeId={user?.employeeId || submission?.employeeId || ""}
            onComplete={() => navigate("/onboarding-forms")}
            readOnly={submission?.status === "approved"}
          />
        </React.Suspense>
      ) : (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}

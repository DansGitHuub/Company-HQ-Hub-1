import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import SignaturePad from "./SignaturePad";

const ACTION_OPTIONS = ["Verbal Warning", "Written Warning", "Final Warning", "Suspension", "Termination"];

const correctiveSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  dateOfIncident: z.string().min(1, "Date of incident is required"),
  descriptionOfIssue: z.string().min(10, "Please provide a detailed description"),
  previousWarnings: z.enum(["yes", "no"]),
  previousWarningsDescription: z.string().optional(),
  actionTaken: z.string().min(1, "Action taken is required"),
  employeeAcknowledgmentSignature: z.string().optional(),
  employeeAcknowledgmentDate: z.string().optional(),
  managerSignature: z.string().min(1, "Manager signature is required"),
  managerSignatureDate: z.string().min(1, "Manager signature date is required"),
}).refine(data => {
  if (data.previousWarnings === "yes") {
    return (data.previousWarningsDescription || "").trim().length > 0;
  }
  return true;
}, { message: "Please describe the previous warnings", path: ["previousWarningsDescription"] });

type CorrectiveActionValues = z.infer<typeof correctiveSchema>;

const ACTION_BADGE: Record<string, string> = {
  "Verbal Warning": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Written Warning": "bg-orange-50 text-orange-700 border-orange-200",
  "Final Warning": "bg-red-50 text-red-700 border-red-200",
  "Suspension": "bg-red-100 text-red-800 border-red-300",
  "Termination": "bg-red-200 text-red-900 border-red-400",
};

interface CorrectiveActionFormProps {
  preSelectedEmployeeId?: string;
  onComplete?: (action: any) => void;
  readOnly?: boolean;
  existingData?: any;
}

export default function CorrectiveActionForm({ preSelectedEmployeeId, onComplete, readOnly, existingData }: CorrectiveActionFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const role = user?.role;

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => (await apiRequest("GET", "/api/employees")).json(),
    enabled: !readOnly && !preSelectedEmployeeId,
  });

  const eligibleEmployees = employees.filter((e: any) => {
    if (role === "Manager") {
      return e.jobTitle !== "Admin" && e.jobTitle !== "Manager";
    }
    return true;
  });

  const form = useForm<CorrectiveActionValues>({
    resolver: zodResolver(correctiveSchema),
    defaultValues: {
      employeeId: preSelectedEmployeeId || "",
      dateOfIncident: "",
      descriptionOfIssue: "",
      previousWarnings: "no",
      previousWarningsDescription: "",
      actionTaken: "",
      employeeAcknowledgmentSignature: "",
      employeeAcknowledgmentDate: "",
      managerSignature: "",
      managerSignatureDate: new Date().toISOString().split("T")[0],
    },
  });

  const watchPreviousWarnings = form.watch("previousWarnings");

  const submitMutation = useMutation({
    mutationFn: async (values: CorrectiveActionValues) => {
      const res = await apiRequest("POST", "/api/corrective-actions", {
        ...values,
        previousWarnings: values.previousWarnings === "yes",
        previousWarningsDescription: values.previousWarnings === "yes" ? values.previousWarningsDescription : null,
        employeeAcknowledgmentSignature: values.employeeAcknowledgmentSignature || null,
        employeeAcknowledgmentDate: values.employeeAcknowledgmentDate || null,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Corrective action report submitted" });
      setSubmitted(true);
      onComplete?.(data);
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        <h3 className="font-semibold text-lg">Corrective Action Report Submitted</h3>
        <p className="text-sm text-muted-foreground">The report has been saved to the employee file and the Admin panel.</p>
      </div>
    );
  }

  if (readOnly && existingData) {
    return (
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={`${ACTION_BADGE[existingData.action_taken] || ""} border`}>{existingData.action_taken}</Badge>
          <Badge variant="outline" className={existingData.status === "Signed" ? "text-green-700 border-green-300 bg-green-50" : "text-amber-700 border-amber-300 bg-amber-50"}>
            {existingData.status || "Pending Signature"}
          </Badge>
          <span className="text-muted-foreground">Issued: {new Date(existingData.created_at).toLocaleDateString()}</span>
          <span className="text-muted-foreground">By: {existingData.issued_by_name || existingData.issued_by_username}</span>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Date of Incident</Label>
          <p className="font-medium">{existingData.date_of_incident}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Description of Issue</Label>
          <p className="mt-1 whitespace-pre-wrap">{existingData.description_of_issue}</p>
        </div>
        {existingData.previous_warnings && (
          <div>
            <Label className="text-xs text-muted-foreground">Previous Warnings</Label>
            <p className="mt-1">{existingData.previous_warnings_description || "Yes"}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Manager Signature</Label>
            {existingData.manager_signature && <img src={existingData.manager_signature} alt="Manager signature" className="h-12 mt-1 border rounded bg-white p-1" />}
            <p className="text-xs text-muted-foreground">{existingData.manager_signature_date}</p>
          </div>
          {existingData.employee_acknowledgment_signature && (
            <div>
              <Label className="text-xs text-muted-foreground">Employee Acknowledgment</Label>
              <img src={existingData.employee_acknowledgment_signature} alt="Employee signature" className="h-12 mt-1 border rounded bg-white p-1" />
              <p className="text-xs text-muted-foreground">{existingData.employee_acknowledgment_date}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))} className="space-y-5" data-testid="corrective-action-form">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          {role === "Manager"
            ? "You can issue corrective actions for Crew employees only."
            : "As an Admin, you can issue corrective actions for any employee."}
        </p>
      </div>

      {!preSelectedEmployeeId && (
        <div>
          <Label>Employee <span className="text-red-500">*</span></Label>
          <Controller
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="select-corrective-employee">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id} data-testid={`employee-option-${e.id}`}>
                      {e.firstName} {e.lastName}{e.jobTitle ? ` — ${e.jobTitle}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.employeeId && <p className="text-xs text-red-500 mt-1">{form.formState.errors.employeeId.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date of Incident <span className="text-red-500">*</span></Label>
          <Input type="date" {...form.register("dateOfIncident")} data-testid="input-date-of-incident" />
          {form.formState.errors.dateOfIncident && <p className="text-xs text-red-500 mt-1">{form.formState.errors.dateOfIncident.message}</p>}
        </div>
        <div>
          <Label>Action Taken <span className="text-red-500">*</span></Label>
          <Controller
            control={form.control}
            name="actionTaken"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="select-action-taken">
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt} data-testid={`action-${opt.toLowerCase().replace(/\s+/g, "-")}`}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.actionTaken && <p className="text-xs text-red-500 mt-1">{form.formState.errors.actionTaken.message}</p>}
        </div>
      </div>

      <div>
        <Label>Description of Issue <span className="text-red-500">*</span></Label>
        <Textarea rows={4} placeholder="Describe the incident, behavior, or policy violation in detail..." {...form.register("descriptionOfIssue")} data-testid="textarea-description" />
        {form.formState.errors.descriptionOfIssue && <p className="text-xs text-red-500 mt-1">{form.formState.errors.descriptionOfIssue.message}</p>}
      </div>

      <div>
        <Label>Previous Warnings? <span className="text-red-500">*</span></Label>
        <Controller
          control={form.control}
          name="previousWarnings"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6 mt-1.5">
              <div className="flex items-center gap-2"><RadioGroupItem value="no" id="pw-no" data-testid="radio-no-warnings" /><Label htmlFor="pw-no">No</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="pw-yes" data-testid="radio-yes-warnings" /><Label htmlFor="pw-yes">Yes</Label></div>
            </RadioGroup>
          )}
        />
        {watchPreviousWarnings === "yes" && (
          <Textarea
            className="mt-2"
            rows={2}
            placeholder="Describe the previous warnings..."
            {...form.register("previousWarningsDescription")}
            data-testid="textarea-prev-warnings"
          />
        )}
        {form.formState.errors.previousWarningsDescription && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.previousWarningsDescription.message}</p>
        )}
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 text-sm">Employee Acknowledgment <span className="text-muted-foreground font-normal">(optional — can be signed later)</span></h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Signature</Label>
            <SignaturePad
              value={form.watch("employeeAcknowledgmentSignature") || ""}
              onChange={(v) => form.setValue("employeeAcknowledgmentSignature", v)}
              testId="employee-ack-sig-pad"
            />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" {...form.register("employeeAcknowledgmentDate")} data-testid="input-employee-ack-date" />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3 text-sm">Manager / Issuing Authority Signature <span className="text-red-500">*</span></h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Signature</Label>
            <SignaturePad
              value={form.watch("managerSignature")}
              onChange={(v) => form.setValue("managerSignature", v, { shouldValidate: true })}
              testId="manager-sig-pad"
            />
            {form.formState.errors.managerSignature && <p className="text-xs text-red-500 mt-1">{form.formState.errors.managerSignature.message}</p>}
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" {...form.register("managerSignatureDate")} data-testid="input-manager-sig-date" />
            {form.formState.errors.managerSignatureDate && <p className="text-xs text-red-500 mt-1">{form.formState.errors.managerSignatureDate.message}</p>}
          </div>
        </div>
      </div>

      <Button type="submit" disabled={submitMutation.isPending} className="w-full" data-testid="button-submit-corrective-action">
        {submitMutation.isPending ? "Submitting..." : "Submit Corrective Action Report"}
      </Button>
    </form>
  );
}

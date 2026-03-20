import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import SignaturePad from "./SignaturePad";

const resignationSchema = z.object({
  lastDayOfWork: z.string().min(1, "Last day of work is required"),
  reasonForLeaving: z.string().optional(),
  additionalNotes: z.string().optional(),
  signatureDate: z.string().min(1, "Date is required"),
  signatureDataUrl: z.string().min(1, "Signature is required"),
});

type ResignationValues = z.infer<typeof resignationSchema>;

interface ResignationLetterFormProps {
  employeeId: string;
  employeeName: string;
  onComplete?: () => void;
  readOnly?: boolean;
  existingData?: any;
}

export default function ResignationLetterForm({ employeeId, employeeName, onComplete, readOnly, existingData }: ResignationLetterFormProps) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ResignationValues>({
    resolver: zodResolver(resignationSchema),
    defaultValues: {
      lastDayOfWork: existingData?.last_day_of_work || "",
      reasonForLeaving: existingData?.reason_for_leaving || "",
      additionalNotes: existingData?.additional_notes || "",
      signatureDate: existingData?.signature_date || new Date().toISOString().split("T")[0],
      signatureDataUrl: existingData?.signature_data_url || "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: ResignationValues) => {
      const res = await apiRequest("POST", "/api/resignation-letters", {
        employeeId,
        lastDayOfWork: values.lastDayOfWork,
        reasonForLeaving: values.reasonForLeaving || null,
        additionalNotes: values.additionalNotes || null,
        signatureDataUrl: values.signatureDataUrl,
        signatureDate: values.signatureDate,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resignation letter submitted", description: "Your manager has been notified." });
      setSubmitted(true);
      onComplete?.();
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        <h3 className="font-semibold text-lg">Resignation Letter Submitted</h3>
        <p className="text-sm text-muted-foreground">Your manager and HR have been notified.</p>
      </div>
    );
  }

  if (readOnly && existingData) {
    return (
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs text-muted-foreground">Employee</Label><p className="font-medium">{employeeName}</p></div>
          <div><Label className="text-xs text-muted-foreground">Last Day of Work</Label><p className="font-medium">{existingData.last_day_of_work}</p></div>
        </div>
        {existingData.reason_for_leaving && (
          <div><Label className="text-xs text-muted-foreground">Reason for Leaving</Label><p className="mt-1">{existingData.reason_for_leaving}</p></div>
        )}
        {existingData.additional_notes && (
          <div><Label className="text-xs text-muted-foreground">Additional Notes</Label><p className="mt-1">{existingData.additional_notes}</p></div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs text-muted-foreground">Signed Date</Label><p className="font-medium">{existingData.signature_date}</p></div>
          <div><Label className="text-xs text-muted-foreground">Submitted</Label><p className="font-medium">{new Date(existingData.submitted_at).toLocaleDateString()}</p></div>
        </div>
        {existingData.signature_data_url && (
          <div>
            <Label className="text-xs text-muted-foreground">Employee Signature</Label>
            <div className="mt-1 border rounded-lg bg-white p-2"><img src={existingData.signature_data_url} alt="Signature" className="h-16 object-contain" /></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))} className="space-y-5" data-testid="resignation-letter-form">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">Submitting this form will notify your manager and HR immediately.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Employee Name</Label>
          <Input value={employeeName} readOnly className="bg-muted cursor-default" data-testid="input-employee-name" />
        </div>
        <div>
          <Label>Last Day of Work <span className="text-red-500">*</span></Label>
          <Input type="date" {...form.register("lastDayOfWork")} data-testid="input-last-day" />
          {form.formState.errors.lastDayOfWork && <p className="text-xs text-red-500 mt-1">{form.formState.errors.lastDayOfWork.message}</p>}
        </div>
      </div>

      <div>
        <Label>Reason for Leaving <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea rows={3} placeholder="e.g., pursuing new opportunities, relocation..." {...form.register("reasonForLeaving")} data-testid="textarea-reason" />
      </div>

      <div>
        <Label>Additional Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea rows={3} placeholder="Transition plans, outstanding items..." {...form.register("additionalNotes")} data-testid="textarea-notes" />
      </div>

      <div>
        <Label>Employee Signature <span className="text-red-500">*</span></Label>
        <SignaturePad
          value={form.watch("signatureDataUrl")}
          onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })}
          testId="resignation-signature-pad"
        />
        {form.formState.errors.signatureDataUrl && <p className="text-xs text-red-500 mt-1">{form.formState.errors.signatureDataUrl.message}</p>}
      </div>

      <div>
        <Label>Date <span className="text-red-500">*</span></Label>
        <Input type="date" {...form.register("signatureDate")} data-testid="input-signature-date" />
      </div>

      <Button type="submit" disabled={submitMutation.isPending} className="w-full" data-testid="button-submit-resignation">
        {submitMutation.isPending ? "Submitting..." : "Submit Resignation Letter"}
      </Button>
    </form>
  );
}

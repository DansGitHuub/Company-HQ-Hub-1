import React, { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const froiSchema = z.object({
  employeeFirstName: z.string().min(1, "Required"),
  employeeLastName: z.string().min(1, "Required"),
  employeeSSN: z.string().min(1, "Required"),
  employeeDOB: z.string().min(1, "Required"),
  employeeAddress: z.string().min(1, "Required"),
  employeeCity: z.string().min(1, "Required"),
  employeeState: z.string().min(1, "Required"),
  employeeZip: z.string().min(1, "Required"),
  employeePhone: z.string().optional(),
  employeeGender: z.string().optional(),
  employeeJobTitle: z.string().min(1, "Required"),
  dateOfInjury: z.string().min(1, "Required"),
  timeOfInjury: z.string().optional(),
  injuryLocation: z.string().min(1, "Required"),
  bodyPartInjured: z.string().min(1, "Required"),
  natureOfInjury: z.string().min(1, "Required"),
  causeOfInjury: z.string().min(1, "Required"),
  injuryDescription: z.string().min(1, "Required"),
  wasPerformingRegularDuties: z.string().optional(),
  dateReportedToEmployer: z.string().optional(),
  treatedInER: z.string().optional(),
  hospitalName: z.string().optional(),
  doctorName: z.string().optional(),
  lostTimeDays: z.string().optional(),
  returnToWorkDate: z.string().optional(),
  employerName: z.string().optional(),
  employerPolicyNumber: z.string().optional(),
  employerAddress: z.string().optional(),
  employerPhone: z.string().optional(),
  supervisorName: z.string().optional(),
  supervisorTitle: z.string().optional(),
  supervisorPhone: z.string().optional(),
  supervisorStatement: z.string().optional(),
  witnessName: z.string().optional(),
  witnessPhone: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
  supervisorSignatureDataUrl: z.string().optional(),
  supervisorSignDate: z.string().optional(),
});

type FROIFormValues = z.infer<typeof froiSchema>;

interface WorkersCompFROIFormProps {
  submissionId?: string;
  employeeId: string;
  onComplete?: () => void;
  readOnly?: boolean;
}

function SignaturePad({ value, onChange, testId }: { value: string; onChange: (dataUrl: string) => void; testId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  useEffect(() => {
    const syncSize = () => {
      const canvas = canvasRef.current; const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1; const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = 120 * dpr;
      canvas.style.width = `${rect.width}px`; canvas.style.height = "120px";
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.scale(dpr, dpr); ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
    };
    syncSize(); window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, []);

  useEffect(() => {
    if (value && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) { const img = new window.Image(); img.onload = () => { ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height); ctx.drawImage(img,0,0,canvasRef.current!.width,canvasRef.current!.height); ctx.restore(); setHasDrawn(true); }; img.src = value; }
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => { const canvas = canvasRef.current; if (!canvas) return {x:0,y:0}; const rect = canvas.getBoundingClientRect(); if ("touches" in e) return {x:e.touches[0].clientX-rect.left,y:e.touches[0].clientY-rect.top}; return {x:e.clientX-rect.left,y:e.clientY-rect.top}; };
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x,pos.y); ctx.lineTo(pos.x,pos.y); ctx.stroke(); setIsDrawing(true); setHasDrawn(true); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!isDrawing) return; e.preventDefault(); const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return; const pos = getPos(e); ctx.lineTo(pos.x,pos.y); ctx.stroke(); };
  const stopDrawing = useCallback(() => { if (isDrawing && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png")); setIsDrawing(false); }, [isDrawing, onChange]);
  useEffect(() => { window.addEventListener("mouseup", stopDrawing); window.addEventListener("touchend", stopDrawing); return () => { window.removeEventListener("mouseup", stopDrawing); window.removeEventListener("touchend", stopDrawing); }; }, [stopDrawing]);
  const clearSignature = () => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore(); setHasDrawn(false); onChange(""); };

  return (
    <div data-testid={testId}>
      <div ref={containerRef} className="rounded-lg border-2 border-muted-foreground/20 bg-white relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} data-testid={`${testId}-canvas`} />
        <div className="absolute bottom-2 left-3 right-3 border-t border-muted-foreground/20" />
        <div className="absolute bottom-1 left-3 text-[10px] text-muted-foreground/40">Sign above the line</div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-muted-foreground">{hasDrawn ? "Signature captured" : "Draw your signature above"}</span>
        {hasDrawn && <button type="button" onClick={clearSignature} className="text-xs text-red-500 hover:text-red-700" data-testid={`${testId}-clear`}>Clear</button>}
      </div>
    </div>
  );
}

export default function WorkersCompFROIForm({ submissionId, employeeId, onComplete, readOnly }: WorkersCompFROIFormProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<1|2>(1);
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<FROIFormValues>({
    resolver: zodResolver(froiSchema),
    defaultValues: {
      employeeFirstName: "", employeeLastName: "", employeeSSN: "", employeeDOB: "",
      employeeAddress: "", employeeCity: "", employeeState: "OH", employeeZip: "",
      employeePhone: "", employeeGender: "", employeeJobTitle: "",
      dateOfInjury: "", timeOfInjury: "", injuryLocation: "", bodyPartInjured: "",
      natureOfInjury: "", causeOfInjury: "", injuryDescription: "",
      wasPerformingRegularDuties: "", dateReportedToEmployer: "",
      treatedInER: "", hospitalName: "", doctorName: "",
      lostTimeDays: "", returnToWorkDate: "",
      employerName: "", employerPolicyNumber: "", employerAddress: "", employerPhone: "",
      supervisorName: "", supervisorTitle: "", supervisorPhone: "", supervisorStatement: "",
      witnessName: "", witnessPhone: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
      supervisorSignatureDataUrl: "", supervisorSignDate: "",
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: FROIFormValues) => {
      const body = { formType: "workers_comp_first_report", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "FROI Submitted", description: "First Report of Injury has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit FROI.", variant: "destructive" }); },
  });

  const onSubmit = (values: FROIFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="froi-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ohio BWC — First Report of Injury (FROI)</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="froi-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Button type="button" variant={activeSection === 1 ? "default" : "outline"} onClick={() => setActiveSection(1)} data-testid="froi-section-1-btn">Section 1 (Employee)</Button>
            <Button type="button" variant={activeSection === 2 ? "default" : "outline"} onClick={() => setActiveSection(2)} data-testid="froi-section-2-btn">Section 2 (Supervisor)</Button>
          </div>

          {activeSection === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Section 1: Employee Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className={errors.employeeFirstName ? "text-red-500" : ""}>First Name *</Label><Input {...form.register("employeeFirstName")} disabled={readOnly} data-testid="froi-first-name" className={errors.employeeFirstName ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeLastName ? "text-red-500" : ""}>Last Name *</Label><Input {...form.register("employeeLastName")} disabled={readOnly} data-testid="froi-last-name" className={errors.employeeLastName ? "border-red-500" : ""} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.employeeSSN ? "text-red-500" : ""}>SSN *</Label><Input {...form.register("employeeSSN")} disabled={readOnly} data-testid="froi-ssn" className={errors.employeeSSN ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeDOB ? "text-red-500" : ""}>Date of Birth *</Label><Input {...form.register("employeeDOB")} type="date" disabled={readOnly} data-testid="froi-dob" className={errors.employeeDOB ? "border-red-500" : ""} /></div>
                <div><Label>Gender</Label><Input {...form.register("employeeGender")} disabled={readOnly} data-testid="froi-gender" /></div>
              </div>
              <div><Label className={errors.employeeAddress ? "text-red-500" : ""}>Address *</Label><Input {...form.register("employeeAddress")} disabled={readOnly} data-testid="froi-address" className={errors.employeeAddress ? "border-red-500" : ""} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.employeeCity ? "text-red-500" : ""}>City *</Label><Input {...form.register("employeeCity")} disabled={readOnly} data-testid="froi-city" className={errors.employeeCity ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeState ? "text-red-500" : ""}>State *</Label><Input {...form.register("employeeState")} disabled={readOnly} data-testid="froi-state" className={errors.employeeState ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeZip ? "text-red-500" : ""}>ZIP *</Label><Input {...form.register("employeeZip")} disabled={readOnly} data-testid="froi-zip" className={errors.employeeZip ? "border-red-500" : ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input {...form.register("employeePhone")} disabled={readOnly} data-testid="froi-phone" /></div>
                <div><Label className={errors.employeeJobTitle ? "text-red-500" : ""}>Job Title *</Label><Input {...form.register("employeeJobTitle")} disabled={readOnly} data-testid="froi-job-title" className={errors.employeeJobTitle ? "border-red-500" : ""} /></div>
              </div>

              <h4 className="font-semibold mt-4">Injury Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className={errors.dateOfInjury ? "text-red-500" : ""}>Date of Injury *</Label><Input {...form.register("dateOfInjury")} type="date" disabled={readOnly} data-testid="froi-injury-date" className={errors.dateOfInjury ? "border-red-500" : ""} /></div>
                <div><Label>Time of Injury</Label><Input {...form.register("timeOfInjury")} type="time" disabled={readOnly} data-testid="froi-injury-time" /></div>
              </div>
              <div><Label className={errors.injuryLocation ? "text-red-500" : ""}>Location Where Injury Occurred *</Label><Input {...form.register("injuryLocation")} disabled={readOnly} data-testid="froi-injury-location" className={errors.injuryLocation ? "border-red-500" : ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className={errors.bodyPartInjured ? "text-red-500" : ""}>Body Part Injured *</Label><Input {...form.register("bodyPartInjured")} disabled={readOnly} data-testid="froi-body-part" className={errors.bodyPartInjured ? "border-red-500" : ""} /></div>
                <div><Label className={errors.natureOfInjury ? "text-red-500" : ""}>Nature of Injury *</Label><Input {...form.register("natureOfInjury")} disabled={readOnly} data-testid="froi-nature" className={errors.natureOfInjury ? "border-red-500" : ""} /></div>
              </div>
              <div><Label className={errors.causeOfInjury ? "text-red-500" : ""}>Cause of Injury *</Label><Input {...form.register("causeOfInjury")} disabled={readOnly} data-testid="froi-cause" className={errors.causeOfInjury ? "border-red-500" : ""} /></div>
              <div><Label className={errors.injuryDescription ? "text-red-500" : ""}>Description of Injury/Incident *</Label><Textarea {...form.register("injuryDescription")} disabled={readOnly} data-testid="froi-description" rows={3} className={errors.injuryDescription ? "border-red-500" : ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Was Performing Regular Duties?</Label><Input {...form.register("wasPerformingRegularDuties")} disabled={readOnly} data-testid="froi-regular-duties" placeholder="Yes/No" /></div>
                <div><Label>Date Reported to Employer</Label><Input {...form.register("dateReportedToEmployer")} type="date" disabled={readOnly} data-testid="froi-reported-date" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Treated in ER?</Label><Input {...form.register("treatedInER")} disabled={readOnly} data-testid="froi-er" placeholder="Yes/No" /></div>
                <div><Label>Hospital/Clinic Name</Label><Input {...form.register("hospitalName")} disabled={readOnly} data-testid="froi-hospital" /></div>
              </div>
              <div><Label>Doctor Name</Label><Input {...form.register("doctorName")} disabled={readOnly} data-testid="froi-doctor" /></div>

              <div>
                <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Employee Signature *</Label>
                {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="froi-employee-signature" />}
                {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
              </div>
              <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="froi-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
            </div>
          )}

          {activeSection === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Section 2: Supervisor/Employer Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Employer Name</Label><Input {...form.register("employerName")} disabled={readOnly} data-testid="froi-employer-name" /></div>
                <div><Label>BWC Policy Number</Label><Input {...form.register("employerPolicyNumber")} disabled={readOnly} data-testid="froi-policy-number" /></div>
              </div>
              <div><Label>Employer Address</Label><Input {...form.register("employerAddress")} disabled={readOnly} data-testid="froi-employer-address" /></div>
              <div><Label>Employer Phone</Label><Input {...form.register("employerPhone")} disabled={readOnly} data-testid="froi-employer-phone" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Supervisor Name</Label><Input {...form.register("supervisorName")} disabled={readOnly} data-testid="froi-supervisor-name" /></div>
                <div><Label>Supervisor Title</Label><Input {...form.register("supervisorTitle")} disabled={readOnly} data-testid="froi-supervisor-title" /></div>
                <div><Label>Supervisor Phone</Label><Input {...form.register("supervisorPhone")} disabled={readOnly} data-testid="froi-supervisor-phone" /></div>
              </div>
              <div><Label>Supervisor Statement</Label><Textarea {...form.register("supervisorStatement")} disabled={readOnly} data-testid="froi-supervisor-statement" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Lost Time Days</Label><Input {...form.register("lostTimeDays")} disabled={readOnly} data-testid="froi-lost-time" /></div>
                <div><Label>Return to Work Date</Label><Input {...form.register("returnToWorkDate")} type="date" disabled={readOnly} data-testid="froi-rtw-date" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Witness Name</Label><Input {...form.register("witnessName")} disabled={readOnly} data-testid="froi-witness-name" /></div>
                <div><Label>Witness Phone</Label><Input {...form.register("witnessPhone")} disabled={readOnly} data-testid="froi-witness-phone" /></div>
              </div>
              <div>
                <Label>Supervisor Signature</Label>
                {!readOnly && <SignaturePad value={form.watch("supervisorSignatureDataUrl") || ""} onChange={(v) => form.setValue("supervisorSignatureDataUrl", v)} testId="froi-supervisor-signature" />}
                {readOnly && form.watch("supervisorSignatureDataUrl") && <img src={form.watch("supervisorSignatureDataUrl")} alt="Supervisor Signature" className="border rounded h-[120px]" />}
              </div>
              <div><Label>Supervisor Sign Date</Label><Input {...form.register("supervisorSignDate")} type="date" disabled={readOnly} data-testid="froi-supervisor-sign-date" /></div>
            </div>
          )}

          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="froi-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit FROI"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

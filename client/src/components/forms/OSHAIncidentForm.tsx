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

const oshaSchema = z.object({
  establishmentName: z.string().min(1, "Required"),
  establishmentAddress: z.string().min(1, "Required"),
  establishmentCity: z.string().min(1, "Required"),
  establishmentState: z.string().min(1, "Required"),
  establishmentZip: z.string().min(1, "Required"),
  caseNumber: z.string().optional(),
  employeeFirstName: z.string().min(1, "Required"),
  employeeLastName: z.string().min(1, "Required"),
  employeeAddress: z.string().min(1, "Required"),
  employeeCity: z.string().min(1, "Required"),
  employeeState: z.string().min(1, "Required"),
  employeeZip: z.string().min(1, "Required"),
  employeeDOB: z.string().min(1, "Required"),
  employeeGender: z.string().optional(),
  employeeHireDate: z.string().optional(),
  dateOfInjury: z.string().min(1, "Required"),
  timeOfEvent: z.string().optional(),
  timeEmployeeBeganWork: z.string().optional(),
  eventLocation: z.string().min(1, "Required"),
  whatWasEmployeeDoing: z.string().min(1, "Required"),
  whatHappened: z.string().min(1, "Required"),
  whatObjectOrSubstance: z.string().min(1, "Required"),
  injuryOrIllness: z.enum(["injury", "skin_disorder", "respiratory", "poisoning", "hearing_loss", "other_illness"], { required_error: "Required" }),
  bodyPartAffected: z.string().min(1, "Required"),
  employeeTreatedInER: z.string().optional(),
  employeeHospitalizedOvernight: z.string().optional(),
  dateOfDeath: z.string().optional(),
  treatingPhysician: z.string().optional(),
  treatingFacility: z.string().optional(),
  treatingFacilityAddress: z.string().optional(),
  completedByName: z.string().min(1, "Required"),
  completedByTitle: z.string().min(1, "Required"),
  completedByPhone: z.string().optional(),
  completedDate: z.string().min(1, "Required"),
  supervisorName: z.string().optional(),
  supervisorStatement: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
  supervisorSignatureDataUrl: z.string().optional(),
  supervisorSignDate: z.string().optional(),
});

type OSHAFormValues = z.infer<typeof oshaSchema>;

interface OSHAIncidentFormProps {
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

export default function OSHAIncidentForm({ submissionId, employeeId, onComplete, readOnly }: OSHAIncidentFormProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"employee"|"supervisor">("employee");
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<OSHAFormValues>({
    resolver: zodResolver(oshaSchema),
    defaultValues: {
      establishmentName: "", establishmentAddress: "", establishmentCity: "", establishmentState: "", establishmentZip: "",
      caseNumber: "", employeeFirstName: "", employeeLastName: "", employeeAddress: "", employeeCity: "",
      employeeState: "", employeeZip: "", employeeDOB: "", employeeGender: "", employeeHireDate: "",
      dateOfInjury: "", timeOfEvent: "", timeEmployeeBeganWork: "", eventLocation: "",
      whatWasEmployeeDoing: "", whatHappened: "", whatObjectOrSubstance: "",
      injuryOrIllness: undefined, bodyPartAffected: "",
      employeeTreatedInER: "", employeeHospitalizedOvernight: "", dateOfDeath: "",
      treatingPhysician: "", treatingFacility: "", treatingFacilityAddress: "",
      completedByName: "", completedByTitle: "", completedByPhone: "", completedDate: new Date().toISOString().split("T")[0],
      supervisorName: "", supervisorStatement: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
      supervisorSignatureDataUrl: "", supervisorSignDate: "",
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: OSHAFormValues) => {
      const body = { formType: "osha_incident", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "OSHA 301 Submitted", description: "OSHA Incident Report has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit OSHA incident report.", variant: "destructive" }); },
  });

  const onSubmit = (values: OSHAFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="osha-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>OSHA Form 301 — Injury and Illness Incident Report</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="osha-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Button type="button" variant={activeSection === "employee" ? "default" : "outline"} onClick={() => setActiveSection("employee")} data-testid="osha-employee-section-btn">Employee Section</Button>
            <Button type="button" variant={activeSection === "supervisor" ? "default" : "outline"} onClick={() => setActiveSection("supervisor")} data-testid="osha-supervisor-section-btn">Supervisor Section</Button>
          </div>

          {activeSection === "employee" && (
            <div className="space-y-4">
              <h3 className="font-semibold">Establishment Information</h3>
              <div><Label className={errors.establishmentName ? "text-red-500" : ""}>Establishment Name *</Label><Input {...form.register("establishmentName")} disabled={readOnly} data-testid="osha-est-name" className={errors.establishmentName ? "border-red-500" : ""} /></div>
              <div><Label className={errors.establishmentAddress ? "text-red-500" : ""}>Address *</Label><Input {...form.register("establishmentAddress")} disabled={readOnly} data-testid="osha-est-address" className={errors.establishmentAddress ? "border-red-500" : ""} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.establishmentCity ? "text-red-500" : ""}>City *</Label><Input {...form.register("establishmentCity")} disabled={readOnly} data-testid="osha-est-city" className={errors.establishmentCity ? "border-red-500" : ""} /></div>
                <div><Label className={errors.establishmentState ? "text-red-500" : ""}>State *</Label><Input {...form.register("establishmentState")} disabled={readOnly} data-testid="osha-est-state" className={errors.establishmentState ? "border-red-500" : ""} /></div>
                <div><Label className={errors.establishmentZip ? "text-red-500" : ""}>ZIP *</Label><Input {...form.register("establishmentZip")} disabled={readOnly} data-testid="osha-est-zip" className={errors.establishmentZip ? "border-red-500" : ""} /></div>
              </div>
              <div><Label>Case Number</Label><Input {...form.register("caseNumber")} disabled={readOnly} data-testid="osha-case-number" /></div>

              <h3 className="font-semibold mt-4">Employee Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className={errors.employeeFirstName ? "text-red-500" : ""}>First Name *</Label><Input {...form.register("employeeFirstName")} disabled={readOnly} data-testid="osha-emp-first" className={errors.employeeFirstName ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeLastName ? "text-red-500" : ""}>Last Name *</Label><Input {...form.register("employeeLastName")} disabled={readOnly} data-testid="osha-emp-last" className={errors.employeeLastName ? "border-red-500" : ""} /></div>
              </div>
              <div><Label className={errors.employeeAddress ? "text-red-500" : ""}>Address *</Label><Input {...form.register("employeeAddress")} disabled={readOnly} data-testid="osha-emp-address" className={errors.employeeAddress ? "border-red-500" : ""} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.employeeCity ? "text-red-500" : ""}>City *</Label><Input {...form.register("employeeCity")} disabled={readOnly} data-testid="osha-emp-city" className={errors.employeeCity ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeState ? "text-red-500" : ""}>State *</Label><Input {...form.register("employeeState")} disabled={readOnly} data-testid="osha-emp-state" className={errors.employeeState ? "border-red-500" : ""} /></div>
                <div><Label className={errors.employeeZip ? "text-red-500" : ""}>ZIP *</Label><Input {...form.register("employeeZip")} disabled={readOnly} data-testid="osha-emp-zip" className={errors.employeeZip ? "border-red-500" : ""} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.employeeDOB ? "text-red-500" : ""}>Date of Birth *</Label><Input {...form.register("employeeDOB")} type="date" disabled={readOnly} data-testid="osha-emp-dob" className={errors.employeeDOB ? "border-red-500" : ""} /></div>
                <div><Label>Gender</Label><Input {...form.register("employeeGender")} disabled={readOnly} data-testid="osha-emp-gender" /></div>
                <div><Label>Hire Date</Label><Input {...form.register("employeeHireDate")} type="date" disabled={readOnly} data-testid="osha-emp-hire" /></div>
              </div>

              <h3 className="font-semibold mt-4">Incident Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.dateOfInjury ? "text-red-500" : ""}>Date of Injury/Illness *</Label><Input {...form.register("dateOfInjury")} type="date" disabled={readOnly} data-testid="osha-injury-date" className={errors.dateOfInjury ? "border-red-500" : ""} /></div>
                <div><Label>Time of Event</Label><Input {...form.register("timeOfEvent")} type="time" disabled={readOnly} data-testid="osha-event-time" /></div>
                <div><Label>Time Employee Began Work</Label><Input {...form.register("timeEmployeeBeganWork")} type="time" disabled={readOnly} data-testid="osha-work-start" /></div>
              </div>
              <div><Label className={errors.eventLocation ? "text-red-500" : ""}>Where Did the Event Occur? *</Label><Input {...form.register("eventLocation")} disabled={readOnly} data-testid="osha-event-location" className={errors.eventLocation ? "border-red-500" : ""} /></div>
              <div><Label className={errors.whatWasEmployeeDoing ? "text-red-500" : ""}>What Was the Employee Doing Just Before the Incident? *</Label><Textarea {...form.register("whatWasEmployeeDoing")} disabled={readOnly} data-testid="osha-doing-before" rows={3} className={errors.whatWasEmployeeDoing ? "border-red-500" : ""} /></div>
              <div><Label className={errors.whatHappened ? "text-red-500" : ""}>What Happened? How Was the Injury/Illness Caused? *</Label><Textarea {...form.register("whatHappened")} disabled={readOnly} data-testid="osha-what-happened" rows={3} className={errors.whatHappened ? "border-red-500" : ""} /></div>
              <div><Label className={errors.whatObjectOrSubstance ? "text-red-500" : ""}>What Object or Substance Directly Harmed the Employee? *</Label><Textarea {...form.register("whatObjectOrSubstance")} disabled={readOnly} data-testid="osha-object" rows={2} className={errors.whatObjectOrSubstance ? "border-red-500" : ""} /></div>

              <div>
                <Label className={errors.injuryOrIllness ? "text-red-500" : ""}>Type of Injury/Illness *</Label>
                <RadioGroup value={form.watch("injuryOrIllness")} onValueChange={(v) => form.setValue("injuryOrIllness", v as any, { shouldValidate: true })} disabled={readOnly} data-testid="osha-injury-type">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="injury" id="osha-injury" data-testid="osha-type-injury" /><Label htmlFor="osha-injury">Injury</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="skin_disorder" id="osha-skin" data-testid="osha-type-skin" /><Label htmlFor="osha-skin">Skin Disorder</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="respiratory" id="osha-resp" data-testid="osha-type-respiratory" /><Label htmlFor="osha-resp">Respiratory Condition</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="poisoning" id="osha-poison" data-testid="osha-type-poisoning" /><Label htmlFor="osha-poison">Poisoning</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="hearing_loss" id="osha-hearing" data-testid="osha-type-hearing" /><Label htmlFor="osha-hearing">Hearing Loss</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="other_illness" id="osha-other" data-testid="osha-type-other" /><Label htmlFor="osha-other">All Other Illnesses</Label></div>
                </RadioGroup>
              </div>
              <div><Label className={errors.bodyPartAffected ? "text-red-500" : ""}>Body Part(s) Affected *</Label><Input {...form.register("bodyPartAffected")} disabled={readOnly} data-testid="osha-body-part" className={errors.bodyPartAffected ? "border-red-500" : ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Treated in ER?</Label><Input {...form.register("employeeTreatedInER")} disabled={readOnly} data-testid="osha-er" placeholder="Yes/No" /></div>
                <div><Label>Hospitalized Overnight?</Label><Input {...form.register("employeeHospitalizedOvernight")} disabled={readOnly} data-testid="osha-hospitalized" placeholder="Yes/No" /></div>
              </div>
              <div><Label>Date of Death (if applicable)</Label><Input {...form.register("dateOfDeath")} type="date" disabled={readOnly} data-testid="osha-death-date" /></div>

              <h3 className="font-semibold mt-4">Medical Treatment</h3>
              <div><Label>Treating Physician Name</Label><Input {...form.register("treatingPhysician")} disabled={readOnly} data-testid="osha-physician" /></div>
              <div><Label>Treating Facility</Label><Input {...form.register("treatingFacility")} disabled={readOnly} data-testid="osha-facility" /></div>
              <div><Label>Facility Address</Label><Input {...form.register("treatingFacilityAddress")} disabled={readOnly} data-testid="osha-facility-address" /></div>

              <h3 className="font-semibold mt-4">Completed By</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.completedByName ? "text-red-500" : ""}>Name *</Label><Input {...form.register("completedByName")} disabled={readOnly} data-testid="osha-completed-name" className={errors.completedByName ? "border-red-500" : ""} /></div>
                <div><Label className={errors.completedByTitle ? "text-red-500" : ""}>Title *</Label><Input {...form.register("completedByTitle")} disabled={readOnly} data-testid="osha-completed-title" className={errors.completedByTitle ? "border-red-500" : ""} /></div>
                <div><Label>Phone</Label><Input {...form.register("completedByPhone")} disabled={readOnly} data-testid="osha-completed-phone" /></div>
              </div>
              <div><Label className={errors.completedDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("completedDate")} type="date" disabled={readOnly} data-testid="osha-completed-date" className={errors.completedDate ? "border-red-500" : ""} /></div>

              <div>
                <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
                {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="osha-signature" />}
                {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
              </div>
              <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="osha-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
            </div>
          )}

          {activeSection === "supervisor" && (
            <div className="space-y-4">
              <h3 className="font-semibold">Supervisor Section</h3>
              <div><Label>Supervisor Name</Label><Input {...form.register("supervisorName")} disabled={readOnly} data-testid="osha-supervisor-name" /></div>
              <div><Label>Supervisor Statement / Additional Notes</Label><Textarea {...form.register("supervisorStatement")} disabled={readOnly} data-testid="osha-supervisor-statement" rows={4} /></div>
              <div>
                <Label>Supervisor Signature</Label>
                {!readOnly && <SignaturePad value={form.watch("supervisorSignatureDataUrl") || ""} onChange={(v) => form.setValue("supervisorSignatureDataUrl", v)} testId="osha-supervisor-signature" />}
                {readOnly && form.watch("supervisorSignatureDataUrl") && <img src={form.watch("supervisorSignatureDataUrl")} alt="Supervisor Signature" className="border rounded h-[120px]" />}
              </div>
              <div><Label>Supervisor Sign Date</Label><Input {...form.register("supervisorSignDate")} type="date" disabled={readOnly} data-testid="osha-supervisor-sign-date" /></div>
            </div>
          )}

          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="osha-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit OSHA 301 Report"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

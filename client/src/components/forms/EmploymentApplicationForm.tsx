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
import { Checkbox } from "@/components/ui/checkbox";

const appSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  middleName: z.string().optional(),
  address: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().min(1, "Required"),
  positionAppliedFor: z.string().min(1, "Required"),
  desiredPayRate: z.string().optional(),
  startDate: z.string().optional(),
  isUSCitizen: z.string().optional(),
  hasBeenConvicted: z.string().optional(),
  convictionDetails: z.string().optional(),
  hasDriversLicense: z.string().optional(),
  driversLicenseNumber: z.string().optional(),
  employer1Name: z.string().optional(),
  employer1Address: z.string().optional(),
  employer1Phone: z.string().optional(),
  employer1Supervisor: z.string().optional(),
  employer1Title: z.string().optional(),
  employer1StartDate: z.string().optional(),
  employer1EndDate: z.string().optional(),
  employer1ReasonForLeaving: z.string().optional(),
  employer1Duties: z.string().optional(),
  employer2Name: z.string().optional(),
  employer2Address: z.string().optional(),
  employer2Phone: z.string().optional(),
  employer2Supervisor: z.string().optional(),
  employer2Title: z.string().optional(),
  employer2StartDate: z.string().optional(),
  employer2EndDate: z.string().optional(),
  employer2ReasonForLeaving: z.string().optional(),
  employer2Duties: z.string().optional(),
  employer3Name: z.string().optional(),
  employer3Address: z.string().optional(),
  employer3Phone: z.string().optional(),
  employer3Supervisor: z.string().optional(),
  employer3Title: z.string().optional(),
  employer3StartDate: z.string().optional(),
  employer3EndDate: z.string().optional(),
  employer3ReasonForLeaving: z.string().optional(),
  employer3Duties: z.string().optional(),
  highSchool: z.string().optional(),
  highSchoolGraduated: z.string().optional(),
  college: z.string().optional(),
  collegeDegree: z.string().optional(),
  otherEducation: z.string().optional(),
  ref1Name: z.string().optional(),
  ref1Phone: z.string().optional(),
  ref1Relationship: z.string().optional(),
  ref2Name: z.string().optional(),
  ref2Phone: z.string().optional(),
  ref2Relationship: z.string().optional(),
  ref3Name: z.string().optional(),
  ref3Phone: z.string().optional(),
  ref3Relationship: z.string().optional(),
  skills: z.string().optional(),
  certifications: z.string().optional(),
  availableMonday: z.boolean().optional(),
  availableTuesday: z.boolean().optional(),
  availableWednesday: z.boolean().optional(),
  availableThursday: z.boolean().optional(),
  availableFriday: z.boolean().optional(),
  availableSaturday: z.boolean().optional(),
  availableSunday: z.boolean().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
});

type AppFormValues = z.infer<typeof appSchema>;

interface EmploymentApplicationFormProps {
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

function EmployerSection({ num, form, readOnly }: { num: number; form: any; readOnly?: boolean }) {
  const prefix = `employer${num}`;
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium">Employer {num}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Company Name</Label><Input {...form.register(`${prefix}Name`)} disabled={readOnly} data-testid={`app-${prefix}-name`} /></div>
        <div><Label>Phone</Label><Input {...form.register(`${prefix}Phone`)} disabled={readOnly} data-testid={`app-${prefix}-phone`} /></div>
      </div>
      <div><Label>Address</Label><Input {...form.register(`${prefix}Address`)} disabled={readOnly} data-testid={`app-${prefix}-address`} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Supervisor Name</Label><Input {...form.register(`${prefix}Supervisor`)} disabled={readOnly} data-testid={`app-${prefix}-supervisor`} /></div>
        <div><Label>Your Title</Label><Input {...form.register(`${prefix}Title`)} disabled={readOnly} data-testid={`app-${prefix}-title`} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Start Date</Label><Input {...form.register(`${prefix}StartDate`)} type="date" disabled={readOnly} data-testid={`app-${prefix}-start`} /></div>
        <div><Label>End Date</Label><Input {...form.register(`${prefix}EndDate`)} type="date" disabled={readOnly} data-testid={`app-${prefix}-end`} /></div>
      </div>
      <div><Label>Reason for Leaving</Label><Input {...form.register(`${prefix}ReasonForLeaving`)} disabled={readOnly} data-testid={`app-${prefix}-reason`} /></div>
      <div><Label>Duties/Responsibilities</Label><Textarea {...form.register(`${prefix}Duties`)} disabled={readOnly} data-testid={`app-${prefix}-duties`} rows={2} /></div>
    </div>
  );
}

export default function EmploymentApplicationForm({ submissionId, employeeId, onComplete, readOnly }: EmploymentApplicationFormProps) {
  const { toast } = useToast();
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<AppFormValues>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      firstName: "", lastName: "", middleName: "", address: "", city: "", state: "", zip: "",
      phone: "", email: "", positionAppliedFor: "", desiredPayRate: "", startDate: "",
      isUSCitizen: "", hasBeenConvicted: "", convictionDetails: "", hasDriversLicense: "", driversLicenseNumber: "",
      employer1Name: "", employer1Address: "", employer1Phone: "", employer1Supervisor: "", employer1Title: "", employer1StartDate: "", employer1EndDate: "", employer1ReasonForLeaving: "", employer1Duties: "",
      employer2Name: "", employer2Address: "", employer2Phone: "", employer2Supervisor: "", employer2Title: "", employer2StartDate: "", employer2EndDate: "", employer2ReasonForLeaving: "", employer2Duties: "",
      employer3Name: "", employer3Address: "", employer3Phone: "", employer3Supervisor: "", employer3Title: "", employer3StartDate: "", employer3EndDate: "", employer3ReasonForLeaving: "", employer3Duties: "",
      highSchool: "", highSchoolGraduated: "", college: "", collegeDegree: "", otherEducation: "",
      ref1Name: "", ref1Phone: "", ref1Relationship: "", ref2Name: "", ref2Phone: "", ref2Relationship: "", ref3Name: "", ref3Phone: "", ref3Relationship: "",
      skills: "", certifications: "",
      availableMonday: true, availableTuesday: true, availableWednesday: true, availableThursday: true, availableFriday: true, availableSaturday: false, availableSunday: false,
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: AppFormValues) => {
      const body = { formType: "employment_application", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "Application Submitted", description: "Your employment application has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit application.", variant: "destructive" }); },
  });

  const onSubmit = (values: AppFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
  const dayKeys = ["availableMonday", "availableTuesday", "availableWednesday", "availableThursday", "availableFriday", "availableSaturday", "availableSunday"] as const;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="employment-app-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Employment Application</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="app-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Personal Information</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className={errors.firstName ? "text-red-500" : ""}>First Name *</Label><Input {...form.register("firstName")} disabled={readOnly} data-testid="app-first-name" className={errors.firstName ? "border-red-500" : ""} /></div>
              <div><Label>Middle Name</Label><Input {...form.register("middleName")} disabled={readOnly} data-testid="app-middle-name" /></div>
              <div><Label className={errors.lastName ? "text-red-500" : ""}>Last Name *</Label><Input {...form.register("lastName")} disabled={readOnly} data-testid="app-last-name" className={errors.lastName ? "border-red-500" : ""} /></div>
            </div>
            <div className="mt-3"><Label className={errors.address ? "text-red-500" : ""}>Address *</Label><Input {...form.register("address")} disabled={readOnly} data-testid="app-address" className={errors.address ? "border-red-500" : ""} /></div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div><Label className={errors.city ? "text-red-500" : ""}>City *</Label><Input {...form.register("city")} disabled={readOnly} data-testid="app-city" className={errors.city ? "border-red-500" : ""} /></div>
              <div><Label className={errors.state ? "text-red-500" : ""}>State *</Label><Input {...form.register("state")} disabled={readOnly} data-testid="app-state" className={errors.state ? "border-red-500" : ""} /></div>
              <div><Label className={errors.zip ? "text-red-500" : ""}>ZIP *</Label><Input {...form.register("zip")} disabled={readOnly} data-testid="app-zip" className={errors.zip ? "border-red-500" : ""} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><Label className={errors.phone ? "text-red-500" : ""}>Phone *</Label><Input {...form.register("phone")} disabled={readOnly} data-testid="app-phone" className={errors.phone ? "border-red-500" : ""} /></div>
              <div><Label className={errors.email ? "text-red-500" : ""}>Email *</Label><Input {...form.register("email")} disabled={readOnly} data-testid="app-email" className={errors.email ? "border-red-500" : ""} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><Label className={errors.positionAppliedFor ? "text-red-500" : ""}>Position Applied For *</Label><Input {...form.register("positionAppliedFor")} disabled={readOnly} data-testid="app-position" className={errors.positionAppliedFor ? "border-red-500" : ""} /></div>
              <div><Label>Desired Pay Rate</Label><Input {...form.register("desiredPayRate")} disabled={readOnly} data-testid="app-pay-rate" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div><Label>Available Start Date</Label><Input {...form.register("startDate")} type="date" disabled={readOnly} data-testid="app-start-date" /></div>
              <div><Label>US Citizen?</Label><Input {...form.register("isUSCitizen")} disabled={readOnly} data-testid="app-us-citizen" placeholder="Yes/No" /></div>
              <div><Label>Driver's License?</Label><Input {...form.register("hasDriversLicense")} disabled={readOnly} data-testid="app-dl" placeholder="Yes/No" /></div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Employment History</h3>
            <EmployerSection num={1} form={form} readOnly={readOnly} />
            <div className="mt-3"><EmployerSection num={2} form={form} readOnly={readOnly} /></div>
            <div className="mt-3"><EmployerSection num={3} form={form} readOnly={readOnly} /></div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Education</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>High School</Label><Input {...form.register("highSchool")} disabled={readOnly} data-testid="app-high-school" /></div>
              <div><Label>Graduated?</Label><Input {...form.register("highSchoolGraduated")} disabled={readOnly} data-testid="app-hs-graduated" placeholder="Yes/No" /></div>
              <div><Label>College/University</Label><Input {...form.register("college")} disabled={readOnly} data-testid="app-college" /></div>
              <div><Label>Degree</Label><Input {...form.register("collegeDegree")} disabled={readOnly} data-testid="app-degree" /></div>
            </div>
            <div className="mt-3"><Label>Other Education/Training</Label><Textarea {...form.register("otherEducation")} disabled={readOnly} data-testid="app-other-education" rows={2} /></div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">References</h3>
            {[1,2,3].map(n => (
              <div key={n} className="grid grid-cols-3 gap-3 mb-2">
                <div><Label>Name</Label><Input {...form.register(`ref${n}Name` as any)} disabled={readOnly} data-testid={`app-ref${n}-name`} /></div>
                <div><Label>Phone</Label><Input {...form.register(`ref${n}Phone` as any)} disabled={readOnly} data-testid={`app-ref${n}-phone`} /></div>
                <div><Label>Relationship</Label><Input {...form.register(`ref${n}Relationship` as any)} disabled={readOnly} data-testid={`app-ref${n}-relationship`} /></div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-semibold mb-3">Skills & Availability</h3>
            <div><Label>Skills/Qualifications</Label><Textarea {...form.register("skills")} disabled={readOnly} data-testid="app-skills" rows={2} /></div>
            <div className="mt-3"><Label>Certifications/Licenses</Label><Textarea {...form.register("certifications")} disabled={readOnly} data-testid="app-certifications" rows={2} /></div>
            <div className="mt-3">
              <Label>Availability</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {days.map((day, i) => (
                  <div key={day} className="flex items-center space-x-1">
                    <Checkbox checked={form.watch(dayKeys[i])} onCheckedChange={(v) => form.setValue(dayKeys[i], !!v)} disabled={readOnly} data-testid={`app-avail-${day.toLowerCase()}`} />
                    <Label className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
            <p className="text-xs text-muted-foreground mb-2">I certify that the information provided is true and complete to the best of my knowledge.</p>
            {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="app-signature" />}
            {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
          </div>
          <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="app-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="app-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit Application"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

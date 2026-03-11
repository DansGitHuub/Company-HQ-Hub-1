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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const i9Schema = z.object({
  lastName: z.string().min(1, "Required"),
  firstName: z.string().min(1, "Required"),
  middleInitial: z.string().optional(),
  otherLastNames: z.string().optional(),
  address: z.string().min(1, "Required"),
  aptNumber: z.string().optional(),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().min(1, "Required"),
  dateOfBirth: z.string().min(1, "Required"),
  ssn: z.string().min(1, "Required"),
  email: z.string().optional(),
  phone: z.string().optional(),
  citizenshipStatus: z.enum(["citizen", "noncitizen_national", "permanent_resident", "alien_authorized"], { required_error: "Required" }),
  alienNumber: z.string().optional(),
  i94Number: z.string().optional(),
  foreignPassportNumber: z.string().optional(),
  countryOfIssuance: z.string().optional(),
  workAuthExpiration: z.string().optional(),
  documentListA: z.string().optional(),
  documentListB: z.string().optional(),
  documentListC: z.string().optional(),
  documentPhotoUrl: z.string().optional(),
  section2DocumentTitle: z.string().optional(),
  section2IssuingAuthority: z.string().optional(),
  section2DocumentNumber: z.string().optional(),
  section2ExpirationDate: z.string().optional(),
  section2EmployerName: z.string().optional(),
  section2EmployerAddress: z.string().optional(),
  section2FirstDayOfEmployment: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
  preparerUsed: z.boolean().optional(),
  preparerName: z.string().optional(),
  preparerAddress: z.string().optional(),
});

type I9FormValues = z.infer<typeof i9Schema>;

interface I9FormProps {
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

export default function I9Form({ submissionId, employeeId, onComplete, readOnly }: I9FormProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<1|2>(1);

  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<I9FormValues>({
    resolver: zodResolver(i9Schema),
    defaultValues: {
      lastName: "", firstName: "", middleInitial: "", otherLastNames: "", address: "", aptNumber: "",
      city: "", state: "", zip: "", dateOfBirth: "", ssn: "", email: "", phone: "",
      citizenshipStatus: undefined, alienNumber: "", i94Number: "", foreignPassportNumber: "",
      countryOfIssuance: "", workAuthExpiration: "", documentListA: "", documentListB: "", documentListC: "",
      documentPhotoUrl: "", section2DocumentTitle: "", section2IssuingAuthority: "", section2DocumentNumber: "",
      section2ExpirationDate: "", section2EmployerName: "", section2EmployerAddress: "", section2FirstDayOfEmployment: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
      preparerUsed: false, preparerName: "", preparerAddress: "",
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: I9FormValues) => {
      const body = { formType: "i9", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "I-9 Submitted", description: "Form I-9 has been submitted successfully." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit I-9 form.", variant: "destructive" }); },
  });

  const onSubmit = (values: I9FormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => form.setValue("documentPhotoUrl", reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="i9-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Form I-9 — Employment Eligibility Verification</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="i9-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Button type="button" variant={activeSection === 1 ? "default" : "outline"} onClick={() => setActiveSection(1)} data-testid="i9-section-1-btn">Section 1 (Employee)</Button>
            <Button type="button" variant={activeSection === 2 ? "default" : "outline"} onClick={() => setActiveSection(2)} data-testid="i9-section-2-btn">Section 2 (Employer)</Button>
          </div>

          {activeSection === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Section 1: Employee Information and Attestation</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.lastName ? "text-red-500" : ""}>Last Name *</Label><Input {...form.register("lastName")} disabled={readOnly} data-testid="i9-last-name" className={errors.lastName ? "border-red-500" : ""} /></div>
                <div><Label className={errors.firstName ? "text-red-500" : ""}>First Name *</Label><Input {...form.register("firstName")} disabled={readOnly} data-testid="i9-first-name" className={errors.firstName ? "border-red-500" : ""} /></div>
                <div><Label>Middle Initial</Label><Input {...form.register("middleInitial")} disabled={readOnly} data-testid="i9-middle-initial" /></div>
              </div>
              <div><Label>Other Last Names Used</Label><Input {...form.register("otherLastNames")} disabled={readOnly} data-testid="i9-other-names" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className={errors.address ? "text-red-500" : ""}>Address *</Label><Input {...form.register("address")} disabled={readOnly} data-testid="i9-address" className={errors.address ? "border-red-500" : ""} /></div>
                <div><Label>Apt. Number</Label><Input {...form.register("aptNumber")} disabled={readOnly} data-testid="i9-apt" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className={errors.city ? "text-red-500" : ""}>City *</Label><Input {...form.register("city")} disabled={readOnly} data-testid="i9-city" className={errors.city ? "border-red-500" : ""} /></div>
                <div><Label className={errors.state ? "text-red-500" : ""}>State *</Label><Input {...form.register("state")} disabled={readOnly} data-testid="i9-state" className={errors.state ? "border-red-500" : ""} /></div>
                <div><Label className={errors.zip ? "text-red-500" : ""}>ZIP *</Label><Input {...form.register("zip")} disabled={readOnly} data-testid="i9-zip" className={errors.zip ? "border-red-500" : ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className={errors.dateOfBirth ? "text-red-500" : ""}>Date of Birth *</Label><Input {...form.register("dateOfBirth")} type="date" disabled={readOnly} data-testid="i9-dob" className={errors.dateOfBirth ? "border-red-500" : ""} /></div>
                <div><Label className={errors.ssn ? "text-red-500" : ""}>SSN *</Label><Input {...form.register("ssn")} disabled={readOnly} data-testid="i9-ssn" className={errors.ssn ? "border-red-500" : ""} placeholder="XXX-XX-XXXX" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Email</Label><Input {...form.register("email")} disabled={readOnly} data-testid="i9-email" /></div>
                <div><Label>Phone</Label><Input {...form.register("phone")} disabled={readOnly} data-testid="i9-phone" /></div>
              </div>
              <div>
                <Label className={errors.citizenshipStatus ? "text-red-500" : ""}>Citizenship / Immigration Status *</Label>
                <RadioGroup value={form.watch("citizenshipStatus")} onValueChange={(v) => form.setValue("citizenshipStatus", v as any, { shouldValidate: true })} disabled={readOnly} data-testid="i9-citizenship">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="citizen" id="i9-citizen" data-testid="i9-citizen" /><Label htmlFor="i9-citizen">A citizen of the United States</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="noncitizen_national" id="i9-national" data-testid="i9-national" /><Label htmlFor="i9-national">A noncitizen national of the United States</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="permanent_resident" id="i9-pr" data-testid="i9-permanent-resident" /><Label htmlFor="i9-pr">A lawful permanent resident</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="alien_authorized" id="i9-alien" data-testid="i9-alien-authorized" /><Label htmlFor="i9-alien">An alien authorized to work</Label></div>
                </RadioGroup>
              </div>
              {(form.watch("citizenshipStatus") === "permanent_resident" || form.watch("citizenshipStatus") === "alien_authorized") && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Alien Registration Number / USCIS Number</Label><Input {...form.register("alienNumber")} disabled={readOnly} data-testid="i9-alien-number" /></div>
                  <div><Label>Form I-94 Admission Number</Label><Input {...form.register("i94Number")} disabled={readOnly} data-testid="i9-i94" /></div>
                  <div><Label>Foreign Passport Number</Label><Input {...form.register("foreignPassportNumber")} disabled={readOnly} data-testid="i9-passport" /></div>
                  <div><Label>Country of Issuance</Label><Input {...form.register("countryOfIssuance")} disabled={readOnly} data-testid="i9-country" /></div>
                  <div><Label>Work Authorization Expiration</Label><Input {...form.register("workAuthExpiration")} type="date" disabled={readOnly} data-testid="i9-work-auth-exp" /></div>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox checked={form.watch("preparerUsed")} onCheckedChange={(v) => form.setValue("preparerUsed", !!v)} disabled={readOnly} data-testid="i9-preparer-used" />
                <Label>A preparer/translator assisted the employee</Label>
              </div>
              {form.watch("preparerUsed") && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Preparer Name</Label><Input {...form.register("preparerName")} disabled={readOnly} data-testid="i9-preparer-name" /></div>
                  <div><Label>Preparer Address</Label><Input {...form.register("preparerAddress")} disabled={readOnly} data-testid="i9-preparer-address" /></div>
                </div>
              )}
              <div>
                <Label>Upload ID Document Photo</Label>
                <Input type="file" accept="image/*" onChange={handleDocumentUpload} disabled={readOnly} data-testid="i9-document-upload" />
                {form.watch("documentPhotoUrl") && <img src={form.watch("documentPhotoUrl")} alt="Document" className="mt-2 max-h-40 border rounded" />}
              </div>
              <div>
                <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Employee Signature *</Label>
                {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="i9-signature" />}
                {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
              </div>
              <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="i9-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
            </div>
          )}

          {activeSection === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Section 2: Employer or Authorized Representative Review</h3>
              <p className="text-sm text-muted-foreground">To be completed by the employer/HR representative.</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Document Title (List A, B, or C)</Label><Input {...form.register("section2DocumentTitle")} disabled={readOnly} data-testid="i9-s2-doc-title" /></div>
                <div><Label>Issuing Authority</Label><Input {...form.register("section2IssuingAuthority")} disabled={readOnly} data-testid="i9-s2-issuing-auth" /></div>
                <div><Label>Document Number</Label><Input {...form.register("section2DocumentNumber")} disabled={readOnly} data-testid="i9-s2-doc-number" /></div>
                <div><Label>Expiration Date</Label><Input {...form.register("section2ExpirationDate")} type="date" disabled={readOnly} data-testid="i9-s2-exp-date" /></div>
              </div>
              <div><Label>First Day of Employment</Label><Input {...form.register("section2FirstDayOfEmployment")} type="date" disabled={readOnly} data-testid="i9-s2-start-date" /></div>
              <div><Label>Employer/Organization Name</Label><Input {...form.register("section2EmployerName")} disabled={readOnly} data-testid="i9-s2-employer-name" /></div>
              <div><Label>Employer Address</Label><Input {...form.register("section2EmployerAddress")} disabled={readOnly} data-testid="i9-s2-employer-address" /></div>
            </div>
          )}

          {!readOnly && (
            <Button type="submit" disabled={submitMutation.isPending} data-testid="i9-submit" className="w-full">
              {submitMutation.isPending ? "Submitting..." : "Submit I-9"}
            </Button>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

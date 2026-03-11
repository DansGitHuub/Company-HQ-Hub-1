import React, { useState, useRef, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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

const addressEntrySchema = z.object({
  address: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().min(1, "Required"),
  fromDate: z.string().min(1, "Required"),
  toDate: z.string().min(1, "Required"),
});

const bgCheckSchema = z.object({
  fullName: z.string().min(1, "Required"),
  otherNames: z.string().optional(),
  ssn: z.string().min(1, "Required"),
  dateOfBirth: z.string().min(1, "Required"),
  driversLicenseNumber: z.string().optional(),
  driversLicenseState: z.string().optional(),
  addresses: z.array(addressEntrySchema).min(1, "At least one address is required"),
  consentGiven: z.boolean().refine((v) => v === true, "Consent is required"),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
});

type BGCheckFormValues = z.infer<typeof bgCheckSchema>;

interface BackgroundCheckAuthFormProps {
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

export default function BackgroundCheckAuthForm({ submissionId, employeeId, onComplete, readOnly }: BackgroundCheckAuthFormProps) {
  const { toast } = useToast();
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<BGCheckFormValues>({
    resolver: zodResolver(bgCheckSchema),
    defaultValues: {
      fullName: "", otherNames: "", ssn: "", dateOfBirth: "",
      driversLicenseNumber: "", driversLicenseState: "",
      addresses: [{ address: "", city: "", state: "", zip: "", fromDate: "", toDate: "" }],
      consentGiven: false, signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "addresses" });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: BGCheckFormValues) => {
      const body = { formType: "background_check_auth", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "Background Check Auth Submitted", description: "Your authorization has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit background check authorization.", variant: "destructive" }); },
  });

  const onSubmit = (values: BGCheckFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="bg-check-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Background Check Authorization</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="bg-check-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-xs space-y-2">
            <p className="font-semibold">Fair Credit Reporting Act (FCRA) Disclosure</p>
            <p>In connection with your employment or application for employment, the Company may obtain a consumer report and/or investigative consumer report about you from a consumer reporting agency. This report may include information about your character, general reputation, personal characteristics, mode of living, credit standing, and criminal history.</p>
            <p>Under the FCRA, before we can obtain a consumer report about you for employment purposes, we must have your written authorization. By signing below, you authorize the Company to obtain consumer reports about you for employment purposes, now and throughout your employment.</p>
            <p>You have the right to request a complete and accurate disclosure of the nature and scope of the investigation. You also have the right to request a summary of your rights under the FCRA.</p>
          </div>

          <div><Label className={errors.fullName ? "text-red-500" : ""}>Full Legal Name *</Label><Input {...form.register("fullName")} disabled={readOnly} data-testid="bg-full-name" className={errors.fullName ? "border-red-500" : ""} /></div>
          <div><Label>Other Names Used (maiden, aliases)</Label><Input {...form.register("otherNames")} disabled={readOnly} data-testid="bg-other-names" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label className={errors.ssn ? "text-red-500" : ""}>Social Security Number *</Label><Input {...form.register("ssn")} disabled={readOnly} data-testid="bg-ssn" className={errors.ssn ? "border-red-500" : ""} placeholder="XXX-XX-XXXX" /></div>
            <div><Label className={errors.dateOfBirth ? "text-red-500" : ""}>Date of Birth *</Label><Input {...form.register("dateOfBirth")} type="date" disabled={readOnly} data-testid="bg-dob" className={errors.dateOfBirth ? "border-red-500" : ""} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Driver's License Number</Label><Input {...form.register("driversLicenseNumber")} disabled={readOnly} data-testid="bg-dl-number" /></div>
            <div><Label>DL State</Label><Input {...form.register("driversLicenseState")} disabled={readOnly} data-testid="bg-dl-state" /></div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">7-Year Address History *</h4>
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Address {index + 1}</span>
                  {index > 0 && !readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} data-testid={`bg-remove-address-${index}`}>Remove</Button>}
                </div>
                <div><Label>Street Address *</Label><Input {...form.register(`addresses.${index}.address`)} disabled={readOnly} data-testid={`bg-addr-${index}-street`} className={errors.addresses?.[index]?.address ? "border-red-500" : ""} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>City *</Label><Input {...form.register(`addresses.${index}.city`)} disabled={readOnly} data-testid={`bg-addr-${index}-city`} className={errors.addresses?.[index]?.city ? "border-red-500" : ""} /></div>
                  <div><Label>State *</Label><Input {...form.register(`addresses.${index}.state`)} disabled={readOnly} data-testid={`bg-addr-${index}-state`} className={errors.addresses?.[index]?.state ? "border-red-500" : ""} /></div>
                  <div><Label>ZIP *</Label><Input {...form.register(`addresses.${index}.zip`)} disabled={readOnly} data-testid={`bg-addr-${index}-zip`} className={errors.addresses?.[index]?.zip ? "border-red-500" : ""} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>From Date *</Label><Input {...form.register(`addresses.${index}.fromDate`)} type="date" disabled={readOnly} data-testid={`bg-addr-${index}-from`} className={errors.addresses?.[index]?.fromDate ? "border-red-500" : ""} /></div>
                  <div><Label>To Date *</Label><Input {...form.register(`addresses.${index}.toDate`)} type="date" disabled={readOnly} data-testid={`bg-addr-${index}-to`} className={errors.addresses?.[index]?.toDate ? "border-red-500" : ""} /></div>
                </div>
              </div>
            ))}
            {!readOnly && fields.length < 7 && (
              <Button type="button" variant="outline" size="sm" onClick={() => append({ address: "", city: "", state: "", zip: "", fromDate: "", toDate: "" })} data-testid="bg-add-address">
                + Add Address
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={form.watch("consentGiven")} onChange={(e) => form.setValue("consentGiven", e.target.checked, { shouldValidate: true })} disabled={readOnly} data-testid="bg-consent" />
            <Label className={errors.consentGiven ? "text-red-500" : ""}>I authorize the Company to obtain consumer reports as described above *</Label>
          </div>
          {errors.consentGiven && <p className="text-red-500 text-xs">{errors.consentGiven.message}</p>}

          <div>
            <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
            {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="bg-signature" />}
            {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
          </div>
          <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="bg-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="bg-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit Authorization"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

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

const contactSchema = z.object({
  name: z.string().optional(),
  relationship: z.string().optional(),
  homePhone: z.string().optional(),
  cellPhone: z.string().optional(),
  workPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

const emergencyContactSchema = z.object({
  employeeName: z.string().min(1, "Required"),
  contact1Name: z.string().min(1, "At least one contact is required"),
  contact1Relationship: z.string().min(1, "Required"),
  contact1HomePhone: z.string().optional(),
  contact1CellPhone: z.string().min(1, "At least one phone number required"),
  contact1WorkPhone: z.string().optional(),
  contact1Address: z.string().optional(),
  contact1City: z.string().optional(),
  contact1State: z.string().optional(),
  contact1Zip: z.string().optional(),
  contact2Name: z.string().optional(),
  contact2Relationship: z.string().optional(),
  contact2HomePhone: z.string().optional(),
  contact2CellPhone: z.string().optional(),
  contact2WorkPhone: z.string().optional(),
  contact2Address: z.string().optional(),
  contact2City: z.string().optional(),
  contact2State: z.string().optional(),
  contact2Zip: z.string().optional(),
  contact3Name: z.string().optional(),
  contact3Relationship: z.string().optional(),
  contact3HomePhone: z.string().optional(),
  contact3CellPhone: z.string().optional(),
  contact3WorkPhone: z.string().optional(),
  contact3Address: z.string().optional(),
  contact3City: z.string().optional(),
  contact3State: z.string().optional(),
  contact3Zip: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
});

type EmergencyContactFormValues = z.infer<typeof emergencyContactSchema>;

interface EmergencyContactFormProps {
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

function ContactFields({ prefix, index, form, readOnly, errors, required }: { prefix: string; index: number; form: any; readOnly?: boolean; errors: any; required?: boolean }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium">Emergency Contact {index}{required ? " *" : " (Optional)"}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className={errors[`${prefix}Name`] ? "text-red-500" : ""}>Full Name{required ? " *" : ""}</Label><Input {...form.register(`${prefix}Name`)} disabled={readOnly} data-testid={`ec-${prefix}-name`} className={errors[`${prefix}Name`] ? "border-red-500" : ""} /></div>
        <div><Label className={errors[`${prefix}Relationship`] ? "text-red-500" : ""}>Relationship{required ? " *" : ""}</Label><Input {...form.register(`${prefix}Relationship`)} disabled={readOnly} data-testid={`ec-${prefix}-relationship`} className={errors[`${prefix}Relationship`] ? "border-red-500" : ""} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Home Phone</Label><Input {...form.register(`${prefix}HomePhone`)} disabled={readOnly} data-testid={`ec-${prefix}-home-phone`} /></div>
        <div><Label className={errors[`${prefix}CellPhone`] ? "text-red-500" : ""}>Cell Phone{required ? " *" : ""}</Label><Input {...form.register(`${prefix}CellPhone`)} disabled={readOnly} data-testid={`ec-${prefix}-cell-phone`} className={errors[`${prefix}CellPhone`] ? "border-red-500" : ""} /></div>
        <div><Label>Work Phone</Label><Input {...form.register(`${prefix}WorkPhone`)} disabled={readOnly} data-testid={`ec-${prefix}-work-phone`} /></div>
      </div>
      <div><Label>Address</Label><Input {...form.register(`${prefix}Address`)} disabled={readOnly} data-testid={`ec-${prefix}-address`} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>City</Label><Input {...form.register(`${prefix}City`)} disabled={readOnly} data-testid={`ec-${prefix}-city`} /></div>
        <div><Label>State</Label><Input {...form.register(`${prefix}State`)} disabled={readOnly} data-testid={`ec-${prefix}-state`} /></div>
        <div><Label>ZIP</Label><Input {...form.register(`${prefix}Zip`)} disabled={readOnly} data-testid={`ec-${prefix}-zip`} /></div>
      </div>
    </div>
  );
}

export default function EmergencyContactForm({ submissionId, employeeId, onComplete, readOnly }: EmergencyContactFormProps) {
  const { toast } = useToast();
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: {
      employeeName: "",
      contact1Name: "", contact1Relationship: "", contact1HomePhone: "", contact1CellPhone: "", contact1WorkPhone: "", contact1Address: "", contact1City: "", contact1State: "", contact1Zip: "",
      contact2Name: "", contact2Relationship: "", contact2HomePhone: "", contact2CellPhone: "", contact2WorkPhone: "", contact2Address: "", contact2City: "", contact2State: "", contact2Zip: "",
      contact3Name: "", contact3Relationship: "", contact3HomePhone: "", contact3CellPhone: "", contact3WorkPhone: "", contact3Address: "", contact3City: "", contact3State: "", contact3Zip: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: EmergencyContactFormValues) => {
      const body = { formType: "emergency_contact", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "Emergency Contacts Submitted", description: "Your emergency contact information has been saved." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit emergency contacts.", variant: "destructive" }); },
  });

  const onSubmit = (values: EmergencyContactFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="emergency-contact-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Emergency Contact Information</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="ec-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className={errors.employeeName ? "text-red-500" : ""}>Employee Name *</Label><Input {...form.register("employeeName")} disabled={readOnly} data-testid="ec-employee-name" className={errors.employeeName ? "border-red-500" : ""} /></div>
          <ContactFields prefix="contact1" index={1} form={form} readOnly={readOnly} errors={errors} required />
          <ContactFields prefix="contact2" index={2} form={form} readOnly={readOnly} errors={errors} />
          <ContactFields prefix="contact3" index={3} form={form} readOnly={readOnly} errors={errors} />
          <div>
            <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
            {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="ec-signature" />}
            {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
          </div>
          <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="ec-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="ec-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit Emergency Contacts"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

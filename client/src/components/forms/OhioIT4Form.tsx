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

const ohioIT4Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  ssn: z.string().min(1, "Required"),
  address: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().min(1, "Required"),
  schoolDistrict: z.string().optional(),
  schoolDistrictNumber: z.string().optional(),
  personalExemptions: z.string().optional(),
  dependentExemptions: z.string().optional(),
  additionalWithholding: z.string().optional(),
  exemptFromWithholding: z.boolean().optional(),
  residentCity: z.string().optional(),
  workCity: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
});

type OhioIT4FormValues = z.infer<typeof ohioIT4Schema>;

interface OhioIT4FormProps {
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

export default function OhioIT4Form({ submissionId, employeeId, onComplete, readOnly }: OhioIT4FormProps) {
  const { toast } = useToast();
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<OhioIT4FormValues>({
    resolver: zodResolver(ohioIT4Schema),
    defaultValues: {
      firstName: "", lastName: "", ssn: "", address: "", city: "", state: "OH", zip: "",
      schoolDistrict: "", schoolDistrictNumber: "", personalExemptions: "1", dependentExemptions: "0",
      additionalWithholding: "", exemptFromWithholding: false, residentCity: "", workCity: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: OhioIT4FormValues) => {
      const body = { formType: "ohio_it4", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "Ohio IT-4 Submitted", description: "Your Ohio IT-4 form has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit Ohio IT-4.", variant: "destructive" }); },
  });

  const onSubmit = (values: OhioIT4FormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="ohio-it4-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ohio IT-4 — Employee's Withholding Exemption Certificate</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="ohio-it4-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label className={errors.firstName ? "text-red-500" : ""}>First Name *</Label><Input {...form.register("firstName")} disabled={readOnly} data-testid="ohio-it4-first-name" className={errors.firstName ? "border-red-500" : ""} /></div>
            <div><Label className={errors.lastName ? "text-red-500" : ""}>Last Name *</Label><Input {...form.register("lastName")} disabled={readOnly} data-testid="ohio-it4-last-name" className={errors.lastName ? "border-red-500" : ""} /></div>
          </div>
          <div><Label className={errors.ssn ? "text-red-500" : ""}>SSN *</Label><Input {...form.register("ssn")} disabled={readOnly} data-testid="ohio-it4-ssn" className={errors.ssn ? "border-red-500" : ""} placeholder="XXX-XX-XXXX" /></div>
          <div><Label className={errors.address ? "text-red-500" : ""}>Address *</Label><Input {...form.register("address")} disabled={readOnly} data-testid="ohio-it4-address" className={errors.address ? "border-red-500" : ""} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label className={errors.city ? "text-red-500" : ""}>City *</Label><Input {...form.register("city")} disabled={readOnly} data-testid="ohio-it4-city" className={errors.city ? "border-red-500" : ""} /></div>
            <div><Label className={errors.state ? "text-red-500" : ""}>State *</Label><Input {...form.register("state")} disabled={readOnly} data-testid="ohio-it4-state" className={errors.state ? "border-red-500" : ""} /></div>
            <div><Label className={errors.zip ? "text-red-500" : ""}>ZIP *</Label><Input {...form.register("zip")} disabled={readOnly} data-testid="ohio-it4-zip" className={errors.zip ? "border-red-500" : ""} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>School District Name</Label><Input {...form.register("schoolDistrict")} disabled={readOnly} data-testid="ohio-it4-school-district" /></div>
            <div><Label>School District Number</Label><Input {...form.register("schoolDistrictNumber")} disabled={readOnly} data-testid="ohio-it4-school-district-number" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Personal Exemptions</Label><Input {...form.register("personalExemptions")} type="number" disabled={readOnly} data-testid="ohio-it4-personal-exemptions" /></div>
            <div><Label>Dependent Exemptions</Label><Input {...form.register("dependentExemptions")} type="number" disabled={readOnly} data-testid="ohio-it4-dependent-exemptions" /></div>
          </div>
          <div><Label>Additional Withholding per Pay Period</Label><Input {...form.register("additionalWithholding")} disabled={readOnly} data-testid="ohio-it4-additional-withholding" placeholder="$" /></div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={form.watch("exemptFromWithholding")} onCheckedChange={(v) => form.setValue("exemptFromWithholding", !!v)} disabled={readOnly} data-testid="ohio-it4-exempt" />
            <Label>I am exempt from Ohio withholding</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Resident City/Village</Label><Input {...form.register("residentCity")} disabled={readOnly} data-testid="ohio-it4-resident-city" /></div>
            <div><Label>Work City/Village</Label><Input {...form.register("workCity")} disabled={readOnly} data-testid="ohio-it4-work-city" /></div>
          </div>
          <div>
            <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
            {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="ohio-it4-signature" />}
            {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
          </div>
          <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="ohio-it4-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="ohio-it4-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit Ohio IT-4"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

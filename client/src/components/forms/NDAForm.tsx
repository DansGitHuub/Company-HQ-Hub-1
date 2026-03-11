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

const ndaSchema = z.object({
  employeePrintedName: z.string().min(1, "Required"),
  employeeTitle: z.string().optional(),
  effectiveDate: z.string().min(1, "Required"),
  companyRepName: z.string().optional(),
  companyRepTitle: z.string().optional(),
  companyRepSignatureDataUrl: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
});

type NDAFormValues = z.infer<typeof ndaSchema>;

interface NDAFormProps {
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

export default function NDAForm({ submissionId, employeeId, onComplete, readOnly }: NDAFormProps) {
  const { toast } = useToast();
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<NDAFormValues>({
    resolver: zodResolver(ndaSchema),
    defaultValues: {
      employeePrintedName: "", employeeTitle: "", effectiveDate: new Date().toISOString().split("T")[0],
      companyRepName: "", companyRepTitle: "", companyRepSignatureDataUrl: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: NDAFormValues) => {
      const body = { formType: "nda", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "NDA Submitted", description: "Your Non-Disclosure Agreement has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit NDA.", variant: "destructive" }); },
  });

  const onSubmit = (values: NDAFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="nda-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Non-Disclosure Agreement (NDA)</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="nda-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-xs space-y-2 max-h-64 overflow-y-auto">
            <p className="font-semibold text-sm">CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT</p>
            <p>This Non-Disclosure Agreement ("Agreement") is entered into as of the date signed below, by and between the Company and the Employee/Contractor identified below.</p>
            <p><strong>1. Definition of Confidential Information.</strong> "Confidential Information" means any and all non-public information, including but not limited to: trade secrets, business plans, financial information, customer lists, pricing strategies, marketing plans, proprietary software, technical data, product designs, employee information, and any other information designated as confidential.</p>
            <p><strong>2. Obligations of Receiving Party.</strong> The Employee agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for the purpose of performing duties for the Company; (d) take all reasonable precautions to prevent unauthorized disclosure.</p>
            <p><strong>3. Return of Materials.</strong> Upon termination of employment or upon request, the Employee shall promptly return all materials containing Confidential Information.</p>
            <p><strong>4. Duration.</strong> The obligations under this Agreement shall survive termination of employment and remain in effect for a period of two (2) years after termination, or longer where required by applicable law.</p>
            <p><strong>5. Remedies.</strong> The Employee acknowledges that any breach may cause irreparable harm, and the Company shall be entitled to seek injunctive relief in addition to any other remedies available at law or in equity.</p>
            <p><strong>6. Governing Law.</strong> This Agreement shall be governed by the laws of the State of Ohio.</p>
          </div>

          <div><Label className={errors.effectiveDate ? "text-red-500" : ""}>Effective Date *</Label><Input {...form.register("effectiveDate")} type="date" disabled={readOnly} data-testid="nda-effective-date" className={errors.effectiveDate ? "border-red-500" : ""} /></div>

          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Employee</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className={errors.employeePrintedName ? "text-red-500" : ""}>Printed Name *</Label><Input {...form.register("employeePrintedName")} disabled={readOnly} data-testid="nda-employee-name" className={errors.employeePrintedName ? "border-red-500" : ""} /></div>
              <div><Label>Title</Label><Input {...form.register("employeeTitle")} disabled={readOnly} data-testid="nda-employee-title" /></div>
            </div>
            <div>
              <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Employee Signature *</Label>
              {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="nda-employee-signature" />}
              {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
            </div>
            <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="nda-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Company Representative (to be completed separately)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Representative Name</Label><Input {...form.register("companyRepName")} disabled={readOnly} data-testid="nda-rep-name" /></div>
              <div><Label>Representative Title</Label><Input {...form.register("companyRepTitle")} disabled={readOnly} data-testid="nda-rep-title" /></div>
            </div>
            <div>
              <Label>Company Representative Signature</Label>
              {!readOnly && <SignaturePad value={form.watch("companyRepSignatureDataUrl") || ""} onChange={(v) => form.setValue("companyRepSignatureDataUrl", v)} testId="nda-rep-signature" />}
              {readOnly && form.watch("companyRepSignatureDataUrl") && <img src={form.watch("companyRepSignatureDataUrl")} alt="Rep Signature" className="border rounded h-[120px]" />}
            </div>
          </div>

          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="nda-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit NDA"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const directDepositSchema = z.object({
  employeeName: z.string().min(1, "Required"),
  bankName: z.string().min(1, "Required"),
  routingNumber: z.string().min(9, "Must be 9 digits").max(9, "Must be 9 digits"),
  accountNumber: z.string().min(1, "Required"),
  confirmAccountNumber: z.string().min(1, "Required"),
  accountType: z.enum(["checking", "savings"], { required_error: "Required" }),
  voidedCheckUrl: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers must match",
  path: ["confirmAccountNumber"],
});

type DirectDepositFormValues = z.infer<typeof directDepositSchema>;

interface DirectDepositFormProps {
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

export default function DirectDepositForm({ submissionId, employeeId, onComplete, readOnly }: DirectDepositFormProps) {
  const { toast } = useToast();
  const { data: existingData } = useQuery({ queryKey: ["/api/onboarding-forms", submissionId], enabled: !!submissionId });

  const form = useForm<DirectDepositFormValues>({
    resolver: zodResolver(directDepositSchema),
    defaultValues: {
      employeeName: "", bankName: "", routingNumber: "", accountNumber: "", confirmAccountNumber: "",
      accountType: undefined, voidedCheckUrl: "", signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => { if (existingData && (existingData as any).submissionData) { const data = (existingData as any).submissionData; Object.keys(data).forEach((key) => form.setValue(key as any, data[key])); } }, [existingData, form]);

  const handleCheckUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = () => form.setValue("voidedCheckUrl", reader.result as string); reader.readAsDataURL(file); }
  };

  const submitMutation = useMutation({
    mutationFn: async (values: DirectDepositFormValues) => {
      const body = { formType: "direct_deposit", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => { toast({ title: "Direct Deposit Submitted", description: "Your direct deposit form has been submitted." }); onComplete?.(); },
    onError: () => { toast({ title: "Error", description: "Failed to submit direct deposit form.", variant: "destructive" }); },
  });

  const onSubmit = (values: DirectDepositFormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="direct-deposit-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Direct Deposit Authorization</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="direct-deposit-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className={errors.employeeName ? "text-red-500" : ""}>Employee Name *</Label><Input {...form.register("employeeName")} disabled={readOnly} data-testid="dd-employee-name" className={errors.employeeName ? "border-red-500" : ""} /></div>
          <div><Label className={errors.bankName ? "text-red-500" : ""}>Bank Name *</Label><Input {...form.register("bankName")} disabled={readOnly} data-testid="dd-bank-name" className={errors.bankName ? "border-red-500" : ""} /></div>
          <div><Label className={errors.routingNumber ? "text-red-500" : ""}>Routing Number (9 digits) *</Label><Input {...form.register("routingNumber")} disabled={readOnly} data-testid="dd-routing" className={errors.routingNumber ? "border-red-500" : ""} maxLength={9} /></div>
          <div><Label className={errors.accountNumber ? "text-red-500" : ""}>Account Number *</Label><Input {...form.register("accountNumber")} disabled={readOnly} data-testid="dd-account" className={errors.accountNumber ? "border-red-500" : ""} /></div>
          <div>
            <Label className={errors.confirmAccountNumber ? "text-red-500" : ""}>Confirm Account Number *</Label>
            <Input {...form.register("confirmAccountNumber")} disabled={readOnly} data-testid="dd-confirm-account" className={errors.confirmAccountNumber ? "border-red-500" : ""} />
            {errors.confirmAccountNumber && <p className="text-red-500 text-xs mt-1">{errors.confirmAccountNumber.message}</p>}
          </div>
          <div>
            <Label className={errors.accountType ? "text-red-500" : ""}>Account Type *</Label>
            <RadioGroup value={form.watch("accountType")} onValueChange={(v) => form.setValue("accountType", v as any, { shouldValidate: true })} disabled={readOnly} data-testid="dd-account-type">
              <div className="flex items-center space-x-2"><RadioGroupItem value="checking" id="dd-checking" data-testid="dd-checking" /><Label htmlFor="dd-checking">Checking</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="savings" id="dd-savings" data-testid="dd-savings" /><Label htmlFor="dd-savings">Savings</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label>Voided Check Upload (optional)</Label>
            <Input type="file" accept="image/*,.pdf" onChange={handleCheckUpload} disabled={readOnly} data-testid="dd-check-upload" />
            {form.watch("voidedCheckUrl") && <img src={form.watch("voidedCheckUrl")} alt="Voided Check" className="mt-2 max-h-40 border rounded" />}
          </div>
          <div>
            <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
            {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="dd-signature" />}
            {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
          </div>
          <div><Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label><Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="dd-sign-date" className={errors.signDate ? "border-red-500" : ""} /></div>
          {!readOnly && <Button type="submit" disabled={submitMutation.isPending} data-testid="dd-submit" className="w-full">{submitMutation.isPending ? "Submitting..." : "Submit Direct Deposit"}</Button>}
        </CardContent>
      </Card>
    </form>
  );
}

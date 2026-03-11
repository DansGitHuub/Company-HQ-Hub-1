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

const w4Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  ssn: z.string().min(1, "Required"),
  address: z.string().min(1, "Required"),
  cityStateZip: z.string().min(1, "Required"),
  filingStatus: z.enum(["single", "married_filing_jointly", "head_of_household"], { required_error: "Required" }),
  multipleJobsCheckbox: z.boolean().optional(),
  step2bWorksheetResult: z.string().optional(),
  step3Dependents: z.string().optional(),
  step3OtherDependents: z.string().optional(),
  step3Total: z.string().optional(),
  step4aOtherIncome: z.string().optional(),
  step4bDeductions: z.string().optional(),
  step4cExtraWithholding: z.string().optional(),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signDate: z.string().min(1, "Required"),
});

type W4FormValues = z.infer<typeof w4Schema>;

interface W4FormProps {
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
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 120 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = "120px";
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.scale(dpr, dpr); ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
    };
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, []);

  useEffect(() => {
    if (value && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const img = new window.Image();
        img.onload = () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height); ctx.restore(); setHasDrawn(true); };
        img.src = value;
      }
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setIsDrawing(true); setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
  };

  const stopDrawing = useCallback(() => {
    if (isDrawing && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
    setIsDrawing(false);
  }, [isDrawing, onChange]);

  useEffect(() => {
    window.addEventListener("mouseup", stopDrawing);
    window.addEventListener("touchend", stopDrawing);
    return () => { window.removeEventListener("mouseup", stopDrawing); window.removeEventListener("touchend", stopDrawing); };
  }, [stopDrawing]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    setHasDrawn(false); onChange("");
  };

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

export default function W4Form({ submissionId, employeeId, onComplete, readOnly }: W4FormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  const { data: existingData } = useQuery({
    queryKey: ["/api/onboarding-forms", submissionId],
    enabled: !!submissionId,
  });

  const form = useForm<W4FormValues>({
    resolver: zodResolver(w4Schema),
    defaultValues: {
      firstName: "", lastName: "", ssn: "", address: "", cityStateZip: "",
      filingStatus: undefined, multipleJobsCheckbox: false,
      step2bWorksheetResult: "", step3Dependents: "", step3OtherDependents: "", step3Total: "",
      step4aOtherIncome: "", step4bDeductions: "", step4cExtraWithholding: "",
      signatureDataUrl: "", signDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (existingData && (existingData as any).submissionData) {
      const data = (existingData as any).submissionData;
      Object.keys(data).forEach((key) => {
        form.setValue(key as any, data[key]);
      });
    }
  }, [existingData, form]);

  const dependents = parseFloat(form.watch("step3Dependents") || "0") || 0;
  const otherDependents = parseFloat(form.watch("step3OtherDependents") || "0") || 0;

  useEffect(() => {
    const total = (dependents * 2000) + (otherDependents * 500);
    form.setValue("step3Total", total > 0 ? total.toString() : "");
  }, [dependents, otherDependents, form]);

  const submitMutation = useMutation({
    mutationFn: async (values: W4FormValues) => {
      const body = { formType: "w4", employeeId, submissionData: values, status: "submitted", submittedAt: new Date() };
      if (submissionId) {
        return apiRequest("PATCH", `/api/onboarding-forms/${submissionId}`, body);
      }
      return apiRequest("POST", "/api/onboarding-forms", body);
    },
    onSuccess: () => {
      toast({ title: "W-4 Submitted", description: "Your W-4 form has been submitted successfully." });
      onComplete?.();
    },
    onError: () => { toast({ title: "Error", description: "Failed to submit W-4 form.", variant: "destructive" }); },
  });

  const onSubmit = (values: W4FormValues) => submitMutation.mutate(values);
  const errors = form.formState.errors;
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="w4-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Form W-4 (2024) — Employee's Withholding Certificate</span>
            {errorCount > 0 && <Badge variant="destructive" data-testid="w4-error-count">{errorCount} missing field{errorCount > 1 ? "s" : ""}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 mb-4">
            {[1,2,3,4,5].map(s => (
              <Button key={s} type="button" variant={currentStep === s ? "default" : "outline"} size="sm" onClick={() => setCurrentStep(s)} data-testid={`w4-step-${s}`}>
                Step {s}
              </Button>
            ))}
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 1: Personal Information & Filing Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={errors.firstName ? "text-red-500" : ""}>First Name *</Label>
                  <Input {...form.register("firstName")} disabled={readOnly} data-testid="w4-first-name" className={errors.firstName ? "border-red-500" : ""} />
                </div>
                <div>
                  <Label className={errors.lastName ? "text-red-500" : ""}>Last Name *</Label>
                  <Input {...form.register("lastName")} disabled={readOnly} data-testid="w4-last-name" className={errors.lastName ? "border-red-500" : ""} />
                </div>
              </div>
              <div>
                <Label className={errors.ssn ? "text-red-500" : ""}>Social Security Number *</Label>
                <Input {...form.register("ssn")} disabled={readOnly} data-testid="w4-ssn" className={errors.ssn ? "border-red-500" : ""} placeholder="XXX-XX-XXXX" />
              </div>
              <div>
                <Label className={errors.address ? "text-red-500" : ""}>Address *</Label>
                <Input {...form.register("address")} disabled={readOnly} data-testid="w4-address" className={errors.address ? "border-red-500" : ""} />
              </div>
              <div>
                <Label className={errors.cityStateZip ? "text-red-500" : ""}>City, State, ZIP *</Label>
                <Input {...form.register("cityStateZip")} disabled={readOnly} data-testid="w4-city-state-zip" className={errors.cityStateZip ? "border-red-500" : ""} />
              </div>
              <div>
                <Label className={errors.filingStatus ? "text-red-500" : ""}>Filing Status *</Label>
                <RadioGroup value={form.watch("filingStatus")} onValueChange={(v) => form.setValue("filingStatus", v as any, { shouldValidate: true })} disabled={readOnly} data-testid="w4-filing-status">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="single" id="single" data-testid="w4-filing-single" /><Label htmlFor="single">Single or Married filing separately</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="married_filing_jointly" id="mfj" data-testid="w4-filing-mfj" /><Label htmlFor="mfj">Married filing jointly</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="head_of_household" id="hoh" data-testid="w4-filing-hoh" /><Label htmlFor="hoh">Head of household</Label></div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 2: Multiple Jobs or Spouse Works</h3>
              <p className="text-sm text-muted-foreground">Complete this step if you (1) hold more than one job at a time, or (2) are married filing jointly and your spouse also works.</p>
              <div className="flex items-center space-x-2">
                <Checkbox checked={form.watch("multipleJobsCheckbox")} onCheckedChange={(v) => form.setValue("multipleJobsCheckbox", !!v)} disabled={readOnly} data-testid="w4-multiple-jobs" />
                <Label>Check here if you have two jobs total or your spouse also works</Label>
              </div>
              <div>
                <Label>Step 2(b) Worksheet Result (optional)</Label>
                <Input {...form.register("step2bWorksheetResult")} disabled={readOnly} data-testid="w4-step2b" placeholder="$" />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 3: Claim Dependents</h3>
              <div>
                <Label>Number of qualifying children under age 17 (× $2,000)</Label>
                <Input {...form.register("step3Dependents")} disabled={readOnly} data-testid="w4-dependents" type="number" />
              </div>
              <div>
                <Label>Number of other dependents (× $500)</Label>
                <Input {...form.register("step3OtherDependents")} disabled={readOnly} data-testid="w4-other-dependents" type="number" />
              </div>
              <div>
                <Label>Total (auto-calculated)</Label>
                <Input value={form.watch("step3Total") ? `$${form.watch("step3Total")}` : ""} disabled data-testid="w4-step3-total" />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 4: Other Adjustments</h3>
              <div>
                <Label>4(a) Other income (not from jobs)</Label>
                <Input {...form.register("step4aOtherIncome")} disabled={readOnly} data-testid="w4-other-income" placeholder="$" />
              </div>
              <div>
                <Label>4(b) Deductions</Label>
                <Input {...form.register("step4bDeductions")} disabled={readOnly} data-testid="w4-deductions" placeholder="$" />
              </div>
              <div>
                <Label>4(c) Extra withholding per pay period</Label>
                <Input {...form.register("step4cExtraWithholding")} disabled={readOnly} data-testid="w4-extra-withholding" placeholder="$" />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 5: Sign Here</h3>
              <p className="text-sm text-muted-foreground">Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.</p>
              <div>
                <Label className={errors.signatureDataUrl ? "text-red-500" : ""}>Signature *</Label>
                {!readOnly && <SignaturePad value={form.watch("signatureDataUrl")} onChange={(v) => form.setValue("signatureDataUrl", v, { shouldValidate: true })} testId="w4-signature" />}
                {readOnly && form.watch("signatureDataUrl") && <img src={form.watch("signatureDataUrl")} alt="Signature" className="border rounded h-[120px]" />}
              </div>
              <div>
                <Label className={errors.signDate ? "text-red-500" : ""}>Date *</Label>
                <Input {...form.register("signDate")} type="date" disabled={readOnly} data-testid="w4-sign-date" className={errors.signDate ? "border-red-500" : ""} />
              </div>
            </div>
          )}

          {!readOnly && (
            <Button type="submit" disabled={submitMutation.isPending} data-testid="w4-submit" className="w-full">
              {submitMutation.isPending ? "Submitting..." : "Submit W-4"}
            </Button>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

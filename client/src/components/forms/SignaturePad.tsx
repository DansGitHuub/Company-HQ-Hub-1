import React, { useRef, useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  testId?: string;
}

export default function SignaturePad({ value, onChange, height = 110, testId = "signature-pad" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [height]);

  useEffect(() => {
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, [syncSize]);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const commitSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && isDrawingRef.current) {
      onChange(canvas.toDataURL("image/png"));
    }
    isDrawingRef.current = false;
  }, [onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    commitSignature();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasDrawn(false);
    onChange("");
  };

  return (
    <div>
      <div ref={containerRef} className="rounded-lg border-2 border-muted-foreground/20 bg-white relative overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ display: "block" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-testid={testId}
        />
        <div className="absolute pointer-events-none" style={{ bottom: 8, left: 12, right: 12, borderTop: "1px solid rgba(0,0,0,0.12)" }} />
        <div className="absolute pointer-events-none text-[10px] text-muted-foreground/40" style={{ bottom: 3, left: 12 }}>
          Sign above the line
        </div>
      </div>
      {hasDrawn && (
        <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-1 h-6 text-xs text-muted-foreground" data-testid={`${testId}-clear`}>
          Clear signature
        </Button>
      )}
    </div>
  );
}

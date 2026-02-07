import React from "react";
import { toast } from "@/hooks/use-toast";
import { getErrorInfo } from "@shared/errorCodes";
import { ApiError } from "./queryClient";

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function createErrorDescription(errorCode: string, description: string, fix: string) {
  const copyText = `Error ${errorCode}: ${description}`;

  return React.createElement("div", { className: "flex flex-col gap-2 mt-1" },
    React.createElement("div", { className: "text-sm opacity-90" }, description),
    React.createElement("div", { className: "text-sm opacity-75 italic" }, `Fix: ${fix}`),
    React.createElement("div", {
      className: "flex items-center gap-2 mt-1 bg-black/20 rounded px-2 py-1.5 cursor-pointer select-all font-mono text-xs",
      "data-testid": "error-code-copy-block",
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        copyToClipboard(copyText).then(() => {
          el.textContent = "Copied!";
          setTimeout(() => {
            el.textContent = errorCode;
          }, 1500);
        }).catch(() => {
          el.textContent = "Copied!";
          setTimeout(() => {
            el.textContent = errorCode;
          }, 1500);
        });
      }
    }, errorCode)
  );
}

export function showErrorToast(error: unknown, fallbackTitle?: string) {
  let errorCode: string | undefined;
  let message: string;

  if (error instanceof ApiError) {
    errorCode = error.errorCode;
    message = error.serverMessage || error.message;
  } else if (error instanceof Error) {
    message = error.message;
    const codeMatch = message.match(/\b([A-Z]{2,5}-\d{3})\b/);
    if (codeMatch) errorCode = codeMatch[1];
  } else {
    message = String(error);
  }

  if (errorCode) {
    const info = getErrorInfo(errorCode);

    toast({
      title: `${fallbackTitle || "Error"} [${errorCode}]`,
      description: createErrorDescription(errorCode, info.description, info.fix) as any,
      variant: "destructive",
    });
  } else {
    toast({
      title: fallbackTitle || "Error",
      description: message,
      variant: "destructive",
    });
  }
}

export function showApiErrorToast(error: unknown, context: string) {
  showErrorToast(error, context);
}

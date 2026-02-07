import React from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { getErrorInfo } from "@shared/errorCodes";
import { ApiError } from "./queryClient";

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
    const copyText = `Error ${errorCode}: ${info.description}`;

    toast({
      title: `${fallbackTitle || "Error"} [${errorCode}]`,
      description: `${info.description}\n\nFix: ${info.fix}`,
      variant: "destructive",
      action: React.createElement(
        ToastAction,
        {
          altText: "Copy error code",
          onClick: () => {
            navigator.clipboard.writeText(copyText).catch(() => {});
          },
        },
        "Copy"
      ) as ToastActionElement,
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

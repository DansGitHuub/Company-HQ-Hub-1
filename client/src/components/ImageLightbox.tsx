import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/**
 * Reusable full-screen image lightbox.
 * - Dimmed backdrop (click to close)
 * - Max 90vw × 90vh, object-contain
 * - Escape key closes
 * - Rendered into document.body via portal so z-index is never clipped
 */
export function ImageLightbox({ src, alt = "Image", onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="lightbox-backdrop"
    >
      {/* Inner wrapper stops click-through from closing on img click */}
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute -top-3 -right-3 z-10 rounded-full bg-white shadow-md p-1 text-gray-700 hover:text-black transition-colors"
          onClick={onClose}
          data-testid="btn-close-lightbox"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          data-testid="lightbox-image"
        />
      </div>
    </div>,
    document.body
  );
}

import React from "react";

// ─── Theme System ─────────────────────────────────────────────────────────────

export interface FormTheme {
  id: number;
  name: string;
  description: string;
  headerStyle: React.CSSProperties;
  accentColor: string;
  companyTextColor: string;
  titleColor: string;
  descriptionColor: string;
  modeBadgeBg: { submitted: string; fill: string; preview: string };
  modeBadgeText: { submitted: string; fill: string; preview: string };
  submitBtnClass: string;
  footerBg: string;
  previewSwatch: string;
}

export const FORM_THEMES: FormTheme[] = [
  {
    id: 0,
    name: "Classic",
    description: "Dark slate with a professional blue accent",
    headerStyle: { background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)" },
    accentColor: "#3b82f6",
    companyTextColor: "#94a3b8",
    titleColor: "#ffffff",
    descriptionColor: "#94a3b8",
    modeBadgeBg: { submitted: "rgba(34,197,94,0.15)", fill: "rgba(59,130,246,0.15)", preview: "rgba(100,116,139,0.2)" },
    modeBadgeText: { submitted: "#86efac", fill: "#93c5fd", preview: "#94a3b8" },
    submitBtnClass: "bg-slate-900 hover:bg-slate-700 text-white",
    footerBg: "#f8fafc",
    previewSwatch: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
  },
  {
    id: 1,
    name: "Forest",
    description: "Deep greens — natural and on-brand for landscaping",
    headerStyle: { background: "linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)" },
    accentColor: "#a3e635",
    companyTextColor: "#86efac",
    titleColor: "#ffffff",
    descriptionColor: "#86efac",
    modeBadgeBg: { submitted: "rgba(163,230,53,0.15)", fill: "rgba(134,239,172,0.12)", preview: "rgba(100,116,139,0.2)" },
    modeBadgeText: { submitted: "#a3e635", fill: "#86efac", preview: "#94a3b8" },
    submitBtnClass: "bg-green-900 hover:bg-green-800 text-white",
    footerBg: "#f0fdf4",
    previewSwatch: "linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)",
  },
  {
    id: 2,
    name: "Navy",
    description: "Rich navy and gold — polished and executive",
    headerStyle: { background: "linear-gradient(135deg, #172554 0%, #1e3a8a 55%, #1d4ed8 100%)" },
    accentColor: "#fbbf24",
    companyTextColor: "#bfdbfe",
    titleColor: "#ffffff",
    descriptionColor: "#93c5fd",
    modeBadgeBg: { submitted: "rgba(251,191,36,0.15)", fill: "rgba(147,197,253,0.12)", preview: "rgba(100,116,139,0.2)" },
    modeBadgeText: { submitted: "#fde68a", fill: "#bfdbfe", preview: "#94a3b8" },
    submitBtnClass: "bg-blue-950 hover:bg-blue-900 text-white",
    footerBg: "#eff6ff",
    previewSwatch: "linear-gradient(135deg, #172554 0%, #1e3a8a 55%, #1d4ed8 100%)",
  },
  {
    id: 3,
    name: "Minimal",
    description: "Clean white header — uncluttered and modern",
    headerStyle: { background: "#ffffff", borderBottom: "2px solid #e2e8f0" },
    accentColor: "#0f172a",
    companyTextColor: "#64748b",
    titleColor: "#0f172a",
    descriptionColor: "#64748b",
    modeBadgeBg: { submitted: "rgba(16,185,129,0.1)", fill: "rgba(99,102,241,0.08)", preview: "rgba(100,116,139,0.1)" },
    modeBadgeText: { submitted: "#059669", fill: "#6366f1", preview: "#64748b" },
    submitBtnClass: "bg-slate-900 hover:bg-slate-800 text-white",
    footerBg: "#f8fafc",
    previewSwatch: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
  },
  {
    id: 4,
    name: "Warm",
    description: "Rich amber tones — approachable and distinct",
    headerStyle: { background: "linear-gradient(135deg, #451a03 0%, #92400e 55%, #b45309 100%)" },
    accentColor: "#fde68a",
    companyTextColor: "#fcd34d",
    titleColor: "#ffffff",
    descriptionColor: "#fcd34d",
    modeBadgeBg: { submitted: "rgba(253,230,138,0.15)", fill: "rgba(252,211,77,0.12)", preview: "rgba(100,116,139,0.2)" },
    modeBadgeText: { submitted: "#fde68a", fill: "#fcd34d", preview: "#94a3b8" },
    submitBtnClass: "bg-amber-900 hover:bg-amber-800 text-white",
    footerBg: "#fffbeb",
    previewSwatch: "linear-gradient(135deg, #451a03 0%, #92400e 55%, #b45309 100%)",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "checkbox"
    | "radio"
    | "date"
    | "email"
    | "phone"
    | "signature";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  value?: string | string[] | boolean;
}

interface FormTemplateProps {
  formTitle: string;
  formDescription?: string;
  companyName?: string;
  logoUrl?: string;
  fields: FormField[];
  submittedBy?: string;
  submittedAt?: string;
  mode: "fill" | "preview" | "submitted";
  variant?: number;
  onSubmit?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isSubmitted = (mode: string) => mode === "submitted";
const isFill = (mode: string) => mode === "fill";

const asString = (v?: string | string[] | boolean): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};

const asArray = (v?: string | string[] | boolean): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [String(v)];
};

const asBoolean = (v?: string | string[] | boolean): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "on" || v === "1";
  return false;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const RequiredBadge = () => (
  <span className="ml-2 inline-block rounded-sm bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-red-500 print:text-red-400">
    Required
  </span>
);

const BlankLine = ({ label }: { label: string }) => (
  <span className="text-slate-300 print:text-slate-200">{label || "—"}</span>
);

const ReadOnlyBox = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-[2.25rem] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 print:border-slate-300 print:bg-white">
    {children}
  </div>
);

const FieldRenderer: React.FC<{ field: FormField; mode: string }> = ({ field, mode }) => {
  const baseInput =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500 print:border-slate-400 print:focus:ring-0";

  if (isSubmitted(mode)) {
    if (field.type === "checkbox") {
      return (
        <ReadOnlyBox>
          <span className={`font-medium ${asBoolean(field.value) ? "text-green-700" : "text-slate-400"}`}>
            {asBoolean(field.value) ? "✓ Yes" : "✗ No"}
          </span>
        </ReadOnlyBox>
      );
    }
    if (field.type === "radio" || field.type === "select") {
      const selected = asString(field.value);
      return (
        <ReadOnlyBox>
          {selected ? (
            <span className="font-medium text-slate-800">{selected}</span>
          ) : (
            <BlankLine label="No selection" />
          )}
        </ReadOnlyBox>
      );
    }
    if (field.type === "signature") {
      const sig = asString(field.value);
      return (
        <div className="flex min-h-[4rem] items-end rounded-md border border-slate-200 bg-slate-50 px-4 py-2 print:border-slate-300 print:bg-white">
          {sig ? (
            <span className="text-2xl italic text-slate-800" style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive" }}>
              {sig}
            </span>
          ) : (
            <BlankLine label="No signature provided" />
          )}
        </div>
      );
    }
    if (field.type === "textarea") {
      return (
        <ReadOnlyBox>
          <div className="whitespace-pre-wrap">{asString(field.value) || <BlankLine label="No response" />}</div>
        </ReadOnlyBox>
      );
    }
    return <ReadOnlyBox>{asString(field.value) || <BlankLine label="—" />}</ReadOnlyBox>;
  }

  const disabled = !isFill(mode);

  if (field.type === "textarea") {
    return (
      <textarea
        id={field.id} name={field.id} rows={4}
        placeholder={field.placeholder ?? "Enter your response…"}
        required={field.required} disabled={disabled}
        defaultValue={asString(field.value)}
        className={`${baseInput} resize-y`}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select id={field.id} name={field.id} required={field.required} disabled={disabled} defaultValue={asString(field.value)} className={baseInput}>
        <option value="" disabled>{field.placeholder ?? "Select an option…"}</option>
        {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (field.type === "radio") {
    const selected = asString(field.value);
    return (
      <div className="mt-1 flex flex-col gap-2">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input type="radio" name={field.id} value={opt} defaultChecked={selected === opt} disabled={disabled} className="h-4 w-4 accent-blue-600" />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    if (field.options && field.options.length > 0) {
      const checked = asArray(field.value);
      return (
        <div className="mt-1 flex flex-col gap-2">
          {field.options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" name={field.id} value={opt} defaultChecked={checked.includes(opt)} disabled={disabled} className="h-4 w-4 accent-blue-600" />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    return (
      <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
        <input type="checkbox" name={field.id} defaultChecked={asBoolean(field.value)} disabled={disabled} className="h-4 w-4 accent-blue-600" />
        {field.placeholder ?? field.label}
      </label>
    );
  }

  if (field.type === "signature") {
    return (
      <div className="relative">
        <input
          type="text" id={field.id} name={field.id}
          placeholder={field.placeholder ?? "Type your full legal name as signature"}
          required={field.required} disabled={disabled}
          defaultValue={asString(field.value)}
          style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive", fontSize: "1.35rem" }}
          className={`${baseInput} italic tracking-wide`}
        />
        <div className="mt-1 border-t-2 border-slate-800 print:border-slate-900" />
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-400">Signature</p>
      </div>
    );
  }

  const htmlType =
    field.type === "phone" ? "tel" :
    field.type === "email" ? "email" :
    field.type === "number" ? "number" :
    field.type === "date" ? "date" : "text";

  return (
    <input
      type={htmlType} id={field.id} name={field.id}
      placeholder={field.placeholder ?? ""}
      required={field.required} disabled={disabled}
      defaultValue={asString(field.value)}
      className={baseInput}
    />
  );
};

// ─── Field List ───────────────────────────────────────────────────────────────

const FieldList: React.FC<{ fields: FormField[]; mode: string }> = ({ fields, mode }) => (
  <>
    {fields.map((field, idx) => (
      <div key={field.id} className="group relative" style={{ pageBreakInside: "avoid" }}>
        <div className="absolute -left-5 top-0 h-full w-px bg-blue-200 opacity-0 transition-opacity group-hover:opacity-100 print:hidden" />
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor={field.id} className="flex items-baseline gap-1 text-sm font-semibold text-slate-700">
            <span className="mr-1 text-[11px] font-normal text-slate-400">{String(idx + 1).padStart(2, "0")}.</span>
            {field.label}
            {field.required && <RequiredBadge />}
          </label>
          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 print:hidden">
            {field.type}
          </span>
        </div>
        <FieldRenderer field={field} mode={mode} />
      </div>
    ))}
  </>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const FormTemplate: React.FC<FormTemplateProps> = ({
  formTitle, formDescription, companyName, logoUrl,
  fields, submittedBy, submittedAt, mode, variant = 0, onSubmit,
}) => {
  const theme = FORM_THEMES[variant] ?? FORM_THEMES[0];

  const formattedDate = submittedAt
    ? (() => {
        try {
          return new Date(submittedAt).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
          });
        } catch { return submittedAt; }
      })()
    : null;

  const isMinimal = variant === 3;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.85in 0.75in; size: letter; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white print:p-0">
        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-[0_4px_32px_rgba(0,0,0,0.10)] print:max-w-none print:rounded-none print:shadow-none">

          {/* HEADER */}
          <header
            className="relative overflow-hidden px-10 py-9"
            style={theme.headerStyle}
          >
            {/* Accent bar */}
            <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: theme.accentColor }} />

            {/* Logo + company */}
            {(logoUrl || companyName) && (
              <div className="mb-6 flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt={companyName ?? "Company logo"} className="h-9 w-auto object-contain" />}
                {companyName && (
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: theme.companyTextColor }}>
                    {companyName}
                  </span>
                )}
              </div>
            )}

            {/* Form title */}
            <h1
              className="text-2xl font-bold leading-tight tracking-tight"
              style={{
                color: theme.titleColor,
                fontFamily: variant === 3 ? "'Inter','Helvetica Neue',sans-serif" : "'Georgia','Times New Roman',serif",
              }}
            >
              {formTitle}
            </h1>

            {/* Description */}
            {formDescription && (
              <p className="mt-2 max-w-prose text-sm leading-relaxed" style={{ color: theme.descriptionColor }}>
                {formDescription}
              </p>
            )}

            {/* Mode badge */}
            <div className="mt-5 flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
                style={{
                  backgroundColor: mode === "submitted" ? theme.modeBadgeBg.submitted :
                    mode === "fill" ? theme.modeBadgeBg.fill : theme.modeBadgeBg.preview,
                  color: mode === "submitted" ? theme.modeBadgeText.submitted :
                    mode === "fill" ? theme.modeBadgeText.fill : theme.modeBadgeText.preview,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: mode === "submitted" ? theme.modeBadgeText.submitted :
                      mode === "fill" ? theme.modeBadgeText.fill : theme.modeBadgeText.preview,
                  }}
                />
                {mode === "submitted" ? "Submitted" : mode === "fill" ? "Interactive" : "Preview"}
              </span>
              <span className="text-xs" style={{ color: theme.descriptionColor }}>
                {fields.length} field{fields.length !== 1 ? "s" : ""}
              </span>
            </div>
          </header>

          {/* FORM BODY */}
          <main className="px-10 py-9">
            {isFill(mode) ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit?.();
                }}
                className="space-y-7"
              >
                <FieldList fields={fields} mode={mode} />
                <div className="no-print pt-2">
                  <button
                    type="submit"
                    className={`w-full rounded-lg px-6 py-3 text-sm font-semibold tracking-wide transition hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.submitBtnClass}`}
                  >
                    Submit Form
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-7">
                <FieldList fields={fields} mode={mode} />
              </div>
            )}
          </main>

          {/* FOOTER (submitted mode only) */}
          {isSubmitted(mode) && (submittedBy || formattedDate) && (
            <footer className="border-t border-slate-200 px-10 py-6 print:bg-white" style={{ backgroundColor: theme.footerBg }}>
              <div className="flex flex-wrap items-start justify-between gap-6">
                {submittedBy && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Submitted By</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{submittedBy}</p>
                  </div>
                )}
                {formattedDate && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Date Submitted</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{formattedDate}</p>
                  </div>
                )}
              </div>

              <div className="mt-8 hidden print:block">
                <div className="flex items-end justify-between gap-16">
                  <div className="flex-1">
                    <div className="border-b border-slate-400 pb-1" />
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">Authorized Signature</p>
                  </div>
                  <div className="flex-1">
                    <div className="border-b border-slate-400 pb-1" />
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">Date</p>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-center text-[10px] text-slate-300 print:text-slate-400">
                {companyName && `${companyName} · `}{formTitle} · {formattedDate ?? new Date().toLocaleDateString()}
              </p>
            </footer>
          )}

        </div>
      </div>
    </>
  );
};

export default FormTemplate;

import React from "react";

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

/** Pill badge shown next to required labels */
const RequiredBadge = () => (
  <span className="ml-2 inline-block rounded-sm bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-red-500 print:text-red-400">
    Required
  </span>
);

/** Dimmed placeholder text for blank preview/fill fields */
const BlankLine = ({ label }: { label: string }) => (
  <span className="text-slate-300 print:text-slate-200">
    {label || "—"}
  </span>
);

// ─── Field Renderers ──────────────────────────────────────────────────────────

/** Read-only value box used in "submitted" mode */
const ReadOnlyBox = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-[2.25rem] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 print:border-slate-300 print:bg-white">
    {children}
  </div>
);

/** Render a single field based on mode & type */
const FieldRenderer: React.FC<{ field: FormField; mode: string }> = ({
  field,
  mode,
}) => {
  const baseInput =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500 print:border-slate-400 print:focus:ring-0";

  // ── submitted ──────────────────────────────────────────────────────────────
  if (isSubmitted(mode)) {
    if (field.type === "checkbox") {
      return (
        <ReadOnlyBox>
          <span
            className={`font-medium ${
              asBoolean(field.value) ? "text-green-700" : "text-slate-400"
            }`}
          >
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
            <span
              className="font-['Brush_Script_MT',_cursive] text-2xl italic text-slate-800"
              style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
            >
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
          <div className="whitespace-pre-wrap">
            {asString(field.value) || <BlankLine label="No response" />}
          </div>
        </ReadOnlyBox>
      );
    }

    return (
      <ReadOnlyBox>
        {asString(field.value) || <BlankLine label="—" />}
      </ReadOnlyBox>
    );
  }

  // ── fill / preview ─────────────────────────────────────────────────────────
  const disabled = !isFill(mode);

  if (field.type === "textarea") {
    return (
      <textarea
        id={field.id}
        name={field.id}
        rows={4}
        placeholder={field.placeholder ?? "Enter your response…"}
        required={field.required}
        disabled={disabled}
        defaultValue={asString(field.value)}
        className={`${baseInput} resize-y`}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={field.id}
        name={field.id}
        required={field.required}
        disabled={disabled}
        defaultValue={asString(field.value)}
        className={baseInput}
      >
        <option value="" disabled>
          {field.placeholder ?? "Select an option…"}
        </option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    const selected = asString(field.value);
    return (
      <div className="mt-1 flex flex-col gap-2">
        {(field.options ?? []).map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700"
          >
            <input
              type="radio"
              name={field.id}
              value={opt}
              defaultChecked={selected === opt}
              disabled={disabled}
              className="h-4 w-4 accent-blue-600"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    // Multi-checkbox (options array) vs single boolean checkbox
    if (field.options && field.options.length > 0) {
      const checked = asArray(field.value);
      return (
        <div className="mt-1 flex flex-col gap-2">
          {field.options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name={field.id}
                value={opt}
                defaultChecked={checked.includes(opt)}
                disabled={disabled}
                className="h-4 w-4 accent-blue-600"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }

    return (
      <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          name={field.id}
          defaultChecked={asBoolean(field.value)}
          disabled={disabled}
          className="h-4 w-4 accent-blue-600"
        />
        {field.placeholder ?? field.label}
      </label>
    );
  }

  if (field.type === "signature") {
    return (
      <div className="relative">
        <input
          type="text"
          id={field.id}
          name={field.id}
          placeholder={field.placeholder ?? "Type your full legal name as signature"}
          required={field.required}
          disabled={disabled}
          defaultValue={asString(field.value)}
          style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: "1.35rem" }}
          className={`${baseInput} italic tracking-wide`}
        />
        <div className="mt-1 border-t-2 border-slate-800 print:border-slate-900" />
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-400">
          Signature
        </p>
      </div>
    );
  }

  // text | number | date | email | phone
  const htmlType =
    field.type === "phone"
      ? "tel"
      : field.type === "email"
      ? "email"
      : field.type === "number"
      ? "number"
      : field.type === "date"
      ? "date"
      : "text";

  return (
    <input
      type={htmlType}
      id={field.id}
      name={field.id}
      placeholder={field.placeholder ?? ""}
      required={field.required}
      disabled={disabled}
      defaultValue={asString(field.value)}
      className={baseInput}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const FormTemplate: React.FC<FormTemplateProps> = ({
  formTitle,
  formDescription,
  companyName,
  logoUrl,
  fields,
  submittedBy,
  submittedAt,
  mode,
}) => {
  // Format the submitted date nicely
  const formattedDate = submittedAt
    ? (() => {
        try {
          return new Date(submittedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return submittedAt;
        }
      })()
    : null;

  return (
    <>
      {/* ── Print styles injected via <style> ── */}
      <style>{`
        @media print {
          @page {
            margin: 0.85in 0.75in;
            size: letter;
          }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 px-4 py-10 print:bg-white print:p-0">
        <div
          className="
            mx-auto w-full max-w-3xl
            overflow-hidden rounded-xl
            bg-white shadow-[0_4px_32px_rgba(0,0,0,0.10)]
            print:max-w-none print:rounded-none print:shadow-none
          "
        >
          {/* ════════════════════════════════════════════════════
              HEADER
          ════════════════════════════════════════════════════ */}
          <header className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-10 py-9 print:bg-slate-900">
            {/* Decorative accent bar */}
            <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 print:bg-blue-600" />

            {/* Top row: logo + company */}
            {(logoUrl || companyName) && (
              <div className="mb-6 flex items-center gap-3">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={companyName ?? "Company logo"}
                    className="h-9 w-auto object-contain"
                  />
                )}
                {companyName && (
                  <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                    {companyName}
                  </span>
                )}
              </div>
            )}

            {/* Form title */}
            <h1
              className="text-2xl font-bold leading-tight tracking-tight text-white"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            >
              {formTitle}
            </h1>

            {/* Description */}
            {formDescription && (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
                {formDescription}
              </p>
            )}

            {/* Mode badge */}
            <div className="mt-5 flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest
                  ${
                    mode === "submitted"
                      ? "bg-green-500/20 text-green-300"
                      : mode === "fill"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-slate-500/30 text-slate-300"
                  }
                `}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    mode === "submitted"
                      ? "bg-green-400"
                      : mode === "fill"
                      ? "bg-blue-400"
                      : "bg-slate-400"
                  }`}
                />
                {mode === "submitted"
                  ? "Submitted"
                  : mode === "fill"
                  ? "Interactive"
                  : "Preview"}
              </span>

              <span className="text-xs text-slate-500">
                {fields.length} field{fields.length !== 1 ? "s" : ""}
              </span>
            </div>
          </header>

          {/* ════════════════════════════════════════════════════
              FORM BODY
          ════════════════════════════════════════════════════ */}
          <main className="px-10 py-9">
            {isFill(mode) ? (
              <form
                noValidate
                onSubmit={(e) => e.preventDefault()}
                className="space-y-7"
              >
                <FieldList fields={fields} mode={mode} />

                {/* Submit button — screen only */}
                <div className="no-print pt-2">
                  <button
                    type="submit"
                    className="
                      w-full rounded-lg bg-slate-900 px-6 py-3
                      text-sm font-semibold tracking-wide text-white
                      transition hover:bg-slate-700 active:scale-[0.99]
                      focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2
                    "
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

          {/* ════════════════════════════════════════════════════
              FOOTER (submitted mode only)
          ════════════════════════════════════════════════════ */}
          {isSubmitted(mode) && (submittedBy || formattedDate) && (
            <footer className="border-t border-slate-200 bg-slate-50 px-10 py-6 print:bg-white">
              <div className="flex flex-wrap items-start justify-between gap-6">
                {/* Submitted by */}
                {submittedBy && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                      Submitted By
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {submittedBy}
                    </p>
                  </div>
                )}

                {/* Submitted at */}
                {formattedDate && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                      Date Submitted
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {formattedDate}
                    </p>
                  </div>
                )}
              </div>

              {/* Signature line for print */}
              <div className="mt-8 hidden print:block">
                <div className="flex items-end justify-between gap-16">
                  <div className="flex-1">
                    <div className="border-b border-slate-400 pb-1" />
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">
                      Authorized Signature
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="border-b border-slate-400 pb-1" />
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">
                      Date
                    </p>
                  </div>
                </div>
              </div>

              {/* Document ID watermark */}
              <p className="mt-6 text-center text-[10px] text-slate-300 print:text-slate-400">
                {companyName && `${companyName} · `}
                {formTitle} ·{" "}
                {formattedDate ?? new Date().toLocaleDateString()}
              </p>
            </footer>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Field List ────────────────────────────────────────────────────────────────

const FieldList: React.FC<{ fields: FormField[]; mode: string }> = ({
  fields,
  mode,
}) => (
  <>
    {fields.map((field, idx) => (
      <div
        key={field.id}
        className="group relative"
        style={{ pageBreakInside: "avoid" }}
      >
        {/* Subtle left rule on hover (screen only) */}
        <div className="absolute -left-5 top-0 h-full w-px bg-blue-200 opacity-0 transition-opacity group-hover:opacity-100 print:hidden" />

        {/* Field index + label row */}
        <div className="mb-1.5 flex items-baseline justify-between">
          <label
            htmlFor={field.id}
            className="flex items-baseline gap-1 text-sm font-semibold text-slate-700"
          >
            <span className="mr-1 text-[11px] font-normal text-slate-400">
              {String(idx + 1).padStart(2, "0")}.
            </span>
            {field.label}
            {field.required && <RequiredBadge />}
          </label>

          {/* Type pill */}
          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 print:hidden">
            {field.type}
          </span>
        </div>

        {/* Field input / display */}
        <FieldRenderer field={field} mode={mode} />
      </div>
    ))}
  </>
);

// ─── Export ───────────────────────────────────────────────────────────────────

export default FormTemplate;

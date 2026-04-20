import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, Loader2, AlertCircle, Clock, Save } from "lucide-react";

const TOKEN = window.location.pathname.split("/apply/")[1]?.split("/")[0] || "";

type AppData = Record<string, string>;

interface JobApplication {
  id: string;
  token: string;
  status: string;
  data: AppData;
  expiresAt: string;
}

// Required fields for submit lock
const REQUIRED_FIELDS: { key: string; label: string }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "streetAddress", label: "Street Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP Code" },
  { key: "dateAvailable", label: "Date Available" },
  { key: "positionAppliedFor", label: "Position Applied For" },
  { key: "usCitizen", label: "US Citizen (Yes/No)" },
  { key: "workedHereBefore", label: "Worked Here Before (Yes/No)" },
  { key: "convictedFelony", label: "Convicted of Felony (Yes/No)" },
  { key: "highSchoolName", label: "High School Name" },
  { key: "ref1FullName", label: "Reference 1 — Full Name" },
  { key: "ref1Phone", label: "Reference 1 — Phone" },
];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-gray-700 mb-1">
      {children}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function Input({
  name, value, onChange, placeholder, type = "text", className = "", disabled = false
}: {
  name: string; value: string; onChange: (name: string, val: string) => void;
  placeholder?: string; type?: string; className?: string; disabled?: boolean;
}) {
  return (
    <input
      data-testid={`input-${name}`}
      type={type}
      value={value}
      onChange={e => onChange(name, e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
    />
  );
}

function TextArea({ name, value, onChange, placeholder, disabled }: {
  name: string; value: string; onChange: (name: string, val: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <textarea
      data-testid={`textarea-${name}`}
      value={value}
      onChange={e => onChange(name, e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
    />
  );
}

function YesNo({ name, value, onChange, disabled }: {
  name: string; value: string; onChange: (name: string, val: string) => void; disabled?: boolean;
}) {
  return (
    <div className="flex gap-4" data-testid={`radio-${name}`}>
      {["Yes", "No"].map(opt => (
        <label key={opt} className={`flex items-center gap-2 cursor-pointer ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => !disabled && onChange(name, opt)}
            disabled={disabled}
            className="accent-green-700 w-4 h-4"
            data-testid={`radio-${name}-${opt.toLowerCase()}`}
          />
          <span className="text-sm font-medium text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-green-800 px-6 py-3">
        <h2 className="text-white font-bold text-sm uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={`grid gap-4 ${cols === 2 ? "grid-cols-1 sm:grid-cols-2" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1"}`}>
      {children}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export default function PublicApplicationForm() {
  const { t } = useTranslation("publicApplication");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [data, setData] = useState<AppData>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load application
  useEffect(() => {
    if (!TOKEN) {
      setError("Invalid application link.");
      setLoading(false);
      return;
    }
    fetch(`/api/apply/${TOKEN}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message || "Link error");
        }
        return r.json();
      })
      .then((app: JobApplication) => {
        setApplication(app);
        setData((app.data as AppData) || {});
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleChange = useCallback((name: string, val: string) => {
    setData(prev => {
      const updated = { ...prev, [name]: val };
      // Debounce autosave
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus("saving");
      debounceRef.current = setTimeout(() => {
        const firstName = updated.firstName || "";
        const lastName = updated.lastName || "";
        fetch(`/api/apply/${TOKEN}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: updated,
            applicantName: `${firstName} ${lastName}`.trim() || undefined,
            applicantEmail: updated.email || undefined,
            applicantPhone: updated.phone || undefined,
            position: updated.positionAppliedFor || undefined,
          }),
        })
          .then(() => setSaveStatus("saved"))
          .catch(() => setSaveStatus("idle"));
      }, 1500);
      return updated;
    });
  }, []);

  // Required field progress — filledRequired declared here (fixes "not defined" crash)
  const missingFields   = REQUIRED_FIELDS.filter(f => !(data[f.key] || "").trim());
  const filledRequired  = REQUIRED_FIELDS.filter(f =>  (data[f.key] || "").trim());
  const remaining = missingFields.length;
  const allFilled = remaining === 0;

  const handleSubmit = async () => {
    if (!signatureName.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/apply/${TOKEN}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...data, signatureName: signatureName.trim(), signatureDate: new Date().toLocaleDateString() } }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b.message || "Submit failed");
      }
      setSubmitted(true);
      setShowSubmitModal(false);
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── States ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-green-700 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-md border border-red-200 p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t("unableToLoad")}</h2>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <p className="text-gray-500 text-xs">If you believe this is a mistake, please contact us at <a href="mailto:office@chapinlandscapes.com" className="text-green-700 underline">office@chapinlandscapes.com</a> or text <a href="tel:4402260518" className="text-green-700 underline">440.226.0518</a>.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-md border border-green-200 p-10 max-w-lg w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-5" />
          <h2 className="text-2xl font-bold text-gray-800 mb-3">{t("thankYou")}</h2>
          <p className="text-gray-600 mb-5 leading-relaxed">
            {t("submitted")}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-700">
            <p className="font-semibold text-green-800 mb-1">{t("needFollowUp")}</p>
            <p>{t("48hours")}</p>
            <p className="mt-2">
              <a href="mailto:office@chapinlandscapes.com" className="text-green-700 underline font-medium">office@chapinlandscapes.com</a>
              <span className="mx-2 text-gray-400">or</span>
              <a href="tel:4402260518" className="text-green-700 underline font-medium">440.226.0518</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isDisabled = application?.status === "submitted";

  // ─── Main Form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-800 text-white py-6 px-4 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Chapin Landscapes</h1>
            <p className="text-green-200 text-sm mt-0.5">{t("employmentApplication")}</p>
          </div>
          <div className="flex items-center gap-2 text-green-200 text-xs">
            {saveStatus === "saving" && (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>{t("saving")}</span></>
            )}
            {saveStatus === "saved" && (
              <><Save className="h-3.5 w-3.5" /><span>{t("saved")}</span></>
            )}
            {application?.expiresAt && (
              <span className="ml-3 flex items-center gap-1 opacity-70">
                <Clock className="h-3 w-3" />
                {t("expires")} {new Date(application.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(filledRequired.length / REQUIRED_FIELDS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {allFilled ? (
                <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> {t("allFieldsComplete")}</span>
              ) : (
                <span className="text-amber-600 font-medium">{remaining} {t("requiredRemaining")}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* APPLICANT INFORMATION */}
        <SectionCard title={t("applicantInfo")}>
          <Row cols={3}>
            <Field>
              <Label required>{t("lastName")}</Label>
              <Input name="lastName" value={data.lastName || ""} onChange={handleChange} placeholder={t("lastName")} disabled={isDisabled} />
            </Field>
            <Field>
              <Label required>{t("firstName")}</Label>
              <Input name="firstName" value={data.firstName || ""} onChange={handleChange} placeholder={t("firstName")} disabled={isDisabled} />
            </Field>
            <Field>
              <Label>{t("mi")}</Label>
              <Input name="mi" value={data.mi || ""} onChange={handleChange} placeholder={t("mi")} disabled={isDisabled} />
            </Field>
          </Row>
          <Field>
            <Label required>{t("streetAddress")}</Label>
            <Input name="streetAddress" value={data.streetAddress || ""} onChange={handleChange} placeholder={t("streetAddress")} disabled={isDisabled} />
          </Field>
          <Row cols={4}>
            <div className="col-span-2 sm:col-span-2">
              <Label required>{t("city")}</Label>
              <Input name="city" value={data.city || ""} onChange={handleChange} placeholder={t("city")} disabled={isDisabled} />
            </div>
            <Field>
              <Label required>{t("state")}</Label>
              <Input name="state" value={data.state || ""} onChange={handleChange} placeholder={t("state")} disabled={isDisabled} />
            </Field>
            <Field>
              <Label required>{t("zip")}</Label>
              <Input name="zip" value={data.zip || ""} onChange={handleChange} placeholder={t("zip")} disabled={isDisabled} />
            </Field>
          </Row>
          <Row>
            <Field>
              <Label required>{t("phone")}</Label>
              <Input name="phone" value={data.phone || ""} onChange={handleChange} placeholder={t("phone")} type="tel" disabled={isDisabled} />
            </Field>
            <Field>
              <Label required>{t("email")}</Label>
              <Input name="email" value={data.email || ""} onChange={handleChange} placeholder={t("email")} type="email" disabled={isDisabled} />
            </Field>
          </Row>
          <Row cols={3}>
            <Field>
              <Label required>{t("dateAvailable")}</Label>
              <Input name="dateAvailable" value={data.dateAvailable || ""} onChange={handleChange} type="date" disabled={isDisabled} />
            </Field>
            <Field>
              <Label>{t("ssn")}</Label>
              <Input name="ssn" value={data.ssn || ""} onChange={handleChange} placeholder="XXX-XX-XXXX" disabled={isDisabled} />
            </Field>
            <Field>
              <Label>{t("desiredSalary")}</Label>
              <Input name="desiredSalary" value={data.desiredSalary || ""} onChange={handleChange} placeholder="$ per hour" disabled={isDisabled} />
            </Field>
          </Row>
          <Field>
            <Label required>{t("positionApplied")}</Label>
            <Input name="positionAppliedFor" value={data.positionAppliedFor || ""} onChange={handleChange} placeholder="e.g. Landscape Crew Member" disabled={isDisabled} />
          </Field>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <Label required>{t("usCitizen")}</Label>
              <YesNo name="usCitizen" value={data.usCitizen || ""} onChange={handleChange} disabled={isDisabled} />
            </div>
            {data.usCitizen === "No" && (
              <div className="flex flex-wrap items-center gap-4 ml-6">
                <Label>{t("authorizedToWork")}</Label>
                <YesNo name="authorizedToWork" value={data.authorizedToWork || ""} onChange={handleChange} disabled={isDisabled} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <Label required>{t("workedHere")}</Label>
              <YesNo name="workedHereBefore" value={data.workedHereBefore || ""} onChange={handleChange} disabled={isDisabled} />
            </div>
            {data.workedHereBefore === "Yes" && (
              <div className="ml-6">
                <Label>{t("ifYesWhen")}</Label>
                <Input name="workedHereWhen" value={data.workedHereWhen || ""} onChange={handleChange} placeholder="Year(s)" disabled={isDisabled} className="max-w-xs" />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <Label required>{t("convictedFelony")}</Label>
              <YesNo name="convictedFelony" value={data.convictedFelony || ""} onChange={handleChange} disabled={isDisabled} />
            </div>
            {data.convictedFelony === "Yes" && (
              <div className="ml-6">
                <Label>{t("ifYesExplain")}</Label>
                <TextArea name="felonyExplanation" value={data.felonyExplanation || ""} onChange={handleChange} placeholder={t("pleaseExplain")} disabled={isDisabled} />
              </div>
            )}
          </div>
        </SectionCard>

        {/* EDUCATION */}
        <SectionCard title={t("education")}>
          {[
            { labelKey: "highSchool", prefix: "highSchool", degreeKey: "diploma", required: true },
            { labelKey: "college", prefix: "college", degreeKey: "degree", required: false },
            { labelKey: "other", prefix: "otherEdu", degreeKey: "degree", required: false },
          ].map(edu => (
            <div key={edu.prefix} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">{t(edu.labelKey)}</h3>
              <Row>
                <Field>
                  <Label required={edu.required}>{t(edu.labelKey)} {t("name")}</Label>
                  <Input name={`${edu.prefix}Name`} value={data[`${edu.prefix}Name`] || ""} onChange={handleChange} placeholder={`${t(edu.labelKey)} ${t("name")}`} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("address")}</Label>
                  <Input name={`${edu.prefix}Address`} value={data[`${edu.prefix}Address`] || ""} onChange={handleChange} placeholder={t("schoolAddress")} disabled={isDisabled} />
                </Field>
              </Row>
              <Row cols={4}>
                <Field>
                  <Label>{t("from")}</Label>
                  <Input name={`${edu.prefix}From`} value={data[`${edu.prefix}From`] || ""} onChange={handleChange} placeholder={t("year")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("to")}</Label>
                  <Input name={`${edu.prefix}To`} value={data[`${edu.prefix}To`] || ""} onChange={handleChange} placeholder={t("year")} disabled={isDisabled} />
                </Field>
                <div className="col-span-2">
                  <Label>{t("didYouGraduate")}</Label>
                  <YesNo name={`${edu.prefix}Graduated`} value={data[`${edu.prefix}Graduated`] || ""} onChange={handleChange} disabled={isDisabled} />
                </div>
              </Row>
              <Field>
                <Label>{t(edu.degreeKey)}</Label>
                <Input name={`${edu.prefix}Degree`} value={data[`${edu.prefix}Degree`] || ""} onChange={handleChange} placeholder={t(edu.degreeKey)} disabled={isDisabled} className="max-w-xs" />
              </Field>
            </div>
          ))}
        </SectionCard>

        {/* REFERENCES */}
        <SectionCard title={t("referencesTitle")}>
          {[1, 2, 3].map(n => (
            <div key={n} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">{t("reference")} {n}</h3>
              <Row>
                <Field>
                  <Label required={n === 1}>{t("fullName")}</Label>
                  <Input name={`ref${n}FullName`} value={data[`ref${n}FullName`] || ""} onChange={handleChange} placeholder={t("fullName")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("relationship")}</Label>
                  <Input name={`ref${n}Relationship`} value={data[`ref${n}Relationship`] || ""} onChange={handleChange} placeholder={t("egSupervisor")} disabled={isDisabled} />
                </Field>
              </Row>
              <Row>
                <Field>
                  <Label>{t("company")}</Label>
                  <Input name={`ref${n}Company`} value={data[`ref${n}Company`] || ""} onChange={handleChange} placeholder={t("company")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label required={n === 1}>{t("phone")}</Label>
                  <Input name={`ref${n}Phone`} value={data[`ref${n}Phone`] || ""} onChange={handleChange} placeholder={t("phone")} type="tel" disabled={isDisabled} />
                </Field>
              </Row>
              <Field>
                <Label>{t("address")}</Label>
                <Input name={`ref${n}Address`} value={data[`ref${n}Address`] || ""} onChange={handleChange} placeholder={t("address")} disabled={isDisabled} />
              </Field>
            </div>
          ))}
        </SectionCard>

        {/* PREVIOUS EMPLOYMENT */}
        <SectionCard title={t("previousEmployment")}>
          {[1, 2, 3].map(n => (
            <div key={n} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">{t("employer")} {n}</h3>
              <Row>
                <Field>
                  <Label required={n === 1}>{t("company")}</Label>
                  <Input name={`emp${n}Company`} value={data[`emp${n}Company`] || ""} onChange={handleChange} placeholder={t("companyName")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label required={n === 1}>{t("phone")}</Label>
                  <Input name={`emp${n}Phone`} value={data[`emp${n}Phone`] || ""} onChange={handleChange} placeholder={t("phone")} type="tel" disabled={isDisabled} />
                </Field>
              </Row>
              <Row>
                <Field>
                  <Label>{t("address")}</Label>
                  <Input name={`emp${n}Address`} value={data[`emp${n}Address`] || ""} onChange={handleChange} placeholder={t("address")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("supervisor")}</Label>
                  <Input name={`emp${n}Supervisor`} value={data[`emp${n}Supervisor`] || ""} onChange={handleChange} placeholder={t("supervisorName")} disabled={isDisabled} />
                </Field>
              </Row>
              <Row cols={3}>
                <Field>
                  <Label>{t("jobTitle")}</Label>
                  <Input name={`emp${n}JobTitle`} value={data[`emp${n}JobTitle`] || ""} onChange={handleChange} placeholder={t("jobTitle")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("startSalary")}</Label>
                  <Input name={`emp${n}StartSalary`} value={data[`emp${n}StartSalary`] || ""} onChange={handleChange} placeholder="$ per hour" disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("endSalary")}</Label>
                  <Input name={`emp${n}EndSalary`} value={data[`emp${n}EndSalary`] || ""} onChange={handleChange} placeholder="$ per hour" disabled={isDisabled} />
                </Field>
              </Row>
              <Field>
                <Label>{t("responsibilities")}</Label>
                <TextArea name={`emp${n}Responsibilities`} value={data[`emp${n}Responsibilities`] || ""} onChange={handleChange} placeholder={t("describeResponsibilities")} disabled={isDisabled} />
              </Field>
              <Row cols={3}>
                <Field>
                  <Label>{t("from")}</Label>
                  <Input name={`emp${n}From`} value={data[`emp${n}From`] || ""} onChange={handleChange} placeholder={t("monthYear")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("to")}</Label>
                  <Input name={`emp${n}To`} value={data[`emp${n}To`] || ""} onChange={handleChange} placeholder={t("monthYear")} disabled={isDisabled} />
                </Field>
                <Field>
                  <Label>{t("reasonLeaving")}</Label>
                  <Input name={`emp${n}ReasonLeaving`} value={data[`emp${n}ReasonLeaving`] || ""} onChange={handleChange} placeholder={t("reason")} disabled={isDisabled} />
                </Field>
              </Row>
              <div className="flex flex-wrap items-center gap-4">
                <Label>{t("contactSupervisor")}</Label>
                <YesNo name={`emp${n}ContactSupervisor`} value={data[`emp${n}ContactSupervisor`] || ""} onChange={handleChange} disabled={isDisabled} />
              </div>
            </div>
          ))}
        </SectionCard>

        {/* MILITARY SERVICE */}
        <SectionCard title={t("militaryService")}>
          <Row cols={3}>
            <Field>
              <Label>{t("branch")}</Label>
              <Input name="militaryBranch" value={data.militaryBranch || ""} onChange={handleChange} placeholder={t("branch")} disabled={isDisabled} />
            </Field>
            <Field>
              <Label>{t("from")}</Label>
              <Input name="militaryFrom" value={data.militaryFrom || ""} onChange={handleChange} placeholder={t("year")} disabled={isDisabled} />
            </Field>
            <Field>
              <Label>{t("to")}</Label>
              <Input name="militaryTo" value={data.militaryTo || ""} onChange={handleChange} placeholder={t("year")} disabled={isDisabled} />
            </Field>
          </Row>
          <Row>
            <Field>
              <Label>{t("rankAtDischarge")}</Label>
              <Input name="militaryRank" value={data.militaryRank || ""} onChange={handleChange} placeholder={t("rank")} disabled={isDisabled} />
            </Field>
            <Field>
              <Label>{t("typeOfDischarge")}</Label>
              <Input name="militaryDischarge" value={data.militaryDischarge || ""} onChange={handleChange} placeholder={t("type")} disabled={isDisabled} />
            </Field>
          </Row>
          <Field>
            <Label>{t("ifNotHonorable")}</Label>
            <TextArea name="militaryDischargeExplanation" value={data.militaryDischargeExplanation || ""} onChange={handleChange} placeholder={t("explanation")} disabled={isDisabled} />
          </Field>
        </SectionCard>

        {/* Submit Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 leading-relaxed mb-5">
            <p className="font-semibold text-gray-700 mb-1">{t("disclaimer")}</p>
            <p>{t("disclaimerText")}</p>
          </div>
          {!allFilled && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 text-sm font-semibold mb-2">
                {t("completeBeforeSubmit")}
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {missingFields.map(f => (
                  <li key={f.key} className="text-amber-700 text-sm">{f.label}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            data-testid="button-submit-application"
            onClick={() => setShowSubmitModal(true)}
            disabled={!allFilled || isDisabled}
            className={`w-full py-3 rounded-lg font-bold text-base transition-all ${
              allFilled && !isDisabled
                ? "bg-green-700 hover:bg-green-800 text-white shadow-md"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isDisabled ? t("applicationSubmitted") : t("submitApplication")}
          </button>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t("confirmSign")}</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 leading-relaxed mb-4">
              {t("disclaimerText")}
            </div>
            <p className="text-sm text-gray-700 mb-2 font-medium">{t("typeSignature")}</p>
            <input
              data-testid="input-signature-name"
              type="text"
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder={t("fullName")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 mb-1 font-serif italic"
              autoFocus
            />
            <p className="text-xs text-gray-400 mb-5">{t("date")}: {new Date().toLocaleDateString()}</p>
            <div className="flex gap-3">
              <button
                data-testid="button-cancel-submit"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                data-testid="button-confirm-submit"
                onClick={handleSubmit}
                disabled={!signatureName.trim() || submitting}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                  signatureName.trim() && !submitting
                    ? "bg-green-700 hover:bg-green-800 text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("submitting")}</span>
                ) : t("submitApplication")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400">
        <p>Chapin Landscapes · design • build • maintain</p>
        <p className="mt-1">440.724.8006 · chapinlandscapes.com</p>
      </div>
    </div>
  );
}

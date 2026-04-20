import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, AlertTriangle, Mail, Phone, MapPin, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

function useSteps() {
  const { t } = useTranslation("applicantStatus");
  return [
    { id: 1, label: t("stepApplied") },
    { id: 2, label: t("stepUnderReview") },
    { id: 3, label: t("stepInterview") },
    { id: 4, label: t("stepFinalReview") },
    { id: 5, label: t("stepOffer") },
    { id: 6, label: t("stepHired") },
  ];
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("applicantStatus");
  if (status === "hired") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
      <CheckCircle2 className="h-4 w-4" /> {t("statusHired")}
    </span>
  );
  if (status === "declined") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
      {t("statusClosed")}
    </span>
  );
  if (status === "draft") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
      <Clock className="h-4 w-4" /> {t("statusInProgress")}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
      <Clock className="h-4 w-4" /> {t("statusActive")}
    </span>
  );
}

function ProgressBar({ progress, declined }: { progress: number; declined: boolean }) {
  const steps = useSteps();

  if (declined) {
    return (
      <div className="my-6">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
                step.id === 1 ? "bg-gray-200 border-gray-300 text-gray-500" : "bg-gray-100 border-gray-200 text-gray-400"
              }`}>
                {step.id}
              </div>
              <span className="text-xs mt-1 text-gray-400 hidden sm:block text-center">{step.label}</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 rounded-full mt-1" />
      </div>
    );
  }

  const progressPct = Math.max(0, Math.min(100, ((progress - 1) / (steps.length - 1)) * 100));

  return (
    <div className="my-6">
      <div className="flex items-center justify-between mb-2">
        {steps.map((step) => {
          const done = step.id < progress;
          const active = step.id === progress;
          return (
            <div key={step.id} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all ${
                done ? "bg-green-600 border-green-600 text-white" :
                active ? "bg-white border-green-600 text-green-700 ring-4 ring-green-100" :
                "bg-gray-100 border-gray-200 text-gray-400"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
              </div>
              <span className={`text-xs mt-1 hidden sm:block text-center font-medium ${
                done || active ? "text-green-700" : "text-gray-400"
              }`}>{step.label}</span>
            </div>
          );
        })}
      </div>
      <div className="h-2 bg-gray-100 rounded-full mt-1 relative overflow-hidden">
        <div
          className="h-full bg-green-600 rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

export default function ApplicantStatus() {
  const { t } = useTranslation("applicantStatus");
  const token = window.location.pathname.replace("/status/", "").replace(/\/$/, "");

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/status/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/status/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Could not load status");
      }
      return res.json();
    },
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Chapin Landscapes</h1>
            <p className="text-green-200 text-sm mt-0.5">design &bull; build &bull; maintain</p>
          </div>
          <div className="text-right">
            <p className="text-green-200 text-xs">{t("applicationStatus")}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{t("loading")}&hellip;</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-800 mb-1">{t("unableToLoad")}</h2>
            <p className="text-gray-500 text-sm mb-4">{(error as Error).message}</p>
            <p className="text-gray-400 text-xs">
              {t("contactError")}{" "}
              <a href="mailto:office@chapinlandscapes.com" className="text-green-600 hover:underline">
                office@chapinlandscapes.com
              </a>
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Applicant info card */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{t("applicant")}</p>
                  <h2 className="text-xl font-bold text-gray-800" data-testid="text-applicant-name">{data.applicantName}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {t("appliedFor")}: <span className="font-medium text-gray-700" data-testid="text-position">{data.position}</span>
                  </p>
                  {data.submittedAt && (
                    <p className="text-gray-400 text-xs mt-1">
                      {t("submitted")}: {new Date(data.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
                <StatusBadge status={data.status} />
              </div>

              {data.status !== "declined" && data.progress != null && (
                <ProgressBar progress={data.progress || 1} declined={false} />
              )}
              {data.status === "declined" && (
                <ProgressBar progress={0} declined={true} />
              )}
            </div>

            {/* Current status card */}
            <div className={`rounded-xl shadow-sm border p-6 ${
              data.status === "hired" ? "bg-green-50 border-green-200" :
              data.status === "declined" ? "bg-gray-50 border-gray-200" :
              "bg-white"
            }`}>
              <div className="flex items-start gap-3">
                {data.status === "hired" ? (
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{t("currentStatus")}</p>
                  <h3 className="text-lg font-semibold text-gray-800" data-testid="text-stage-label">{data.stageLabel}</h3>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed" data-testid="text-stage-message">{data.stageMessage}</p>
                </div>
              </div>
            </div>

            {/* What's next card */}
            {data.status !== "hired" && data.status !== "declined" && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ChevronRight className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{t("whatsNext")}</p>
                    <p className="text-gray-700 text-sm leading-relaxed" data-testid="text-next-step">{data.nextStep}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact card */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">{t("contactUs")}</p>
              <div className="space-y-2 text-sm">
                <a
                  href={`mailto:${data.contactEmail}`}
                  className="flex items-center gap-2 text-green-700 hover:text-green-800 hover:underline"
                  data-testid="link-contact-email"
                >
                  <Mail className="h-4 w-4" />
                  {data.contactEmail}
                </a>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" />
                  440.226.0518
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  Chapin Landscapes, Ohio
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 pt-2">
              {t("bookmarkHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

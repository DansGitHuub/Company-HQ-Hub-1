import React, { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDateOnly } from "@/lib/utils";
import { ImageLightbox } from "@/components/ImageLightbox";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(v: any) {
  const n = parseFloat(v ?? "0");
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(v: any) { return parseFloat(v ?? "0"); }

// ── Simple Template ───────────────────────────────────────────────────────────
function SimpleTemplate({ est }: { est: any }) {
  const { t } = useTranslation("estimates");
  const taxPct = (num(est.tax_rate) * 100).toFixed(2);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto bg-white text-gray-900 p-10 min-h-screen font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-green-800 tracking-tight">CHAPIN LANDSCAPES</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("professionalLandscapeServices")}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-800">{est.estimate_number}</div>
          <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{t("estimate")}</div>
        </div>
      </div>

      {/* Customer + Date row */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">{t("preparedFor")}</div>
          <div className="font-semibold text-base">{est.customer_name ?? "—"}</div>
          {est.customer_email && <div className="text-sm text-gray-600">{est.customer_email}</div>}
          {est.customer_phone && <div className="text-sm text-gray-600">{est.customer_phone}</div>}
          {est.property_address && <div className="text-sm text-gray-600 mt-1">{est.property_address}</div>}
        </div>
        <div className="text-right space-y-1">
          <div><span className="text-xs text-gray-400 uppercase tracking-wide">{t("date")}&nbsp;</span>
            <span className="text-sm font-medium">{fmtDateOnly(est.issued_date)}</span></div>
          {est.valid_until && <div><span className="text-xs text-gray-400 uppercase tracking-wide">{t("validUntil")}:&nbsp;</span>
            <span className="text-sm font-medium">{fmtDateOnly(est.valid_until)}</span></div>}
          {est.salesperson_name && <div><span className="text-xs text-gray-400 uppercase tracking-wide">{t("salesperson")}:&nbsp;</span>
            <span className="text-sm font-medium">{est.salesperson_name}</span></div>}
        </div>
      </div>

      {/* Project Title */}
      <div className="bg-green-800 text-white rounded px-4 py-2 mb-6">
        <div className="text-[10px] uppercase tracking-widest opacity-70">{t("project")}</div>
        <div className="font-semibold text-base">{est.title}</div>
      </div>

      {/* Customer message */}
      {est.customer_message && (
        <div className="mb-6 text-sm text-gray-700 italic border-l-4 border-green-300 pl-3">
          {est.customer_message}
        </div>
      )}

      {/* Work Areas summary table */}
      <table className="w-full text-sm mb-6 border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-2 font-semibold text-gray-700">{t("workArea")}</th>
            <th className="text-left py-2 font-semibold text-gray-700">{t("category")}</th>
            <th className="text-right py-2 font-semibold text-gray-700">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {(est.work_areas ?? []).map((wa: any) => {
            const areaTotal = (wa.line_items ?? []).reduce((s: number, li: any) => s + num(li.amount), 0);
            return (
              <tr key={wa.id} className="border-b border-gray-100">
                <td className="py-2">
                  <div className="font-medium">{wa.name}</div>
                  {wa.area_description && <div className="text-xs text-gray-500">{wa.area_description}</div>}
                </td>
                <td className="py-2 text-gray-600">{wa.category ?? "—"}</td>
                <td className="py-2 text-right font-medium">{fmtMoney(areaTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Line Items Detail (grouped by work area, shown when any item has a photo or when expanded) */}
      {(est.work_areas ?? []).some((wa: any) =>
        (wa.line_items ?? []).some((li: any) => li.image_url && !li.image_hidden)
      ) && (
        <div className="mb-6 space-y-4">
          {(est.work_areas ?? []).map((wa: any) => {
            const items = (wa.line_items ?? []).filter((li: any) => li.image_url && !li.image_hidden);
            if (items.length === 0) return null;
            return (
              <div key={wa.id}>
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2 border-b pb-1">{wa.name}</div>
                <div className="space-y-2">
                  {items.map((li: any) => (
                    <div key={li.id} className="flex items-center gap-3 text-sm">
                      <img
                        src={li.image_url}
                        alt={li.description}
                        className="w-12 h-12 object-cover rounded border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 print:cursor-default"
                        onClick={() => setLightboxSrc(li.image_url)}
                        title="Click to enlarge"
                        data-testid="img-li-thumb-preview"
                      />
                      <span className="text-gray-700">{li.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Totals */}
      <div className="ml-auto w-64 text-sm space-y-1 mb-8">
        <div className="flex justify-between"><span className="text-gray-600">{t("subtotal")}</span><span>{fmtMoney(est.subtotal)}</span></div>
        {num(est.discount_amount) > 0 && <div className="flex justify-between text-red-600"><span>{t("discount")}</span><span>–{fmtMoney(est.discount_amount)}</span></div>}
        <div className="flex justify-between"><span className="text-gray-600">{t("tax")} ({taxPct}%)</span><span>{fmtMoney(est.tax_amount)}</span></div>
        <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-1 mt-1">
          <span>{t("total")}</span><span>{fmtMoney(est.total)}</span>
        </div>
        {num(est.down_payment_percent) > 0 && (
          <div className="flex justify-between text-green-700 font-medium">
            <span>{t("deposit")} ({num(est.down_payment_percent).toFixed(0)}%)</span>
            <span>{fmtMoney(est.down_payment_amount)}</span>
          </div>
        )}
      </div>

      {/* Terms / Notes */}
      {(est.terms || est.notes) && (
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 space-y-2">
          {est.terms && <div><span className="font-semibold">{t("termsConditionsLabel")} </span>{est.terms}</div>}
          {est.notes && (
            <div>
              <span className="font-semibold">{t("notesLabel")} </span>
              <div className="prose prose-xs max-w-none mt-0.5" dangerouslySetInnerHTML={{ __html: est.notes || '' }} />
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-center text-[10px] text-gray-400">
        {t("thankYouSimple")}
      </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

// ── Booklet Template ──────────────────────────────────────────────────────────
function BookletTemplate({ est }: { est: any }) {
  const { t } = useTranslation("estimates");
  const taxPct = (num(est.tax_rate) * 100).toFixed(2);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto bg-white text-gray-900 font-sans">
      {/* Cover page */}
      <div className="min-h-[50vh] bg-gradient-to-br from-green-900 to-green-700 text-white p-12 flex flex-col justify-between print:min-h-screen">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-1">CHAPIN LANDSCAPES</h1>
          <p className="text-green-300 text-sm uppercase tracking-widest">{t("professionalLandscapeServices")}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-green-300 mb-1">{t("proposal")}</div>
          <div className="text-3xl font-bold mb-1">{est.title}</div>
          <div className="text-green-200 text-sm">{est.estimate_number}</div>
        </div>
        <div className="text-sm text-green-200 space-y-0.5">
          <div>{t("preparedForColon")} <span className="text-white font-semibold">{est.customer_name ?? "—"}</span></div>
          <div>{t("date")} <span className="text-white">{fmtDateOnly(est.issued_date)}</span></div>
          {est.salesperson_name && <div>{t("advisor")} <span className="text-white">{est.salesperson_name}</span></div>}
        </div>
      </div>

      <div className="p-10 space-y-10">
        {/* Introduction */}
        {est.customer_message && (
          <section>
            <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-1 mb-3">{t("dearCustomer")} {est.customer_name ?? t("valuedCustomer")},</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{est.customer_message}</p>
          </section>
        )}

        {/* Customer / Property info */}
        <section>
          <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-1 mb-3">{t("projectInformation")}</h2>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{t("customerLabel")}</div>
              <div className="font-medium">{est.customer_name ?? "—"}</div>
              {est.customer_email && <div className="text-gray-600">{est.customer_email}</div>}
              {est.customer_phone && <div className="text-gray-600">{est.customer_phone}</div>}
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{t("propertyLabel")}</div>
              <div className="text-gray-700">{est.property_address ?? "—"}</div>
              <div className="mt-2 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{t("validUntil")}</div>
              <div className="text-gray-700">{fmtDateOnly(est.valid_until)}</div>
            </div>
          </div>
        </section>

        {/* Detailed Work Areas */}
        <section>
          <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-1 mb-4">{t("scopeOfWork")}</h2>
          <div className="space-y-8">
            {(est.work_areas ?? []).map((wa: any, idx: number) => {
              const areaTotal = (wa.line_items ?? []).reduce((s: number, li: any) => s + num(li.amount), 0);
              return (
                <div key={wa.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-green-50 border-b border-green-100 px-4 py-2.5 flex justify-between items-start">
                    <div>
                      <div className="font-bold text-green-900">{idx + 1}. {wa.name}</div>
                      {wa.category && <div className="text-xs text-green-700 mt-0.5">{wa.category}</div>}
                      {wa.area_description && <div className="text-xs text-gray-600 mt-1">{wa.area_description}</div>}
                    </div>
                    <div className="text-right font-bold text-green-800">{fmtMoney(areaTotal)}</div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                        <th className="text-left py-1.5 px-3 font-medium">{t("item")}</th>
                        <th className="text-left py-1.5 px-2 font-medium">{t("description")}</th>
                        <th className="text-right py-1.5 px-2 font-medium">{t("qty")}</th>
                        <th className="text-right py-1.5 px-2 font-medium">{t("unitPrice")}</th>
                        <th className="text-right py-1.5 px-3 font-medium">{t("amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(wa.line_items ?? []).map((li: any) => (
                        <tr key={li.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 px-3 capitalize text-gray-600">{li.item_type}</td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              {li.image_url && !li.image_hidden && (
                                <img
                                  src={li.image_url}
                                  alt={li.description}
                                  className="w-16 h-16 object-cover rounded border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 print:cursor-default"
                                  onClick={() => setLightboxSrc(li.image_url)}
                                  title="Click to enlarge"
                                />
                              )}
                              <span>{li.description}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-right">{num(li.quantity)} {li.unit}</td>
                          <td className="py-1.5 px-2 text-right">{fmtMoney(li.unit_price)}</td>
                          <td className="py-1.5 px-3 text-right font-medium">{fmtMoney(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>

        {/* Investment Summary */}
        <section>
          <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-1 mb-4">{t("investmentSummary")}</h2>
          <div className="max-w-sm ml-auto text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-600">{t("subtotal")}</span><span>{fmtMoney(est.subtotal)}</span></div>
            {num(est.discount_amount) > 0 && (
              <div className="flex justify-between text-red-600"><span>{t("discount")}</span><span>–{fmtMoney(est.discount_amount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-600">{t("tax")} ({taxPct}%)</span><span>{fmtMoney(est.tax_amount)}</span></div>
            <div className="flex justify-between text-lg font-extrabold border-t-2 border-green-800 pt-2 mt-2 text-green-900">
              <span>{t("totalInvestment")}</span><span>{fmtMoney(est.total)}</span>
            </div>
            {num(est.down_payment_percent) > 0 && (
              <div className="bg-green-50 rounded p-3 mt-2 flex justify-between items-center">
                <span className="text-green-800 font-medium">{t("requiredDeposit")} ({num(est.down_payment_percent).toFixed(0)}%)</span>
                <span className="text-green-900 font-bold">{fmtMoney(est.down_payment_amount)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Terms */}
        {(est.terms || est.notes) && (
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-bold text-green-800 border-b border-green-200 pb-1 mb-3">{t("termsNotes")}</h2>
            <div className="space-y-3 text-sm text-gray-700">
              {est.terms && <div><span className="font-semibold">{t("termsConditionsLabel")} </span>{est.terms}</div>}
              {est.notes && (
                <div>
                  <span className="font-semibold">{t("additionalNotesLabel")} </span>
                  <div className="prose prose-sm max-w-none mt-0.5" dangerouslySetInnerHTML={{ __html: est.notes || '' }} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Signature area */}
        <section className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-bold text-green-800 mb-4">{t("acceptance")}</h2>
          <p className="text-sm text-gray-600 mb-6">
            {t("acceptanceText")}
          </p>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="border-b border-gray-400 mt-8 mb-1" />
              <div className="text-gray-500">{t("customerSignature")}</div>
              <div className="border-b border-gray-400 mt-6 mb-1" />
              <div className="text-gray-500">{t("date")}</div>
            </div>
            <div>
              <div className="border-b border-gray-400 mt-8 mb-1" />
              <div className="text-gray-500">{t("printedName")}</div>
              <div className="text-xs text-gray-400 mt-4 leading-relaxed">
                Chapin Landscapes<br />
                {t("professionalLandscapeServices")}
              </div>
            </div>
          </div>
        </section>

        <div className="text-center text-[10px] text-gray-400 pt-2">
          {t("thankYouBooklet")}
        </div>
      </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EstimatePreview() {
  const { t } = useTranslation("estimates");
  const [, params] = useRoute("/estimates/:id/preview");
  const id = params?.id;

  const { data: est, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/estimates/${id}`],
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !est) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        {t("notFound")}
      </div>
    );
  }

  const style: "simple" | "booklet" = est.presentation_style === "booklet" ? "booklet" : "simple";

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="h-4 w-4 text-green-700" />
          <span className="font-medium">{est.estimate_number}</span>
          <span className="text-gray-400">·</span>
          <span>{est.title}</span>
          <span className="ml-2 text-xs bg-green-100 text-green-800 rounded px-1.5 py-0.5 capitalize font-medium">
            {style}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="btn-print">
            <Printer className="h-4 w-4 mr-1.5" />
            {t("printSavePdf")}
          </Button>
        </div>
      </div>

      {/* Preview content */}
      <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:p-0">
        {style === "booklet" ? <BookletTemplate est={est} /> : <SimpleTemplate est={est} />}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}

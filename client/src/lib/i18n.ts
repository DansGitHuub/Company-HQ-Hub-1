import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';

function nsMap(locale: typeof en) {
  return {
    translation:    locale,
    nav:            locale.nav,
    common:         locale.common,
    status:         locale.status,
    auth:           locale.auth,
    dashboard:      locale.dashboard,
    profile:        locale.profile,
    voice:          locale.voice,
    settings:       locale.settings,
    employees:      locale.employees,
    jobs:           locale.jobs,
    calendar:       locale.calendar,
    tasks:          locale.tasks,
    sops:           locale.sops,
    hiring:         locale.hiring,
    equipment:      locale.equipment,
    materials:      locale.materials,
    messages:       locale.messages,
    forms:          locale.forms,
    admin:          locale.admin,
    tools:          locale.tools,
    customerHub:    locale.customerHub,
    suggestions:    locale.suggestions,
    documents:      locale.documents,
    marketing:      locale.marketing,
    education:      locale.education,
    header:         locale.header,
    errors:         locale.errors,
    confirmDialog:  locale.confirmDialog,
    language:       locale.language,
    notifications:  locale.notifications,
    updates:        locale.updates,
    help:           locale.help,
    employeePortal: locale.employeePortal,
    email:          locale.email,
    search:         locale.search,
    calculator:     locale.calculator,
    shared:         locale.shared,
    integrations:   locale.integrations,
    hq:             locale.hq,
    careGuides:     locale.careGuides,
    leadQualifier:  locale.leadQualifier,
    assistant:      locale.assistant,
    customers:      locale.customers,
    jobDetail:      locale.jobDetail,
    estimates:      locale.estimates,
    invoices:       locale.invoices,
    myDay:          locale.myDay,
    myHours:        locale.myHours,
    scheduling:     locale.scheduling,
    timeTracking:   locale.timeTracking,
    dailyWorksheet: locale.dailyWorksheet,
  };
}

const SUPPORTED = ['en', 'es'] as const;
type SupportedLng = typeof SUPPORTED[number];

// In-memory slot for the server-sourced user preference.
// Populated by setUserPreferenceLanguage() (Step B) once /api/user resolves.
// Never persisted here — server is the source of truth for this tier.
let _userPreference: SupportedLng | null = null;

/** Normalise any raw locale string to a supported code, or return null. */
function toSupported(raw: string | null | undefined): SupportedLng | null {
  if (!raw) return null;
  const norm = raw.split('-')[0].toLowerCase();
  return (SUPPORTED as readonly string[]).includes(norm) ? (norm as SupportedLng) : null;
}

/**
 * Priority chain (highest → lowest):
 *   1. userPreference  — server-stored value injected via setUserPreferenceLanguage()
 *   2. localStorage    — explicit in-app selection persisted by languageChanged handler
 *   3. navigator       — browser / OS language setting
 *   4. htmlTag         — <html lang="…"> set by server-side rendering or CDN
 *   5. 'en'            — hardcoded fallback
 */
function detectLanguage(): SupportedLng {
  return (
    _userPreference
    ?? toSupported(localStorage.getItem('i18n-language'))
    ?? toSupported(navigator.language || navigator.languages?.[0])
    ?? toSupported(document.documentElement.lang)
    ?? 'en'
  );
}

/**
 * Called by Step B after the /api/user query resolves.
 * Sets the top-priority user-preference tier and switches i18n if needed.
 * No-ops when the value is unsupported or already active.
 */
export function setUserPreferenceLanguage(lng: string): void {
  const normalized = toSupported(lng);
  if (!normalized || normalized === _userPreference) return;
  _userPreference = normalized;
  if (i18n.language !== normalized) i18n.changeLanguage(normalized);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: nsMap(en),
      es: nsMap(es),
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n-language', lng);
});

export default i18n;

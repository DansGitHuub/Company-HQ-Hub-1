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

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: nsMap(en),
      es: nsMap(es),
    },
    lng: localStorage.getItem('i18n-language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n-language', lng);
});

export default i18n;

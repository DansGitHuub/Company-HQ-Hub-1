import { lazy } from "react";

const W4Form = lazy(() => import("./W4Form"));
const I9Form = lazy(() => import("./I9Form"));
const OhioIT4Form = lazy(() => import("./OhioIT4Form"));
const DirectDepositForm = lazy(() => import("./DirectDepositForm"));
const HandbookAcknowledgmentForm = lazy(() => import("./HandbookAcknowledgmentForm"));
const EmergencyContactForm = lazy(() => import("./EmergencyContactForm"));
const BackgroundCheckAuthForm = lazy(() => import("./BackgroundCheckAuthForm"));
const NDAForm = lazy(() => import("./NDAForm"));
const EmploymentApplicationForm = lazy(() => import("./EmploymentApplicationForm"));
const WorkersCompFROIForm = lazy(() => import("./WorkersCompFROIForm"));
const OSHAIncidentForm = lazy(() => import("./OSHAIncidentForm"));

export const FORM_REGISTRY: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  w4: W4Form,
  i9: I9Form,
  ohio_it4: OhioIT4Form,
  direct_deposit: DirectDepositForm,
  handbook_acknowledgment: HandbookAcknowledgmentForm,
  emergency_contact: EmergencyContactForm,
  background_check_auth: BackgroundCheckAuthForm,
  nda: NDAForm,
  employment_application: EmploymentApplicationForm,
  workers_comp_first_report: WorkersCompFROIForm,
  osha_incident: OSHAIncidentForm,
};

export {
  W4Form,
  I9Form,
  OhioIT4Form,
  DirectDepositForm,
  HandbookAcknowledgmentForm,
  EmergencyContactForm,
  BackgroundCheckAuthForm,
  NDAForm,
  EmploymentApplicationForm,
  WorkersCompFROIForm,
  OSHAIncidentForm,
};

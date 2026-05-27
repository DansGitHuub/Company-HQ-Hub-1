import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { VoiceProvider } from "@/hooks/use-voice";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppShell from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Home",
  "/hq": "HQ Overview",
  "/my-hours": "My Hours",
  "/daily-worksheet": "Daily Worksheet",
  "/messages": "Messages",
  "/customers": "Customers",
  "/consultations": "Consultations",
  "/estimates": "Estimates",
  "/jobs": "Jobs",
  "/todos": "Tasks",
  "/scheduling": "Scheduling",
  "/time": "Time Tracking",
  "/equipment": "Equipment",
  "/forms": "Forms",
  "/sops": "SOP Library",
  "/customer-resources": "Customer Resources",
  "/training": "Training & Knowledge",
  "/admin": "Admin Panel",
  "/employees": "Employees",
  "/hiring": "Hiring",
  "/invoices": "Invoices",
  "/reports": "Reports",
  "/mors-budget": "MORS Budget",
  "/catalog": "Catalog",
  "/tools/plow-mapper": "Plow Site Mapper",
  "/tools": "Tools",
  "/settings": "Settings",
  "/profile": "Profile",
  "/calendar": "Calendar",
  "/notifications": "Notifications",
  "/customers": "Customers",
};

function DocumentTitleSetter() {
  const [location] = useLocation();
  useEffect(() => {
    const base = location.split("?")[0].replace(/\/$/, "") || "/";
    const exact = ROUTE_TITLES[base];
    if (exact) {
      document.title = `${exact} — CompanyHQ`;
      return;
    }
    const prefix = Object.keys(ROUTE_TITLES)
      .filter(k => k !== "/" && base.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0];
    document.title = prefix ? `${ROUTE_TITLES[prefix]} — CompanyHQ` : "CompanyHQ";
  }, [location]);
  return null;
}

import Home from "@/pages/Home";
import AuthPage from "@/pages/auth-page";
import AdminPanel from "@/pages/AdminPanel";
import AdminInbox from "@/pages/AdminInbox";
import CustomerHub from "@/pages/CustomerHub";
import CareGuideManager from "@/pages/CareGuideManager";
import ApplicantPortal from "@/pages/ApplicantPortal";
import SOPs from "@/pages/SOPs";
import Materials from "@/pages/Materials";
import Hiring from "@/pages/Hiring";
import Marketing from "@/pages/Marketing";
import Forms from "@/pages/Forms";
import Education from "@/pages/Education";
import EmployeePortal from "@/pages/EmployeePortal";
import Employees from "@/pages/Employees";
import FormHub from "@/pages/FormHub";
import HQOverview from "@/pages/HQOverview";
import JobPipeline from "@/pages/JobPipeline";
import JobList from "@/pages/jobs/index";
import JobDetail from "@/pages/jobs/show";
import InvoiceList from "@/pages/invoices/index";
import InvoiceDetail from "@/pages/invoices/show";
import EstimateList from "@/pages/estimates/index";
import EstimateDetail from "@/pages/estimates/show";
import EstimatePreview from "@/pages/estimates/EstimatePreview";
import SchedulingCalendar from "@/pages/scheduling/index";
import MyDayPage from "@/pages/my-day/index";
import MyHoursPage from "@/pages/my-hours/index";
import Help from "@/pages/Help";
import Profile from "@/pages/Profile";
import AdminSetup from "@/pages/AdminSetup";
import EquipmentTracker from "@/pages/EquipmentTracker";
import Tasks from "@/pages/Tasks";
import SearchPage from "@/pages/Search";
import TodoList from "@/pages/TodoList";

import DailyWorksheet from "@/pages/DailyWorksheet";
import RoutePage from "@/pages/Route/index";
import ClockOutReviewPage from "@/pages/ClockOutReviewPage";
import WorksheetReviewList from "@/pages/WorksheetReviewList";
import WorksheetReviewDetail from "@/pages/WorksheetReviewDetail";
import WorkAreasPage from "@/pages/admin/WorkAreasPage";
import QBOExportPage from "@/pages/admin/QBOExportPage";
import ArchivePage from "@/pages/admin/ArchivePage";
import BudgetSettings from "@/pages/BudgetSettings";
import TimeTracking from "@/pages/time/index";
import ReportsPage from "@/pages/Reports";
import ConsultationsPage from "@/pages/Consultations";
import MorsBudget from "@/pages/MorsBudget";
import CustomerList from "@/pages/customers/index";
import CustomerDetail from "@/pages/customers/show";
import PlowSiteMapper from "@/pages/PlowSiteMapper";
import ProcessAuditor from "@/pages/ProcessAuditor";
import IntegrationWizard from "@/pages/IntegrationWizard";
import TestingKnowledge from "@/pages/TestingKnowledge";
import CalculatorPage from "@/pages/Calculator";
import Tools from "@/pages/Tools";
import LeadQualifier from "@/pages/LeadQualifier";
import CalendarPage from "@/pages/Calendar";
import SharedDocument from "@/pages/SharedDocument";
import SettingsPage from "@/pages/Settings";
import PublicApplicationForm from "@/pages/PublicApplicationForm";
import ApplicantStatus from "@/pages/ApplicantStatus";
import OfferAcceptancePage from "@/pages/OfferAcceptancePage";
import AgreementSigningPage from "@/pages/AgreementSigningPage";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import NotFound from "@/pages/not-found";
import NotificationsPage from "@/pages/Notifications";
import CatalogPage from "@/pages/catalog/index";
import CatalogImport from "@/pages/catalog/CatalogImport";
import CatalogDetail from "@/pages/catalog/CatalogDetail";
import PlantCards from "@/pages/PlantCards";
import CustomerPortal from "@/pages/CustomerPortal";
import PortalCustomerRedeem from "@/pages/PortalCustomerRedeem";
import PortalCrewRedeem from "@/pages/PortalCrewRedeem";
import MessagesPage from "@/pages/Messages";
import TimeReports from "@/pages/admin/TimeReports";
import ServiceTypesPage from "@/pages/admin/ServiceTypesPage";
import WorksheetReview from "@/pages/admin/WorksheetReview";
import RouteDayDetail from "@/pages/admin/RouteDayDetail";
import TimeCardApproval from "@/pages/admin/TimeCardApproval";
import TimeAdminPage from "@/pages/admin/TimeAdminPage";
import CompanyCamReconciliation from "@/pages/admin/CompanyCamReconciliation";
import CustomerDuplicates from "@/pages/admin/CustomerDuplicates";
import CompanyCamHealth from "@/pages/admin/CompanyCamHealth";
import InquiryPage from "@/pages/Inquiry";
import InquirySuccess from "@/pages/InquirySuccess";
import BookingPage from "@/pages/BookingPage";

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (window.location.pathname.startsWith("/shared/")) {
    return <SharedDocument />;
  }

  if (window.location.pathname.startsWith("/apply/")) {
    return <PublicApplicationForm />;
  }

  if (window.location.pathname.startsWith("/status/")) {
    return <ApplicantStatus />;
  }

  if (window.location.pathname.startsWith("/offer/")) {
    return <OfferAcceptancePage />;
  }

  if (window.location.pathname.startsWith("/agreement/")) {
    return <AgreementSigningPage />;
  }

  if (window.location.pathname === "/privacy") {
    return <PrivacyPolicy />;
  }

  if (window.location.pathname.startsWith("/portal/crew/")) {
    return <PortalCrewRedeem />;
  }

  if (window.location.pathname.startsWith("/portal/customer/")) {
    return <PortalCustomerRedeem />;
  }

  if (window.location.pathname.startsWith("/portal/")) {
    return <CustomerPortal />;
  }

  if (window.location.pathname === "/inquiry/success") {
    return <InquirySuccess />;
  }

  if (window.location.pathname === "/inquiry") {
    return <InquiryPage />;
  }

  if (window.location.pathname.startsWith("/book/")) {
    return <BookingPage />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const isCustomer = user?.role === "Customer";
  const defaultPath = isCustomer ? "/customer-hub" : "/";

  return (
    <AppShell>
      <DocumentTitleSetter />
      <Switch>
        <Route path="/">
          {isCustomer ? <Redirect to="/customer-hub" /> : <Home />}
        </Route>
        <Route path="/auth">
          <Redirect to={defaultPath} />
        </Route>
        <Route path="/customer-hub/:section?" component={CustomerHub} />
        <Route path="/applicant" component={ApplicantPortal} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/inbox" component={AdminInbox} />
        <Route path="/sops" component={SOPs} />
        <Route path="/materials" component={Materials} />
        <Route path="/hiring" component={Hiring} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/forms" component={Forms} />
        <Route path="/customer-resources" component={Education} />
        <Route path="/education"><Redirect to="/customer-resources" /></Route>
        <Route path="/profile" component={Profile} />
        <Route path="/employees" component={Employees} />
        <Route path="/onboarding-forms/:formType?/:submissionId?" component={FormHub} />
        <Route path="/employee" component={EmployeePortal} />
        <Route path="/employee-portal" component={EmployeePortal} />
        <Route path="/hq" component={HQOverview} />
        <Route path="/jobs" component={JobList} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/invoices" component={InvoiceList} />
        <Route path="/invoices/:id" component={InvoiceDetail} />
        <Route path="/estimates" component={EstimateList} />
        <Route path="/estimates/:id/preview" component={EstimatePreview} />
        <Route path="/estimates/:id" component={EstimateDetail} />
        <Route path="/scheduling" component={SchedulingCalendar} />
        <Route path="/my-day"><Redirect to="/daily-worksheet" /></Route>
        <Route path="/my-hours" component={MyHoursPage} />
        <Route path="/pipeline" component={JobPipeline} />
        <Route path="/help" component={Help} />
        <Route path="/admin-setup" component={AdminSetup} />
        <Route path="/equipment" component={EquipmentTracker} />
        <Route path="/search" component={SearchPage} />
        <Route path="/todos" component={TodoList} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/daily-worksheet" component={DailyWorksheet} />
        <Route path="/clock-out-review" component={ClockOutReviewPage} />
        <Route path="/worksheet-review/:id" component={WorksheetReviewDetail} />
        <Route path="/worksheet-review" component={WorksheetReviewList} />
        <Route path="/admin/route-days/:routeDayId" component={RouteDayDetail} />
        <Route path="/admin/work-areas" component={WorkAreasPage} />
        <Route path="/admin/qbo-export" component={QBOExportPage} />
        <Route path="/admin/archive" component={ArchivePage} />
        <Route path="/admin/time" component={TimeAdminPage} />
      <Route path="/admin/time-reports"><Redirect to="/admin/time?tab=reports" /></Route>
        <Route path="/admin/worksheet-review"><Redirect to="/admin/time?tab=worksheet" /></Route>
        <Route path="/admin/time-card-approval"><Redirect to="/admin/time?tab=approval" /></Route>
        <Route path="/admin/service-types" component={ServiceTypesPage} />
        <Route path="/admin/companycam-reconciliation" component={CompanyCamReconciliation} />
        <Route path="/admin/customer-duplicates" component={CustomerDuplicates} />
        <Route path="/admin/companycam-health" component={CompanyCamHealth} />
        <Route path="/budget-settings"><Redirect to="/mors-budget?tab=mark-up" /></Route>
        <Route path="/time" component={TimeTracking} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/consultations" component={ConsultationsPage} />
        <Route path="/consultas"><Redirect to="/consultations" /></Route>
        <Route path="/mors-budget" component={MorsBudget} />
        <Route path="/clients"><Redirect to="/customers" /></Route>
        <Route path="/admin/employees"><Redirect to="/employees" /></Route>
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/customers" component={CustomerList} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/tools/plow-mapper" component={() => <PlowSiteMapper />} />
        <Route path="/tools/process-auditor" component={ProcessAuditor} />
        <Route path="/tools/integration-wizard" component={IntegrationWizard} />
        <Route path="/tools/calculator" component={() => <CalculatorPage />} />
        <Route path="/tools/lead-qualifier" component={() => <LeadQualifier />} />
        <Route path="/care-guides" component={CareGuideManager} />
        <Route path="/tools" component={Tools} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/training" component={TestingKnowledge} />
        <Route path="/testing"><Redirect to="/training" /></Route>
        <Route path="/settings" component={SettingsPage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/catalog/import" component={CatalogImport} />
        <Route path="/catalog/:id" component={CatalogDetail} />
        <Route path="/catalog" component={CatalogPage} />
        <Route path="/plant-cards" component={PlantCards} />
        <Route path="/route" component={RoutePage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <VoiceProvider>
              <Toaster />
              <AppRoutes />
            </VoiceProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

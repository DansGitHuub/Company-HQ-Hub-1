import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { VoiceProvider } from "@/hooks/use-voice";
import { useAccessibility } from "@/hooks/use-accessibility";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppShell from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { TOOL_ROLES } from "@/lib/toolAccess";

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
  "/time": "Team Time Tracking",
  "/equipment": "Equipment",
  "/vendors": "Vendors",
  "/forms": "Forms",
  "/sops": "SOP Library",
  "/customer-resources": "Customer Resources",
  "/training": "Training & Knowledge",
  "/admin": "Settings & System",
  "/settings-system": "Settings & System",
  "/company": "Company",
  "/finance": "Finance",
  "/people": "People",
  "/sales": "Sales",
  "/employees": "Employees",
  "/hiring": "Hiring",
  "/invoices": "Invoices",
  "/reports": "Reports",
  "/mors-budget": "MORS Budget",
  "/catalog": "Catalog",
  "/work-orders": "Work Orders",
  "/tools/plow-mapper": "Plow Site Mapper",
  "/tools": "Tools",
  "/daily-agenda": "Daily Agenda",
  "/settings": "Settings",
  "/profile": "Profile",
  "/calendar": "Calendar",
  "/notifications": "Notifications",
  "/manager-dashboard": "Manager Dashboard",
  "/overdue": "Overdue Items",
  "/daily-plan": "Daily Plan",
};

function AccessibilityApplicator() {
  useAccessibility();
  return null;
}

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
import SettingsSystemHub from "@/pages/SettingsSystemHub";
import CustomerMessagesInbox from "@/pages/CustomerMessagesInbox";
import CustomerBlasts from "@/pages/CustomerBlasts";
import CustomerHub from "@/pages/CustomerHub";
import ApplicantPortal from "@/pages/ApplicantPortal";
import SOPs from "@/pages/SOPs";
import Hiring from "@/pages/Hiring";
import Marketing from "@/pages/Marketing";
import Forms from "@/pages/Forms";
import Education from "@/pages/Education";
import EmployeePortal from "@/pages/EmployeePortal";
import Employees from "@/pages/Employees";
import EmployeesImport from "@/pages/EmployeesImport";
import Vendors from "@/pages/Vendors";
import VendorsImport from "@/pages/VendorsImport";
import FormHub from "@/pages/FormHub";
import JobList from "@/pages/jobs/index";
import JobDetail from "@/pages/jobs/show";
import FinanceHub from "@/pages/FinanceHub";
import PeopleHub from "@/pages/PeopleHub";
import SalesHub from "@/pages/SalesHub";
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
import EquipmentImport from "@/pages/EquipmentImport";
import Tasks from "@/pages/Tasks";
import SearchPage from "@/pages/Search";

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
import CustomersImport from "@/pages/CustomersImport";
import PropertiesImport from "@/pages/PropertiesImport";
import PlowSitesImport from "@/pages/PlowSitesImport";
import MaintenanceRoutes from "@/pages/maintenance-routes/index";
import MaintenanceRoutesImport from "@/pages/MaintenanceRoutesImport";
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
import WorkOrders from "@/pages/WorkOrders";
import CustomerPortal from "@/pages/CustomerPortal";
import PortalCustomerRedeem from "@/pages/PortalCustomerRedeem";
import PortalCrewRedeem from "@/pages/PortalCrewRedeem";
import MessagesPage from "@/pages/Messages";
import TimeReports from "@/pages/admin/TimeReports";
import ServiceTypesPage from "@/pages/admin/ServiceTypesPage";
import BusinessRulesPage from "@/pages/admin/BusinessRulesPage";
import RegionalSettingsPage from "@/pages/admin/RegionalSettingsPage";
import NotificationCenterPage from "@/pages/admin/NotificationCenterPage";
import AutomationCenterPage from "@/pages/admin/AutomationCenterPage";
import FeatureFlagsPage from "@/pages/admin/FeatureFlagsPage";
import FeedbackReportsPage from "@/pages/admin/FeedbackReportsPage";
import WorksheetReview from "@/pages/admin/WorksheetReview";
import RouteDayDetail from "@/pages/admin/RouteDayDetail";
import TimeCardApproval from "@/pages/admin/TimeCardApproval";
import TimeAdminPage from "@/pages/admin/TimeAdminPage";
import CompanyCamReconciliation from "@/pages/admin/CompanyCamReconciliation";
import CustomerDuplicates from "@/pages/admin/CustomerDuplicates";
import CompanyCamHealth from "@/pages/admin/CompanyCamHealth";
import SystemHealthPage from "@/pages/admin/SystemHealth";
import MaintenanceReportsPage from "@/pages/admin/MaintenanceReports";
import InquiryPage from "@/pages/Inquiry";
import InquirySuccess from "@/pages/InquirySuccess";
import BookingPage from "@/pages/BookingPage";
import ManagerDashboard from "@/pages/ManagerDashboard";
import OverduePage from "@/pages/Overdue";
import DailyPlanPage from "@/pages/DailyPlan";
import AdminInbox from "@/pages/AdminInbox";
import DocumentLibraryPage from "@/pages/admin/DocumentLibraryPage";
import SetupWizardPage from "@/pages/admin/SetupWizardPage";
import AIKnowledgePage from "@/pages/admin/AIKnowledgePage";
import UserManagementPage from "@/pages/admin/UserManagementPage";
import AccessRequestsPage from "@/pages/admin/AccessRequestsPage";
import AgreementTemplatesPage from "@/pages/admin/AgreementTemplatesPage";
import SopPipelinePage from "@/pages/admin/SopPipelinePage";
import SharedLinksPage from "@/pages/admin/SharedLinksPage";
import CompanyHub from "@/pages/CompanyHub";

const ADMIN_ONLY = ["Admin"];
const ADMIN_OR_MANAGER = ["Admin", "Manager"];
const STAFF_ROLES = ["Admin", "Manager", "Crew"];
const TOOL_CALCULATOR_ROLES = TOOL_ROLES["calculator"];
const TOOL_PLOW_MAPPER_ROLES = TOOL_ROLES["plow-mapper"];
const TOOL_LEAD_QUALIFIER_ROLES = TOOL_ROLES["lead-qualifier"];
const TOOL_FORMS_ROLES = TOOL_ROLES["forms"];

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
      <h1 className="text-xl font-semibold">Access Denied</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        You don't have permission to view this page. Contact your administrator if you need access.
      </p>
      <a href="/" className="text-sm text-primary underline underline-offset-4">Return to Home</a>
    </div>
  );
}

function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
}: {
  path: string;
  component: React.ComponentType;
  allowedRoles: string[];
}) {
  const { user } = useAuth();
  const allowed = !!user && (allowedRoles.includes(user.role) || !!(user as any).isMasterAdmin);
  return <Route path={path} component={allowed ? Component : AccessDenied} />;
}

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
  const isCrew = user?.role === "Crew";
  const defaultPath = isCustomer ? "/customer-hub" : isCrew ? "/my-day" : "/";

  return (
    <AppShell>
      <DocumentTitleSetter />
      <Switch>
        <Route path="/">
          {isCustomer ? <Redirect to="/customer-hub" /> : isCrew ? <Redirect to="/my-day" /> : <Home />}
        </Route>
        <Route path="/auth">
          <Redirect to={defaultPath} />
        </Route>
        <Route path="/customer-hub/:section?" component={CustomerHub} />
        <Route path="/applicant" component={ApplicantPortal} />
        <ProtectedRoute path="/settings-system" component={SettingsSystemHub} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin" component={AdminPanel} allowedRoles={ADMIN_ONLY} />
        <Route path="/sops" component={SOPs} />
        <Route path="/materials"><Redirect to="/catalog" /></Route>
        <ProtectedRoute path="/people" component={PeopleHub} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/sales" component={SalesHub} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/hiring" component={Hiring} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/marketing" component={Marketing} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/forms" component={Forms} allowedRoles={TOOL_FORMS_ROLES} />
        <Route path="/customer-resources" component={Education} />
        <Route path="/profile" component={Profile} />
        <ProtectedRoute path="/employees/import" component={EmployeesImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/employees" component={Employees} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/vendors/import" component={VendorsImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/vendors" component={Vendors} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/customers/import" component={CustomersImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/properties/import" component={PropertiesImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/plow-sites/import" component={PlowSitesImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/maintenance-routes/import" component={MaintenanceRoutesImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/maintenance-routes" component={MaintenanceRoutes} allowedRoles={ADMIN_OR_MANAGER} />
        <Route path="/onboarding-forms/:formType?/:submissionId?" component={FormHub} />
        <Route path="/employee" component={EmployeePortal} />
        <Route path="/employee-portal" component={EmployeePortal} />
        <Route path="/hq"><Redirect to="/?tab=company-hq" /></Route>
        <ProtectedRoute path="/jobs" component={JobList} allowedRoles={STAFF_ROLES} />
        <ProtectedRoute path="/jobs/:id" component={JobDetail} allowedRoles={STAFF_ROLES} />
        <ProtectedRoute path="/finance" component={FinanceHub} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/invoices" component={InvoiceList} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/invoices/:id" component={InvoiceDetail} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/estimates" component={EstimateList} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/estimates/:id/preview" component={EstimatePreview} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/estimates/:id" component={EstimateDetail} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/scheduling" component={SchedulingCalendar} allowedRoles={STAFF_ROLES} />
        <Route path="/my-day" component={MyDayPage} />
        <Route path="/my-hours" component={MyHoursPage} />
        <Route path="/help" component={Help} />
        <Route path="/admin-setup" component={AdminSetup} />
        <ProtectedRoute path="/equipment/import" component={EquipmentImport} allowedRoles={ADMIN_OR_MANAGER} />
        <Route path="/equipment" component={EquipmentTracker} />
        <Route path="/search" component={SearchPage} />
        <Route path="/todos" component={Tasks} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/daily-worksheet"><Redirect to="/my-day" /></Route>
        <Route path="/clock-out-review" component={ClockOutReviewPage} />
        <Route path="/worksheet-review/:id" component={WorksheetReviewDetail} />
        <Route path="/worksheet-review" component={WorksheetReviewList} />
        <ProtectedRoute path="/admin/route-days/:routeDayId" component={RouteDayDetail} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/work-areas" component={WorkAreasPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/qbo-export" component={QBOExportPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/archive" component={ArchivePage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/time" component={TimeAdminPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/time-reports" component={TimeReports} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/documents" component={DocumentLibraryPage} allowedRoles={ADMIN_ONLY} />
        <Route path="/admin/worksheet-review"><Redirect to="/admin/time?tab=worksheet" /></Route>
        <Route path="/admin/time-card-approval"><Redirect to="/admin/time?tab=approval" /></Route>
        <ProtectedRoute path="/admin/service-types" component={ServiceTypesPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/setup-wizard" component={SetupWizardPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/business-rules" component={BusinessRulesPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/ai-knowledge" component={AIKnowledgePage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/automation-center" component={AutomationCenterPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/regional-settings" component={RegionalSettingsPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/notification-center" component={NotificationCenterPage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/admin/feature-flags" component={FeatureFlagsPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/feedback" component={FeedbackReportsPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/companycam-reconciliation" component={CompanyCamReconciliation} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/customer-duplicates" component={CustomerDuplicates} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/companycam-health" component={CompanyCamHealth} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/system-health" component={SystemHealthPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/maintenance-reports" component={MaintenanceReportsPage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/admin/users" component={UserManagementPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/access-requests" component={AccessRequestsPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/agreements" component={AgreementTemplatesPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/sop-pipeline" component={SopPipelinePage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/admin/shared-links" component={SharedLinksPage} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/company" component={CompanyHub} allowedRoles={STAFF_ROLES} />
        <Route path="/budget-settings"><Redirect to="/mors-budget?tab=mark-up" /></Route>
        <Route path="/time" component={TimeTracking} />
        <ProtectedRoute path="/manager-dashboard" component={ManagerDashboard} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/overdue" component={OverduePage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/daily-plan" component={DailyPlanPage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/admin/inbox" component={AdminInbox} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/reports" component={ReportsPage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/consultations" component={ConsultationsPage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/mors-budget" component={MorsBudget} allowedRoles={ADMIN_ONLY} />
        <Route path="/admin/employees"><Redirect to="/employees" /></Route>
        <Route path="/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/customers" component={CustomerList} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/customers/:id" component={CustomerDetail} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/tools/plow-mapper" component={() => <PlowSiteMapper />} allowedRoles={TOOL_PLOW_MAPPER_ROLES} />
        <Route path="/tools/process-auditor" component={ProcessAuditor} />
        <Route path="/tools/integration-wizard" component={IntegrationWizard} />
        <ProtectedRoute path="/tools/calculator" component={() => <CalculatorPage />} allowedRoles={TOOL_CALCULATOR_ROLES} />
        <ProtectedRoute path="/tools/lead-qualifier" component={() => <LeadQualifier />} allowedRoles={TOOL_LEAD_QUALIFIER_ROLES} />
        <ProtectedRoute path="/tools" component={Tools} allowedRoles={STAFF_ROLES} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/training" component={TestingKnowledge} />
        <ProtectedRoute path="/settings" component={SettingsPage} allowedRoles={ADMIN_OR_MANAGER} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/customer-messages" component={CustomerMessagesInbox} />
        <ProtectedRoute path="/customer-blasts" component={CustomerBlasts} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/catalog/import" component={CatalogImport} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/catalog/:id" component={CatalogDetail} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/catalog" component={CatalogPage} allowedRoles={ADMIN_OR_MANAGER} />
        <ProtectedRoute path="/plant-cards" component={PlantCards} allowedRoles={ADMIN_ONLY} />
        <ProtectedRoute path="/work-orders" component={WorkOrders} allowedRoles={STAFF_ROLES} />
        <Route path="/route"><Redirect to="/my-day" /></Route>
        <Route path="/daily-agenda"><Redirect to="/my-day" /></Route>
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
              <AccessibilityApplicator />
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

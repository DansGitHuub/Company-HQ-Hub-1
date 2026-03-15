import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { VoiceProvider } from "@/hooks/use-voice";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppShell from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";

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
import Integrations from "@/pages/Integrations";
import Education from "@/pages/Education";
import EmployeePortal from "@/pages/EmployeePortal";
import Employees from "@/pages/Employees";
import FormHub from "@/pages/FormHub";
import HQOverview from "@/pages/HQOverview";
import JobPipeline from "@/pages/JobPipeline";
import Help from "@/pages/Help";
import Profile from "@/pages/Profile";
import AdminSetup from "@/pages/AdminSetup";
import EquipmentTracker from "@/pages/EquipmentTracker";
import SearchPage from "@/pages/Search";
import TodoList from "@/pages/TodoList";

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
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (window.location.pathname.startsWith("/shared/")) {
    return <SharedDocument />;
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
        <Route path="/integrations" component={Integrations} />
        <Route path="/education" component={Education} />
        <Route path="/profile" component={Profile} />
        <Route path="/employees" component={Employees} />
        <Route path="/onboarding-forms/:formType?/:submissionId?" component={FormHub} />
        <Route path="/employee" component={EmployeePortal} />
        <Route path="/employee-portal" component={EmployeePortal} />
        <Route path="/hq" component={HQOverview} />
        <Route path="/jobs" component={JobPipeline} />
        <Route path="/help" component={Help} />
        <Route path="/admin-setup" component={AdminSetup} />
        <Route path="/equipment" component={EquipmentTracker} />
        <Route path="/search" component={SearchPage} />
        <Route path="/todos" component={TodoList} />
        <Route path="/tools/plow-mapper" component={PlowSiteMapper} />
        <Route path="/tools/process-auditor" component={ProcessAuditor} />
        <Route path="/tools/integration-wizard" component={IntegrationWizard} />
        <Route path="/tools/calculator" component={CalculatorPage} />
        <Route path="/tools/lead-qualifier" component={LeadQualifier} />
        <Route path="/care-guides" component={CareGuideManager} />
        <Route path="/tools" component={Tools} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/testing" component={TestingKnowledge} />
        <Route path="/settings" component={SettingsPage} />
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
            <AppProvider>
              <VoiceProvider>
                <Toaster />
                <AppRoutes />
              </VoiceProvider>
            </AppProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

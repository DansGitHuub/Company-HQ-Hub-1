import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import AppShell from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";

import Home from "@/pages/Home";
import AuthPage from "@/pages/auth-page";
import AdminPanel from "@/pages/AdminPanel";
import SOPs from "@/pages/SOPs";
import Materials from "@/pages/Materials";
import Hiring from "@/pages/Hiring";
import Marketing from "@/pages/Marketing";
import Forms from "@/pages/Forms";
import Integrations from "@/pages/Integrations";
import Education from "@/pages/Education";
import EmployeePortal from "@/pages/EmployeePortal";
import HQOverview from "@/pages/HQOverview";
import JobPipeline from "@/pages/JobPipeline";
import Assistant from "@/pages/Assistant";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const { user, isLoading } = useAuth();

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

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/auth">
          <Redirect to="/" />
        </Route>
        <Route path="/admin" component={AdminPanel} />
        <Route path="/sops" component={SOPs} />
        <Route path="/materials" component={Materials} />
        <Route path="/hiring" component={Hiring} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/forms" component={Forms} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/education" component={Education} />
        <Route path="/profile" component={EmployeePortal} />
        <Route path="/hq" component={HQOverview} />
        <Route path="/jobs" component={JobPipeline} />
        <Route path="/assistant" component={Assistant} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppProvider>
            <Toaster />
            <AppRoutes />
          </AppProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

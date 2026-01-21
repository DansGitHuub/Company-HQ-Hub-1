import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/store";
import AppShell from "@/components/layout/AppShell";

import Home from "@/pages/Home";
import SOPs from "@/pages/SOPs";
import Materials from "@/pages/Materials";
import Hiring from "@/pages/Hiring";
import Marketing from "@/pages/Marketing";
import Forms from "@/pages/Forms";
import Integrations from "@/pages/Integrations";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sops" component={SOPs} />
        <Route path="/materials" component={Materials} />
        <Route path="/hiring" component={Hiring} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/forms" component={Forms} />
        <Route path="/integrations" component={Integrations} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Router />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

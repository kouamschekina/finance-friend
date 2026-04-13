import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { UIProvider } from "@/contexts/UIContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Advisor from "./pages/Advisor";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import { InstallPWA } from "@/components/InstallPWA";
import { AutoPushPrompt } from "@/components/AutoPushPrompt";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Landing } from "./pages/Landing";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();
  const [skipLanding, setSkipLanding] = useState(() => {
    return sessionStorage.getItem('fenowa-skip-landing') === 'true';
  });

  // Only block render if we're loading AND online — offline we use persisted state
  // and should never show a blank screen.
  if (loading && navigator.onLine) return null;

  if (!user && !skipLanding) {
    return <Landing onContinueLater={() => {
      setSkipLanding(true);
      sessionStorage.setItem('fenowa-skip-landing', 'true');
    }} />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/advisor" element={<Advisor />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LocaleProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <FinanceProvider>
              <UIProvider>
                <InstallPWA />
                <AutoPushPrompt />
                <OfflineBanner />
                <BrowserRouter>
                  <AppContent />
                </BrowserRouter>
              </UIProvider>
            </FinanceProvider>
          </AuthProvider>
        </TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

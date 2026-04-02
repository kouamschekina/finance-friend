import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Advisor from "./pages/Advisor";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FinanceProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/advisor" element={<Advisor />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </FinanceProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

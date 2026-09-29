import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Import thêm Navigate
import Index from "./pages/Index";
import Login from "./pages/Login";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Payslips from "./pages/Payslips";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );

  return (
    <Routes>
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/" replace />}
      />

      <Route
        path="/"
        element={user ? <Index /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/employees"
        element={user ? <Employees /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/attendance"
        element={user ? <Attendance /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/payroll"
        element={user ? <Payroll /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/payslips"
        element={user ? <Payslips /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/settings"
        element={user ? <Settings /> : <Navigate to="/login" replace />}
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster />
            <Sonner />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

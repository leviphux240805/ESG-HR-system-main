import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import FilesDemo from "./pages/FilesDemo";
import NotFound from "./pages/NotFound";

// Các trang ESG cũ (Employees, Attendance, Payroll, Payslips, Settings, Dashboard) còn gọi Supabase nên chưa được
// import; mỗi trang được đưa lại vào đây ở giai đoạn chuyển đổi tương ứng (xem docs/tien-do.md).

function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Đang tải...
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function AppRoutes() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={status === "authenticated" ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/files-demo"
        element={
          <RequireAuth>
            <FilesDemo />
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
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

export default App;

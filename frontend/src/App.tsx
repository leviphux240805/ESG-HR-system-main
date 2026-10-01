import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { queryClient } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { CHANGE_PASSWORD_PATH, FullPageSpinner, RequireAuth, RequirePermission } from "@/components/layout/RouteGuards";
import { routableNavItems, routableSubRoutes } from "@/lib/navigation";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";

// Các trang ESG cũ còn gọi Supabase (Attendance, Payroll, Payslips, Settings) chưa được import; mỗi trang được nối
// vào lib/navigation.ts ở giai đoạn chuyển đổi tương ứng (xem docs/tien-do.md).

const ComingSoon = lazy(() => import("./pages/ComingSoon"));

// Trang mẫu component: chỉ có ở dev, không vào bundle production
const DevUi = import.meta.env.DEV ? lazy(() => import("./pages/DevUi")) : null;

/** Route sinh từ cấu hình menu (lib/navigation.ts): mỗi trang lazy-load, có kiểm tra quyền. */
const NAV_ROUTES: { path: string; item: ReturnType<typeof routableNavItems>[number]; Page: LazyExoticComponent<ComponentType> }[] =
  routableNavItems().map((item) => ({ path: item.path, item, Page: item.page ? lazy(item.page) : ComingSoon }));

const SUB_ROUTE_PAGES = routableSubRoutes().map((route) => ({ route, Page: lazy(route.page) }));

/** Đã đăng nhập thì rời trang đăng nhập, về trang đang định mở trước đó (nếu có). */
function LoginRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status !== "authenticated") return <Login />;
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
}

function AppRoutes() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path={CHANGE_PASSWORD_PATH}
        element={
          <RequireAuth>
            <ChangePassword />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AuthenticatedLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        {NAV_ROUTES.map(({ path, item, Page }) => (
          <Route
            key={path}
            path={path}
            element={
              <RequirePermission permission={item.permission}>
                <Page />
              </RequirePermission>
            }
          />
        ))}
        {SUB_ROUTE_PAGES.map(({ route, Page }) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <RequirePermission permission={route.permission}>
                <Page />
              </RequirePermission>
            }
          />
        ))}
        {DevUi && <Route path="/dev/ui" element={<DevUi />} />}
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Trang nhúng không đọc được đường dẫn URL (VITE_ROUTER=memory): điều hướng giữ trong bộ nhớ
const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster />
          <Sonner />
        </Router>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

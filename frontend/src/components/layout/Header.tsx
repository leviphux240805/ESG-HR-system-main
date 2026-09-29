import { Bell, ChevronRight, Search, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

const breadcrumbLabels: Record<string, string> = {
  "/": "Bảng điều khiển",
  "/employees": "Nhân viên",
  "/payroll": "Bảng lương",
  "/payslips": "Phiếu lương",
  "/settings": "Cài đặt",
};

export function Header() {
  const location = useLocation();
  const currentLabel = breadcrumbLabels[location.pathname] || "Bảng điều khiển";
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Trang chủ</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{currentLabel}</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Search */}
          {/* <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="w-64 pl-10 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div> */}

          {/* Notifications */}
          {/* <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          </Button> */}

          {/* Logout button */}
          <div className="flex-1">
            <Button
              variant="outline"
              onClick={signOut}
              className=" w-44 bg-red-600 text-white border-red-600 hover:bg-transparent hover:text-red-600 hover:border-red-600 transition-colors duration-300"
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

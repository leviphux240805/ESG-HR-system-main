import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  FileText,
  Settings,
  Building2,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Bảng điều khiển" },
  { to: "/employees", icon: Users, label: "Nhân viên" },
  { to: "/attendance", icon: CalendarCheck, label: "Chấm công" },
  { to: "/payroll", icon: DollarSign, label: "Bảng lương" },
  { to: "/payslips", icon: FileText, label: "Phiếu lương" },
  // { to: "/settings", icon: Settings, label: "Cài đặt" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar-gradient w-60 h-screen fixed top-0 left-0 z-10 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-foreground/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-sidebar-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              ENSOGO Portal
            </h1>
            <p className="text-xs text-sidebar-foreground/70">
              Quản lý nhân sự
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive &&
                      "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="px-4 py-3 rounded-lg bg-sidebar-foreground/10">
          <p className="text-xs text-sidebar-foreground/70">
            Giai đoạn hiện tại
          </p>
          <p className="text-sm font-medium text-sidebar-foreground">
            Tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </aside>
  );
}

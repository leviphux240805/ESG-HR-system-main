import { NavLink, useLocation } from "react-router-dom";
import { School } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";
import { NAV_ITEMS } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";

/** Nội dung sidebar, dùng chung cho sidebar cố định (máy tính) và ngăn kéo (điện thoại). */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { hasRole } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="flex h-full flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-foreground/20 flex items-center justify-center">
            <School className="w-6 h-6 text-sidebar-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-sidebar-foreground">{APP_NAME}</h1>
            <p className="text-xs text-sidebar-foreground/70">Chuỗi trường mầm non</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive && "bg-sidebar-foreground/15 text-sidebar-foreground font-medium",
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
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar-gradient hidden md:block w-60 h-screen fixed top-0 left-0 z-10">
      <SidebarContent />
    </aside>
  );
}

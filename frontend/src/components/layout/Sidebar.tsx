import { NavLink, useLocation } from "react-router-dom";
import { School } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { visibleNavGroups } from "@/lib/navigation";
import { usePermissions } from "@/hooks/useCan";

/** Nội dung sidebar, dùng chung cho sidebar cố định (máy tính) và ngăn kéo (điện thoại). */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const check = usePermissions();
  const groups = visibleNavGroups(check);

  return (
    <div className="flex h-full flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-foreground/20 flex items-center justify-center">
            <School className="w-6 h-6 text-sidebar-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-sidebar-foreground">{APP_NAME}</h1>
            <p className="text-xs text-sidebar-foreground/70">{APP_TAGLINE}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto space-y-4" aria-label="Menu chính">
        {groups.map((group, index) => (
          <div key={group.label ?? index}>
            {group.label && (
              <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/60">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                // Trang con (/nhan-su/123) vẫn đánh dấu mục cha
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 px-4 min-h-11 rounded-lg transition-all duration-200",
                        "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                        isActive && "bg-sidebar-foreground/15 text-sidebar-foreground font-medium",
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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

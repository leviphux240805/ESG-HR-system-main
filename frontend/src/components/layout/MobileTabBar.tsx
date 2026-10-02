import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { usePermissions } from "@/hooks/useCan";
import { mobileTabs } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useApprovals } from "@/api";

function ApprovalBadge() {
  const count = useApprovals().data?.length ?? 0;
  if (!count) return null;
  return (
    <span className="absolute -top-1 left-1/2 ml-1 min-w-4 rounded-full bg-destructive px-1 text-[0.625rem] font-semibold leading-4 text-destructive-foreground" aria-label={`${count} mục chờ duyệt`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Thanh điều hướng dưới cùng trên điện thoại: 4 trang dùng nhiều nhất theo vai trò + nút mở menu đầy đủ. */
export function MobileTabBar({ onMenu }: { onMenu: () => void }) {
  const tabs = mobileTabs(usePermissions());
  const item = "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium";
  return (
    <nav
      aria-label="Điều hướng nhanh"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => (
          <li key={tab.path}>
            <NavLink to={tab.path} className={({ isActive }) => cn(item, isActive ? "text-primary" : "text-muted-foreground")}>
              <span className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.path === "/hop-duyet" && <ApprovalBadge />}
              </span>
              {tab.label}
            </NavLink>
          </li>
        ))}
        <li className={cn(tabs.length < 4 && `col-start-5`)}>
          <button type="button" onClick={onMenu} className={cn(item, "w-full text-muted-foreground")}>
            <Menu className="h-5 w-5" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}

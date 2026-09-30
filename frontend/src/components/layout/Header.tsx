import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, LogOut, Menu, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { findNavItem, ROLE_LABELS } from "@/lib/navigation";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { SidebarContent } from "./Sidebar";

const ALL_SCHOOLS = "ALL";

/** Bộ chọn cơ sở: cấp chuỗi có "Tất cả cơ sở"; người chỉ có một cơ sở thì bị khóa vào cơ sở đó. */
function SchoolSelector() {
  const { schoolId, schools, canChooseAll, locked, select } = useCurrentSchool();
  if (schools.length === 0 && !canChooseAll) return null;

  return (
    <Select
      value={schoolId ?? ALL_SCHOOLS}
      onValueChange={(value) => select(value === ALL_SCHOOLS ? null : value)}
      disabled={locked}
    >
      <SelectTrigger className="w-40 sm:w-56 min-h-11" aria-label="Chọn cơ sở">
        <SelectValue placeholder="Chọn cơ sở" />
      </SelectTrigger>
      <SelectContent>
        {canChooseAll && <SelectItem value={ALL_SCHOOLS}>Tất cả cơ sở</SelectItem>}
        {schools.map((school) => (
          <SelectItem key={school.id} value={school.id}>
            {school.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  if (!me) return null;
  const roleNames = [...new Set(me.roles.map((r) => ROLE_LABELS[r.role]))].join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <UserCircle className="w-6 h-6 text-muted-foreground" />
          <span className="hidden lg:inline text-sm font-medium">{me.fullName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="font-medium">{me.fullName}</p>
          <p className="text-xs font-normal text-muted-foreground">{me.email}</p>
          <p className="text-xs font-normal text-muted-foreground">{roleNames}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = findNavItem(location.pathname);

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-11 w-11"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <nav aria-label="Vị trí" className="hidden sm:flex items-center gap-2 text-sm min-w-0">
            {current?.group.label && (
              <>
                <span className="text-muted-foreground">{current.group.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </>
            )}
            {current?.subLabel ? (
              <>
                <span className="text-muted-foreground">{current.item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground truncate">{current.subLabel}</span>
              </>
            ) : (
              <span className="font-medium text-foreground truncate">{current?.item.label ?? ""}</span>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <SchoolSelector />
          <UserMenu />
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="sidebar-gradient w-64 p-0 border-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}

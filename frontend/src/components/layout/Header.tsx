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
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/navigation";
import { SidebarContent } from "./Sidebar";

const ALL_SCHOOLS = "ALL";

/** Bộ chọn cơ sở: cấp chuỗi có "Tất cả cơ sở"; người chỉ có một cơ sở thì bị khóa vào cơ sở đó. */
function SchoolSelector() {
  const { me, selectedSchoolId, selectSchool } = useAuth();
  if (!me) return null;
  const locked = !me.chainWide && me.schools.length <= 1;

  return (
    <Select
      value={selectedSchoolId ?? ALL_SCHOOLS}
      onValueChange={(value) => selectSchool(value === ALL_SCHOOLS ? null : value)}
      disabled={locked}
    >
      <SelectTrigger className="w-44 sm:w-56" aria-label="Chọn cơ sở">
        <SelectValue placeholder="Chọn cơ sở" />
      </SelectTrigger>
      <SelectContent>
        {me.chainWide && <SelectItem value={ALL_SCHOOLS}>Tất cả cơ sở</SelectItem>}
        {me.schools.map((school) => (
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
  const currentLabel = NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? "Trang chủ";

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Trang chủ</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground truncate">{currentLabel}</span>
          </div>
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

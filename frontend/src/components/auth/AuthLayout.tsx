import { ReactNode } from "react";
import { School } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Khung chung của các trang chưa đăng nhập: panel thương hiệu bên trái (màn hình lớn) + form bên phải. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden sidebar-gradient">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <School className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
              <p className="text-sm text-white/80">{APP_TAGLINE}</p>
            </div>
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-white/60">© {new Date().getFullYear()} {APP_NAME}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg sidebar-gradient flex items-center justify-center">
              <School className="w-6 h-6 text-sidebar-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">{APP_NAME}</h1>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

/** Ô nhập kiểu của các trang xác thực. */
export const authInputClass =
  "w-full pl-11 pr-4 py-3 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground transition-all";

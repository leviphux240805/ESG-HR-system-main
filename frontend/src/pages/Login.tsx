import { useState } from "react";
import { ChevronRight, Eye, EyeOff, GraduationCap, Loader2, Lock, type LucideIcon, User, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthLayout, authInputClass } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/api";
import { IS_DEMO } from "@/api";
import type { DemoRole } from "@/api";

const DEMO_ROLES: { role: DemoRole; label: string; description: string; icon: LucideIcon }[] = [
  { role: "principal", label: "Hiệu trưởng", description: "Điều hành 2 cơ sở: hôm nay, duyệt, nhân sự, học phí, báo cáo", icon: UserCheck },
  { role: "vice", label: "Phó hiệu trưởng", description: "Chuyên môn, nuôi dưỡng: lớp, trẻ, điểm danh, thực đơn, cân đo", icon: Users },
  { role: "teacher", label: "Giáo viên", description: "Điểm danh lớp trên điện thoại, xin nghỉ, việc được giao", icon: GraduationCap },
];

/** Bản demo: chọn vai trò thay cho đăng nhập. */
function DemoLogin() {
  const { loginAs } = useAuth();
  const [busy, setBusy] = useState<DemoRole | null>(null);
  const choose = async (role: DemoRole) => {
    setBusy(role);
    try {
      await loginAs(role);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  };
  return (
    <AuthLayout title="Chào mừng đến Mầm Non Việt" subtitle="Bản demo: chọn vai trò để trải nghiệm, dữ liệu là dữ liệu mẫu">
      <div className="space-y-3">
        {DEMO_ROLES.map(({ role, label, description, icon: Icon }) => (
          <button
            key={role}
            type="button"
            onClick={() => choose(role)}
            disabled={busy !== null}
            className="w-full flex items-center gap-4 rounded-xl border bg-card p-4 text-left min-h-16 transition-colors hover:border-primary hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              {busy === role ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{label}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Thay đổi được lưu trên trình duyệt này; khôi phục dữ liệu mẫu ở menu tài khoản.</p>
    </AuthLayout>
  );
}

export default function Login() {
  return IS_DEMO ? <DemoLogin /> : <PasswordLogin />;
}

function PasswordLogin() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Đăng nhập xong, route /login tự chuyển về trang đang định mở (App.tsx › LoginRoute)
      await login(identifier.trim(), password, rememberMe);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Chào mừng bạn quay trở lại" subtitle="Đăng nhập vào tài khoản của bạn để tiếp tục">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-foreground mb-2">
              Email hoặc số điện thoại
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ten@truong.vn hoặc 0912 345 678"
                className={authInputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${authInputClass} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
            <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
              Ghi nhớ đăng nhập
            </label>
          </div>
        </div>

        <Button type="submit" className="w-full py-6 text-base font-medium" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Đăng nhập
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản hoặc quên mật khẩu? Liên hệ hiệu trưởng để được cấp hoặc đặt lại mật khẩu.
      </p>
    </AuthLayout>
  );
}

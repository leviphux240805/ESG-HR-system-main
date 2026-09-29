import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, School, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/api/errors";
import { APP_NAME } from "@/lib/brand";

export default function Login() {
  const navigate = useNavigate();
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
      await login(identifier.trim(), password, rememberMe);
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Bên trái – thương hiệu */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden sidebar-gradient">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <School className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
              <p className="text-sm text-white/80">Hệ thống quản lý chuỗi trường mầm non</p>
            </div>
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-white/60">© {new Date().getFullYear()} {APP_NAME}</p>
        </div>
      </div>

      {/* Bên phải – form đăng nhập */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg sidebar-gradient flex items-center justify-center">
              <School className="w-6 h-6 text-sidebar-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">{APP_NAME}</h1>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Chào mừng bạn quay trở lại</h2>
            <p className="mt-2 text-muted-foreground">Đăng nhập vào tài khoản của bạn để tiếp tục</p>
          </div>

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
                    className="w-full pl-11 pr-4 py-3 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground transition-all"
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
                    className="w-full pl-11 pr-12 py-3 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground transition-all"
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
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Ghi nhớ đăng nhập
                </label>
              </div>
              <button
                type="button"
                onClick={() =>
                  toast.info("Vui lòng liên hệ văn phòng điều hành để được đặt lại mật khẩu.")
                }
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            <Button type="submit" className="w-full py-6 text-base font-medium" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Đăng nhập
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Chưa có tài khoản? Tài khoản do văn phòng điều hành cấp.
          </p>
        </div>
      </div>
    </div>
  );
}

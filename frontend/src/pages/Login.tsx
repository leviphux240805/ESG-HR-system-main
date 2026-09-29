import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Phone, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { signInWithPhone } from "@/service/authService";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signInWithPhone(phone, password);
    setIsLoading(false);

    if (result.success) {
      navigate("/");
    } else {
      console.error("Login error:", result.message);
      toast.error("Lỗi đăng nhập: " + result.message);
    }
  };

  // const handleGoogleLogin = async () => {
  //   setIsLoading(true);
  //   try {
  //     const { error } = await supabase.auth.signInWithOAuth({
  //       provider: 'google',
  //       options: {
  //         redirectTo: window.location.origin // Redirect back to your app after auth
  //       }
  //     });

  //     if (error) {
  //       console.error('Google login error:', error.message);
  //       alert('Lỗi đăng nhập: ' + error.message);
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error during Google login:', error);
  //     alert('Đã xảy ra lỗi không xác định khi đăng nhập với Google');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="/images/clover.png"
            alt="Ensogo Background"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ENSOGO Portal</h1>
              <p className="text-sm text-white/80">Hệ Thống Quản Lý Nhân Sự</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-white/60">
            © 2025 ENSOGO Portal. Le Dac Quan
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg sidebar-gradient flex items-center justify-center">
              <Building2 className="w-6 h-6 text-sidebar-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">ENSOGO Portal</h1>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Chào mừng bạn quay trở lại
            </h2>
            <p className="mt-2 text-muted-foreground">
              Đăng nhập vào tài khoản của bạn để tiếp tục
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setPhone(value);
                    }}
                    placeholder="Số điện thoại"
                    className="w-full pl-11 pr-4 py-3 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Ghi nhớ đăng nhập
                </label>
              </div>
              <a
                href="#"
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Quên mật khẩu?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full py-6 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading && phone ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Đăng Nhập
            </Button>

            {/* <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-background text-muted-foreground">
                  Hoặc tiếp tục với
                </span>
              </div>
            </div> */}

            {/* <Button
              type="button"
              variant="outline"
              className="w-full py-6 text-base font-medium gap-3"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Đăng nhập với Google
                </>
              )}
            </Button> */}
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Bạn chưa có tài khoản?{" "}
            <a
              href="#"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Liên hệ quản trị viên
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, authInputClass } from "@/components/auth/AuthLayout";
import { resetPassword } from "@/api";
import { errorMessage } from "@/api";

/** Kiểm tra nhanh phía giao diện; backend kiểm tra lại (ít nhất 8 ký tự, gồm chữ và số). */
function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số.";
  }
  if (password !== confirm) return "Mật khẩu nhập lại không khớp.";
  return null;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      toast.success("Đã đặt mật khẩu mới. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Đặt mật khẩu mới" subtitle="Mật khẩu ít nhất 8 ký tự, gồm cả chữ và số">
      {!token ? (
        <div className="rounded-lg border border-border bg-muted/50 p-6 text-center text-foreground">
          Link đặt lại mật khẩu không hợp lệ.{" "}
          <Link to="/forgot-password" className="text-primary font-medium">
            Yêu cầu link mới
          </Link>
          .
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={authInputClass}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-2">
                Nhập lại mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={authInputClass}
                  required
                />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full py-6 text-base font-medium" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Đặt mật khẩu mới
          </Button>
        </form>
      )}

      <p className="text-center text-sm">
        <Link to="/login" className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium">
          <ArrowLeft className="w-4 h-4" />
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}

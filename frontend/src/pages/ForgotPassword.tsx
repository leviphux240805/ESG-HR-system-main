import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, authInputClass } from "@/components/auth/AuthLayout";
import { forgotPassword } from "@/api";
import { errorMessage } from "@/api";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await forgotPassword(identifier);
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle="Nhập email hoặc số điện thoại, chúng tôi sẽ gửi link đặt lại mật khẩu tới email của tài khoản"
    >
      {sent ? (
        <div className="rounded-lg border border-border bg-muted/50 p-6 text-center space-y-3">
          <MailCheck className="w-10 h-10 mx-auto text-primary" />
          <p className="text-foreground">
            Nếu tài khoản tồn tại, email hướng dẫn đặt lại mật khẩu đã được gửi. Link có hiệu lực trong 30 phút.
          </p>
          <p className="text-sm text-muted-foreground">
            Không nhận được email? Kiểm tra hộp thư rác hoặc liên hệ văn phòng điều hành.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
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
          <Button type="submit" className="w-full py-6 text-base font-medium" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gửi link đặt lại mật khẩu
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

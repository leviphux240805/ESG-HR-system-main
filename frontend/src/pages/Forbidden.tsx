import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Trang 403: người dùng đã đăng nhập nhưng vai trò (theo cơ sở đang chọn) không được vào trang này. */
export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <ShieldX className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-semibold text-foreground">Bạn không có quyền truy cập trang này</h1>
        <p className="text-muted-foreground">
          Trang này không dành cho vai trò của bạn ở cơ sở đang chọn. Nếu bạn cần quyền truy cập, vui lòng liên hệ văn
          phòng điều hành.
        </p>
      </div>
      <Button asChild className="min-h-11">
        <Link to="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}

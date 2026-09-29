import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import { findNavItem } from "@/lib/navigation";

/** Trang tạm cho mục chưa làm; chỉ xuất hiện khi bật xem trước (VITE_PREVIEW_MODULES) ở dev. */
export default function ComingSoon() {
  const { pathname } = useLocation();
  const found = findNavItem(pathname);

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-3">
      <Construction className="w-10 h-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold text-foreground">{found?.item.label ?? "Trang"} – sắp có</h1>
      <p className="text-muted-foreground max-w-md">
        Trang này thuộc giai đoạn {found?.item.phase ?? "sau"} của lộ trình. Bạn đang xem trước menu ở môi trường dev.
      </p>
    </div>
  );
}

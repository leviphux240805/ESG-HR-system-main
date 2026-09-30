import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/useCan";
import { visibleNavGroups } from "@/lib/navigation";
import NotFound from "./NotFound";

/** "/" chuyển tới trang đầu tiên của menu theo vai trò: BGH → Hôm nay, giáo viên → Điểm danh. */
export default function Home() {
  const check = usePermissions();
  const first = visibleNavGroups(check)[0]?.items[0];
  return first ? <Navigate to={first.path} replace /> : <NotFound />;
}

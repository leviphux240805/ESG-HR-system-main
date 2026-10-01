import { useSearchParams } from "react-router-dom";
import { currentMonth, isMonth } from "@/features/attendance/codes";

/** Tháng đang xem lấy từ `?month=` (mặc định tháng hiện tại). */
export function useMonthParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = isMonth(searchParams.get("month")) ? searchParams.get("month")! : currentMonth();
  const setMonth = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("month", value);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };
  return [month, setMonth] as const;
}

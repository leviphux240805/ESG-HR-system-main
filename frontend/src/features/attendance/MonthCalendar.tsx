import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export interface CalendarDay {
  date: string;
  /** Ngày nghỉ tuần (tô xám). */
  off?: boolean;
  /** Tên ngày lễ (tô đỏ). */
  holiday?: string | null;
}

/**
 * Lịch tháng 7 cột (T2 → CN) dùng tốt trên điện thoại: mỗi ô là một ngày, nội dung do trang truyền vào.
 */
export function MonthCalendar({
  month,
  days,
  renderDay,
  label,
}: {
  month: string;
  days?: CalendarDay[];
  renderDay: (date: string) => ReactNode;
  label: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const count = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // T2 = 0
  const info = new Map((days ?? []).map((d) => [d.date, d]));
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <div role="table" aria-label={label} className="rounded-md border">
      <div role="row" className="grid grid-cols-7 border-b bg-muted/50">
        {HEADERS.map((h) => (
          <div key={h} role="columnheader" className="py-1 text-center text-xs font-medium text-muted-foreground">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="min-h-16 border-b border-r bg-muted/20" />;
          const d = info.get(date);
          return (
            <div
              key={date}
              role="cell"
              aria-label={`Ngày ${Number(date.slice(8))}`}
              title={d?.holiday ?? undefined}
              className={cn("min-h-16 border-b border-r p-1 text-xs", d?.holiday ? "bg-red-50" : d?.off && "bg-muted")}
            >
              <div className={cn("font-medium", d?.holiday && "text-red-600")}>{Number(date.slice(8))}</div>
              {renderDay(date)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import type { DayInfo, MonthSheet, SheetCell, StaffRow } from "./api";
import { codeTone, formatDays, WEEKDAY_SHORT } from "./codes";

const NAME_WIDTH = 208;
// Điện thoại: cột tên hẹp để thấy nhiều ngày hơn
const NAME_WIDTH_MOBILE = 120;
const DAY_WIDTH = 40;
const TOTAL_WIDTH = 60;
const ROW_HEIGHT = 40;
const TOTALS = [
  { key: "totalWork", label: "Công" },
  { key: "paidLeave", label: "Phép" },
  { key: "unpaidLeave", label: "K.lương" },
  { key: "lateCount", label: "Muộn" },
] as const;

function dayBackground(day: DayInfo): string {
  if (day.holiday) return "bg-red-50";
  if (!day.working) return "bg-muted";
  return "";
}

interface CellProps {
  staffId: string;
  staffName: string;
  date: string;
  cell: SheetCell | undefined;
  background: string;
  inRange: boolean;
  onOpen: (staffId: string, date: string) => void;
}

const GridCell = memo(function GridCell({ staffId, staffName, date, cell, background, inRange, onOpen }: CellProps) {
  const [, m, d] = date.split("-");
  if (!inRange) {
    return <div className="h-full border-r border-b bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,hsl(var(--muted))_4px,hsl(var(--muted))_6px)]" />;
  }
  const code = cell?.code ?? "";
  const label = `${staffName} ngày ${Number(d)}/${Number(m)}: ${code || "chưa chấm"}${cell?.discrepancy ? ", có sai lệch" : ""}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(staffId, date)}
      aria-label={label}
      title={cell?.lateMinutes ? `Muộn ${cell.lateMinutes} phút${cell.countedLate ? " (tính muộn)" : ""}` : cell?.note ?? undefined}
      className={cn(
        "relative h-full w-full border-r border-b text-xs font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        background,
        codeTone(code),
        cell?.discrepancy && "ring-2 ring-inset ring-amber-400",
      )}
    >
      {code}
      {cell?.discrepancy && <AlertTriangle className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-amber-500" aria-hidden />}
      {cell?.countedLate && <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />}
    </button>
  );
});

const Row = memo(function Row({
  row,
  days,
  backgrounds,
  nameWidth,
  onOpen,
}: {
  row: StaffRow;
  days: DayInfo[];
  backgrounds: string[];
  nameWidth: number;
  onOpen: (staffId: string, date: string) => void;
}) {
  return (
    <>
      <div
        className="sticky left-0 z-10 flex flex-col justify-center border-r border-b bg-background px-2 min-w-0"
        style={{ width: nameWidth }}
      >
        <span className="truncate text-sm font-medium">{row.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {row.staffCode}
          {row.machineCode && nameWidth === NAME_WIDTH ? ` · máy ${row.machineCode}` : ""}
        </span>
      </div>
      {days.map((day, i) => (
        <div key={day.date} style={{ width: DAY_WIDTH }}>
          <GridCell
            staffId={row.staffId}
            staffName={row.fullName}
            date={day.date}
            cell={row.cells[day.date]}
            background={backgrounds[i]}
            inRange={day.date >= row.activeFrom && day.date <= row.activeTo}
            onOpen={onOpen}
          />
        </div>
      ))}
      {TOTALS.map((t) => (
        <div
          key={t.key}
          className="flex items-center justify-center border-r border-b text-sm tabular-nums"
          style={{ width: TOTAL_WIDTH }}
        >
          {formatDays(Number(row.totals[t.key]))}
        </div>
      ))}
    </>
  );
});

/**
 * Lưới bảng công nhân viên × ngày. Hàng ảo hóa (chỉ vẽ hàng đang thấy), tiêu đề dính trên, cột tên dính trái; ô
 * `memo` nên sửa một ô không vẽ lại cả lưới. Ngày ngoài thời gian thuộc cơ sở (điều chuyển giữa tháng) gạch chéo.
 */
export function AttendanceGrid({ sheet, onOpen }: { sheet: MonthSheet; onOpen: (staffId: string, date: string) => void }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sheet.staff.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const nameWidth = useIsMobile() ? NAME_WIDTH_MOBILE : NAME_WIDTH;
  const width = nameWidth + sheet.days.length * DAY_WIDTH + TOTALS.length * TOTAL_WIDTH;
  const backgrounds = useMemo(() => sheet.days.map(dayBackground), [sheet.days]);
  const open = useCallback((staffId: string, date: string) => onOpen(staffId, date), [onOpen]);

  // Tháng hiện tại: cuộn để cột hôm nay nằm gần mép phải, thấy được các ngày đã qua
  useEffect(() => {
    const el = parentRef.current;
    const index = sheet.days.findIndex((d) => d.date === new Date().toLocaleDateString("sv-SE"));
    if (!el || index < 0) return;
    const visibleDays = Math.floor((el.clientWidth - nameWidth) / DAY_WIDTH);
    el.scrollLeft = Math.max(0, (index + 2 - visibleDays) * DAY_WIDTH);
  }, [sheet.month, sheet.days, nameWidth]);

  return (
    <div
      ref={parentRef}
      className="relative overflow-auto rounded-md border h-[calc(100dvh-17rem)] min-h-[20rem]"
      role="grid"
      aria-label="Bảng công tháng"
      aria-rowcount={sheet.staff.length + 1}
    >
      <div style={{ width, height: virtualizer.getTotalSize() + 48 }} className="relative">
        <div className="sticky top-0 z-20 flex bg-background" style={{ width, height: 48 }} role="row">
          <div
            className="sticky left-0 z-30 flex items-end border-r border-b bg-background px-2 pb-1 text-xs font-medium text-muted-foreground"
            style={{ width: nameWidth }}
          >
            Nhân viên
          </div>
          {sheet.days.map((day, i) => (
            <div
              key={day.date}
              title={day.holiday ?? undefined}
              className={cn(
                "flex flex-col items-center justify-center border-r border-b text-xs",
                backgrounds[i],
                day.holiday && "text-red-600",
              )}
              style={{ width: DAY_WIDTH }}
            >
              <span className="font-semibold">{Number(day.date.slice(8))}</span>
              <span className="text-[0.65rem] text-muted-foreground">{WEEKDAY_SHORT[day.weekday]}</span>
            </div>
          ))}
          {TOTALS.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-center border-r border-b text-xs font-medium text-muted-foreground"
              style={{ width: TOTAL_WIDTH }}
            >
              {t.label}
            </div>
          ))}
        </div>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={sheet.staff[item.index].staffId}
            role="row"
            className="absolute left-0 flex"
            style={{ top: 48 + item.start, height: ROW_HEIGHT, width }}
          >
            <Row row={sheet.staff[item.index]} days={sheet.days} backgrounds={backgrounds} nameWidth={nameWidth} onOpen={open} />
          </div>
        ))}
      </div>
    </div>
  );
}

import { memo, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

const NAME_WIDTH = 208;
// Điện thoại: cột tên hẹp để thấy nhiều ngày hơn
const NAME_WIDTH_MOBILE = 120;
const DAY_WIDTH = 40;
const TOTAL_WIDTH = 60;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;

const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export interface GridDay {
  date: string;
  /** 1 = thứ Hai … 7 = Chủ nhật */
  weekday: number;
  holiday?: string | null;
}

export interface GridTotal<R> {
  key: string;
  label: string;
  value: (row: R) => ReactNode;
  /** Ô tổng ở hàng cuối bảng */
  footer?: ReactNode;
}

interface Props<R, D extends GridDay> {
  label: string;
  nameHeader: string;
  rows: R[];
  rowKey: (row: R) => string;
  renderName: (row: R, compact: boolean) => ReactNode;
  days: D[];
  /** Nền của cột ngày (cuối tuần, ngày lễ) */
  dayBackground: (day: D) => string;
  /** Ô của một hàng trong một ngày; nên bọc `memo` + `useCallback` để sửa một ô không vẽ lại cả lưới */
  renderCell: (row: R, day: D, background: string) => ReactNode;
  totals: GridTotal<R>[];
  /** Hàng tổng dính dưới bảng theo từng ngày (dùng khi tắt ảo hóa) */
  footer?: { label: string; day: (day: D) => ReactNode };
  /** Ảo hóa hàng (bảng lớn); tắt để in đủ mọi hàng */
  virtualize?: boolean;
}

function GridRow<R, D extends GridDay>({
  row,
  days,
  backgrounds,
  nameWidth,
  renderName,
  renderCell,
  totals,
}: {
  row: R;
  days: D[];
  backgrounds: string[];
  nameWidth: number;
  renderName: Props<R, D>["renderName"];
  renderCell: Props<R, D>["renderCell"];
  totals: GridTotal<R>[];
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex flex-col justify-center border-r border-b bg-background px-2 min-w-0" style={{ width: nameWidth }}>
        {renderName(row, nameWidth !== NAME_WIDTH)}
      </div>
      {days.map((day, i) => (
        <div key={day.date} role="gridcell" style={{ width: DAY_WIDTH }}>
          {renderCell(row, day, backgrounds[i])}
        </div>
      ))}
      {totals.map((t) => (
        <div key={t.key} className="flex items-center justify-center border-r border-b text-sm tabular-nums" style={{ width: TOTAL_WIDTH }}>
          {t.value(row)}
        </div>
      ))}
    </>
  );
}

const MemoRow = memo(GridRow) as typeof GridRow;

/**
 * Lưới tháng: hàng (nhân viên, trẻ…) × ngày, tiêu đề dính trên, cột tên dính trái, cột tổng bên phải, hàng tổng dính
 * dưới. Mặc định ảo hóa hàng (chỉ vẽ hàng đang thấy); tắt ảo hóa để in.
 */
export function MonthGrid<R, D extends GridDay>({
  label,
  nameHeader,
  rows,
  rowKey,
  renderName,
  days,
  dayBackground,
  renderCell,
  totals,
  footer,
  virtualize = true,
}: Props<R, D>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    enabled: virtualize,
  });
  const nameWidth = useIsMobile() ? NAME_WIDTH_MOBILE : NAME_WIDTH;
  const width = nameWidth + days.length * DAY_WIDTH + totals.length * TOTAL_WIDTH;
  const backgrounds = useMemo(() => days.map(dayBackground), [days, dayBackground]);

  // Tháng hiện tại: cuộn để cột hôm nay nằm gần mép phải, thấy được các ngày đã qua
  useEffect(() => {
    const el = parentRef.current;
    const index = days.findIndex((d) => d.date === new Date().toLocaleDateString("sv-SE"));
    if (!el || index < 0) return;
    const visibleDays = Math.floor((el.clientWidth - nameWidth) / DAY_WIDTH);
    el.scrollLeft = Math.max(0, (index + 2 - visibleDays) * DAY_WIDTH);
  }, [days, nameWidth]);

  const rowProps = { days, backgrounds, nameWidth, renderName, renderCell, totals };

  return (
    <div
      ref={parentRef}
      className={cn(
        "relative overflow-auto rounded-md border print:overflow-visible print:border-0",
        virtualize ? "h-[calc(100dvh-17rem)] min-h-[20rem]" : "max-h-[calc(100dvh-17rem)] print:max-h-none",
      )}
      role="grid"
      aria-label={label}
      aria-rowcount={rows.length + 1}
    >
      <div style={{ width, height: virtualize ? virtualizer.getTotalSize() + HEADER_HEIGHT : undefined }} className="relative">
        <div className="sticky top-0 z-20 flex bg-background" style={{ width, height: HEADER_HEIGHT }} role="row">
          <div className="sticky left-0 z-30 flex items-end border-r border-b bg-background px-2 pb-1 text-xs font-medium text-muted-foreground" style={{ width: nameWidth }}>
            {nameHeader}
          </div>
          {days.map((day, i) => (
            <div
              key={day.date}
              title={day.holiday ?? undefined}
              className={cn("flex flex-col items-center justify-center border-r border-b text-xs", backgrounds[i], day.holiday && "text-red-600")}
              style={{ width: DAY_WIDTH }}
            >
              <span className="font-semibold">{Number(day.date.slice(8))}</span>
              <span className="text-[0.65rem] text-muted-foreground">{WEEKDAY_SHORT[day.weekday]}</span>
            </div>
          ))}
          {totals.map((t) => (
            <div key={t.key} className="flex items-center justify-center border-r border-b text-xs font-medium text-muted-foreground" style={{ width: TOTAL_WIDTH }}>
              {t.label}
            </div>
          ))}
        </div>
        {virtualize
          ? virtualizer.getVirtualItems().map((item) => (
              <div key={rowKey(rows[item.index])} role="row" className="absolute left-0 flex" style={{ top: HEADER_HEIGHT + item.start, height: ROW_HEIGHT, width }}>
                <MemoRow row={rows[item.index]} {...rowProps} />
              </div>
            ))
          : rows.map((row) => (
              <div key={rowKey(row)} role="row" className="flex break-inside-avoid" style={{ height: ROW_HEIGHT, width }}>
                <MemoRow row={row} {...rowProps} />
              </div>
            ))}
        {footer && !virtualize && (
          <div role="row" className="sticky bottom-0 z-20 flex bg-muted text-sm font-medium" style={{ height: ROW_HEIGHT, width }}>
            <div className="sticky left-0 z-30 flex items-center border-r border-b bg-muted px-2" style={{ width: nameWidth }}>
              {footer.label}
            </div>
            {days.map((day, i) => (
              <div key={day.date} className={cn("flex items-center justify-center border-r border-b tabular-nums", backgrounds[i])} style={{ width: DAY_WIDTH }}>
                {footer.day(day)}
              </div>
            ))}
            {totals.map((t) => (
              <div key={t.key} className="flex items-center justify-center border-r border-b tabular-nums" style={{ width: TOTAL_WIDTH }}>
                {t.footer}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

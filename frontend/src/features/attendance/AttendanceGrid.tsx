import { memo, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { type GridTotal, MonthGrid } from "@/components/common/MonthGrid";
import { cn } from "@/lib/utils";
import type { DayInfo, MonthSheet, SheetCell, StaffRow } from "@/api";
import { codeTone, formatDays } from "./codes";

const TOTALS: GridTotal<StaffRow>[] = (
  [
    { key: "totalWork", label: "Công" },
    { key: "paidLeave", label: "Phép" },
    { key: "unpaidLeave", label: "K.lương" },
    { key: "lateCount", label: "Muộn" },
  ] as const
).map((t) => ({ ...t, value: (row: StaffRow) => formatDays(Number(row.totals[t.key])) }));

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

/** Bảng công nhân viên × ngày. Ngày ngoài thời gian thuộc cơ sở (điều chuyển giữa tháng) gạch chéo. */
export function AttendanceGrid({ sheet, onOpen }: { sheet: MonthSheet; onOpen: (staffId: string, date: string) => void }) {
  const renderName = useCallback(
    (row: StaffRow, compact: boolean) => (
      <>
        <span className="truncate text-sm font-medium">{row.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {row.staffCode}
          {row.machineCode && !compact ? ` · máy ${row.machineCode}` : ""}
        </span>
      </>
    ),
    [],
  );
  const renderCell = useCallback(
    (row: StaffRow, day: DayInfo, background: string) => (
      <GridCell
        staffId={row.staffId}
        staffName={row.fullName}
        date={day.date}
        cell={row.cells[day.date]}
        background={background}
        inRange={day.date >= row.activeFrom && day.date <= row.activeTo}
        onOpen={onOpen}
      />
    ),
    [onOpen],
  );

  return (
    <MonthGrid
      label="Bảng công tháng"
      nameHeader="Nhân viên"
      rows={sheet.staff}
      rowKey={(r) => r.staffId}
      renderName={renderName}
      days={sheet.days}
      dayBackground={dayBackground}
      renderCell={renderCell}
      totals={TOTALS}
    />
  );
}

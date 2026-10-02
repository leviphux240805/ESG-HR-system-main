import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportButton } from "@/components/common/ExportButton";
import { type GridTotal, MonthGrid } from "@/components/common/MonthGrid";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  ATTENDANCE_CODES,
  ATTENDANCE_LABELS,
  type ChildAttendanceStatus,
  errorMessage,
  exportRollBook,
  type RollBookDay,
  type RollBookRow,
  saveRollCall,
  useClasses,
  useRollBook,
} from "@/api";
import { currentMonth, isMonth, monthLabel, shiftMonth } from "@/features/attendance/codes";

const TONE: Record<ChildAttendanceStatus, string> = {
  PRESENT: "text-green-700",
  EXCUSED: "text-amber-600",
  ABSENT: "text-red-600 font-semibold",
};

const STATUSES = Object.keys(ATTENDANCE_CODES) as ChildAttendanceStatus[];

const dayBackground = (day: RollBookDay) => (day.schoolDay ? "" : "bg-muted");

type Target = { row: RollBookRow; day: RollBookDay };

const Cell = memo(function Cell({ row, day, background, onOpen }: { row: RollBookRow; day: RollBookDay; background: string; onOpen: (t: Target) => void }) {
  if (day.date < row.activeFrom || day.date > row.activeTo) {
    return <div className="h-full border-r border-b bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,hsl(var(--muted))_4px,hsl(var(--muted))_6px)]" />;
  }
  const status = row.cells[day.date];
  const code = status ? ATTENDANCE_CODES[status] : "";
  const label = `${row.fullName} ngày ${formatDate(day.date)}: ${status ? ATTENDANCE_LABELS[status] : "chưa điểm danh"}`;
  const className = cn("flex h-full w-full items-center justify-center border-r border-b text-xs font-medium", background, status && TONE[status]);
  if (!day.editable) {
    return (
      <div className={className} title={row.notes[day.date] ?? label} aria-label={label}>
        {code}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen({ row, day })}
      aria-label={label}
      title={row.notes[day.date] ?? undefined}
      className={cn(className, "hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}
    >
      {code}
    </button>
  );
});

function CellDialog({ target, classId, onClose }: { target: Target | null; classId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ChildAttendanceStatus | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setStatus(target.row.cells[target.day.date] ?? null);
    setNote(target.row.notes[target.day.date] ?? "");
  }, [target]);

  const save = async () => {
    if (!target || !status) return;
    setBusy(true);
    try {
      await saveRollCall(classId, { date: target.day.date, rows: [{ childId: target.row.childId, status, note: status === "PRESENT" ? undefined : note.trim() || undefined }] });
      await queryClient.invalidateQueries({ queryKey: ["roll-call"] });
      toast.success("Đã lưu điểm danh.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{target?.row.fullName}</DialogTitle>
          <DialogDescription>Ngày {target && formatDate(target.day.date)}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Trạng thái">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setStatus(s)}
              className={cn("min-h-11 rounded-lg border text-sm font-medium", status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {ATTENDANCE_CODES[s]} · {ATTENDANCE_LABELS[s]}
            </button>
          ))}
        </div>
        {status && status !== "PRESENT" && (
          <Input className="min-h-11" placeholder="Ghi chú (lý do vắng)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Ghi chú" />
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button className="min-h-11" onClick={save} disabled={!status || busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sổ điểm danh tháng của lớp: trẻ × ngày (C, P, K), tổng theo trẻ và theo ngày; xuất Excel, in A4 ngang. */
export default function RollBookPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const classes = useClasses();
  const classId = searchParams.get("classId") ?? classes.data?.[0]?.id;
  const monthParam = searchParams.get("month");
  const month = isMonth(monthParam) ? monthParam : currentMonth();
  const query = useRollBook(classId, month);
  const [target, setTarget] = useState<Target | null>(null);
  const book = query.data;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const totals = useMemo<GridTotal<RollBookRow>[]>(() => {
    const sum = (f: (r: RollBookRow) => number) => (book?.rows ?? []).reduce((s, r) => s + f(r), 0);
    return [
      { key: "present", label: "Có mặt", value: (r) => r.present, footer: sum((r) => r.present) },
      { key: "excused", label: "P", value: (r) => r.excused, footer: sum((r) => r.excused) },
      { key: "absent", label: "K", value: (r) => r.absent, footer: sum((r) => r.absent) },
      { key: "rate", label: "CC %", value: (r) => r.rate.toLocaleString("vi-VN") },
    ];
  }, [book]);
  const renderName = useCallback(
    (row: RollBookRow) => (
      <>
        <span className="truncate text-sm font-medium">{row.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">{row.code}</span>
      </>
    ),
    [],
  );
  const renderCell = useCallback((row: RollBookRow, day: RollBookDay, background: string) => <Cell row={row} day={day} background={background} onOpen={setTarget} />, []);
  const footer = useMemo(() => ({ label: "Có mặt theo ngày", day: (d: RollBookDay) => (d.schoolDay ? d.present : "") }), []);
  const className = classes.data?.find((c) => c.id === classId)?.name ?? "";

  return (
    <div className="print-landscape">
      <PageHeader
        title="Sổ điểm danh"
        description={book ? `Lớp ${book.className} · ${monthLabel(month)}` : "Điểm danh tháng theo lớp: C có mặt, P vắng có phép, K vắng không phép."}
        actions={
          classId && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <ExportButton request={() => exportRollBook(classId, month)} fileName={`so-diem-danh-${className}-${month}.xlsx`} />
              <Button variant="outline" className="min-h-11" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> In
              </Button>
            </div>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Select value={classId ?? ""} onValueChange={(v) => setParam("classId", v)}>
          <SelectTrigger className="min-h-11 w-56" aria-label="Chọn lớp">
            <SelectValue placeholder="Chọn lớp" />
          </SelectTrigger>
          <SelectContent>
            {(classes.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setParam("month", shiftMonth(month, -1))} aria-label="Tháng trước">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="min-w-[8.5rem] text-center font-medium">{monthLabel(month)}</span>
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setParam("month", shiftMonth(month, 1))} aria-label="Tháng sau">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Ô xám: cuối tuần, ngày lễ. Ngày đã chốt chỉ xem.</p>
      </div>

      {classes.isLoading || query.isLoading ? (
        <TableSkeleton rows={8} columns={10} />
      ) : classes.isError || query.isError ? (
        <ErrorState error={classes.error ?? query.error} onRetry={() => (classes.isError ? classes.refetch() : query.refetch())} />
      ) : !book ? (
        <EmptyState icon={BookOpenCheck} title="Chưa có lớp" description="Bạn chưa được phân công lớp nào." />
      ) : book.rows.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="Lớp chưa có trẻ trong tháng này" />
      ) : (
        <MonthGrid
          label={`Sổ điểm danh lớp ${book.className}`}
          nameHeader="Trẻ"
          rows={book.rows}
          rowKey={(r) => r.childId}
          renderName={renderName}
          days={book.days}
          dayBackground={dayBackground}
          renderCell={renderCell}
          totals={totals}
          footer={footer}
          virtualize={false}
        />
      )}
      {classId && <CellDialog target={target} classId={classId} onClose={() => setTarget(null)} />}
    </div>
  );
}

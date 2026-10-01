import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, Lock, UserX } from "lucide-react";
import { ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { cn } from "@/lib/utils";
import { useMySheet } from "@/api";
import { codeTone, currentMonth, formatDays, isMonth, monthLabel, shiftMonth } from "@/features/attendance/codes";
import { useMyLeaveBalance } from "@/api";
import { MonthCalendar } from "@/features/attendance/MonthCalendar";
import { AttendanceLegend } from "@/features/attendance/AttendanceLegend";

/** Bảng công tháng của chính mình và phép năm còn lại (dùng tốt trên điện thoại). */
export default function MyAttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = isMonth(monthParam) ? monthParam : currentMonth();
  const sheet = useMySheet(month);
  const balance = useMyLeaveBalance(Number(month.slice(0, 4)));
  const setMonth = (value: string) => setSearchParams({ month: value }, { replace: true });

  const notLinked = sheet.error instanceof ApiError && sheet.error.status === 404;
  const data = sheet.data;
  const stats = data
    ? [
        { label: "Công", value: formatDays(data.totals.totalWork) },
        { label: "Phép", value: formatDays(data.totals.paidLeave) },
        { label: "Không lương", value: formatDays(data.totals.unpaidLeave) },
        { label: "Đi muộn", value: String(data.totals.lateCount) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chấm công của tôi"
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/nghi-phep">Xin nghỉ</Link>
          </Button>
        }
      />
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="min-w-[8.5rem] text-center font-medium" data-testid="month-label">
          {monthLabel(month)}
        </span>
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau">
          <ChevronRight className="w-4 h-4" />
        </Button>
        {data?.locked && (
          <span className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> Đã chốt công
          </span>
        )}
      </div>

      {notLinked ? (
        <EmptyState icon={UserX} title="Tài khoản chưa gắn hồ sơ nhân viên" description="Liên hệ hiệu trưởng để gắn hồ sơ." />
      ) : sheet.isLoading ? (
        <PageSkeleton />
      ) : sheet.isError ? (
        <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
            {balance.data && (
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Phép năm còn lại</p>
                  <p className="text-xl font-bold">
                    {formatDays(balance.data.remaining)} <span className="text-sm font-normal">/ {formatDays(balance.data.annualDays)}</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <MonthCalendar
            month={month}
            label="Bảng công của tôi"
            days={data.days.map((d) => ({ date: d.date, off: !d.working, holiday: d.holiday }))}
            renderDay={(date) => {
              const cell = data.cells[date];
              if (!cell) return null;
              return (
                <div className="flex items-center gap-1">
                  <span className={cn("text-base font-semibold", codeTone(cell.code))}>{cell.code ?? ""}</span>
                  {cell.discrepancy && <AlertTriangle className="w-3 h-3 text-amber-500" aria-label="Sai lệch" />}
                  {cell.countedLate && <span className="h-1.5 w-1.5 rounded-full bg-red-500" role="img" aria-label="Tính đi muộn" />}
                </div>
              );
            }}
          />
          <AttendanceLegend />
        </>
      ) : null}
    </div>
  );
}

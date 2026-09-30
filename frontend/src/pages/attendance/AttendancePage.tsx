import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight, FileUp, Lock, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { ExportButton } from "@/components/common/ExportButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDateTime } from "@/lib/format";
import { useMonthSheet } from "@/features/attendance/api";
import { AttendanceGrid } from "@/features/attendance/AttendanceGrid";
import { AttendanceLegend } from "@/features/attendance/AttendanceLegend";
import { CellSheet } from "@/features/attendance/CellSheet";
import { DiscrepancyDialog } from "@/features/attendance/DiscrepancyDialog";
import { ImportDialog } from "@/features/attendance/ImportDialog";
import { MonthLockControls } from "@/features/attendance/MonthLockControls";
import { currentMonth, isMonth, monthLabel, shiftMonth } from "@/features/attendance/codes";

/** Bảng công tháng của cơ sở đang chọn (chuyển từ trang Attendance của ESG HR). */
export default function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = isMonth(monthParam) ? monthParam : currentMonth();
  const { isAllSchools, canChooseAll } = useCurrentSchool();
  const needSchool = canChooseAll && isAllSchools;
  const sheet = useMonthSheet(month, !needSchool);
  const [target, setTarget] = useState<{ staffId: string; date: string } | null>(null);
  const [dialog, setDialog] = useState<"import" | "review" | null>(null);
  const open = useCallback((staffId: string, date: string) => setTarget({ staffId, date }), []);

  const setMonth = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("month", value);
    setSearchParams(next, { replace: true });
  };

  const data = sheet.data;
  const locked = !!data?.lock;

  return (
    <div>
      <PageHeader
        title="Chấm công"
        description="Bảng công tháng theo cơ sở: bấm ô để sửa mã, ô viền vàng là sai lệch với máy chấm công."
        actions={
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Chọn tháng">
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[8.5rem] text-center font-medium" data-testid="month-label">
                {monthLabel(month)}
              </span>
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/cham-cong/cau-hinh">
                <Settings2 className="w-4 h-4 mr-2" /> Cấu hình
              </Link>
            </Button>
          </>
        }
      />

      {needSchool ? (
        <EmptyState icon={CalendarCheck} title="Chọn một cơ sở" description="Bảng công xem theo từng cơ sở: chọn cơ sở ở đầu trang." />
      ) : sheet.isLoading ? (
        <TableSkeleton rows={8} columns={10} />
      ) : sheet.isError ? (
        sheet.error instanceof ApiError && sheet.error.problem?.code === "ATTENDANCE_CONFIG_MISSING" ? (
          <EmptyState
            icon={Settings2}
            title="Chưa có cấu hình chấm công"
            description="Cần cấu hình giờ ca, ân hạn và ngày làm việc trước khi dùng bảng công."
            action={
              <Button asChild className="min-h-11">
                <Link to="/cham-cong/cau-hinh">Mở cấu hình</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />
        )
      ) : data ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {locked ? (
              <StatusBadge status="LOCKED" labels={{ LOCKED: { label: "Đã khóa công", tone: "neutral" } }} />
            ) : (
              <StatusBadge status="OPEN" labels={{ OPEN: { label: "Đang chấm", tone: "info" } }} />
            )}
            {data.lock && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="w-3.5 h-3.5" /> {formatDateTime(data.lock.lockedAt)}
                {data.lock.lockedByName ? ` · ${data.lock.lockedByName}` : ""}
              </span>
            )}
            {data.discrepancyCount > 0 && (
              <span className="flex items-center gap-1 text-amber-700" data-testid="discrepancy-count">
                <AlertTriangle className="w-4 h-4" /> {data.discrepancyCount} ngày sai lệch
              </span>
            )}
            <span className="text-muted-foreground">{data.staff.length} nhân viên</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {data.canManage && !locked && (
                <Button className="min-h-11" onClick={() => setDialog("import")}>
                  <FileUp className="w-4 h-4 mr-2" /> Import máy chấm công
                </Button>
              )}
              {data.discrepancyCount > 0 && data.canManage && !locked && (
                <Button variant="outline" className="min-h-11" onClick={() => setDialog("review")}>
                  <AlertTriangle className="w-4 h-4 mr-2" /> Xử lý sai lệch
                </Button>
              )}
              <ExportButton
                fileName={`bang-cong-${month}.xlsx`}
                request={() => api.GET("/api/v1/attendance/months/{month}/export", { params: { path: { month } }, parseAs: "blob" })}
              />
              <MonthLockControls sheet={data} />
            </div>
          </div>
          {data.staff.length === 0 ? (
            <EmptyState title="Chưa có nhân viên trong tháng" description="Nhân viên thuộc cơ sở trong tháng sẽ hiện ở đây." />
          ) : (
            <AttendanceGrid sheet={data} onOpen={open} />
          )}
          <AttendanceLegend />
        </div>
      ) : null}

      <CellSheet target={target} editable={!!data?.canManage && !locked} onClose={() => setTarget(null)} />
      {data && (
        <ImportDialog
          open={dialog === "import"}
          onOpenChange={(o) => setDialog(o ? "import" : null)}
          month={month}
          sheet={data}
          onReview={() => setDialog("review")}
        />
      )}
      <DiscrepancyDialog open={dialog === "review"} onOpenChange={(o) => setDialog(o ? "review" : null)} month={month} />
    </div>
  );
}

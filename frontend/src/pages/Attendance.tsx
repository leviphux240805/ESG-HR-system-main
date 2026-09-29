import { useState, useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Check,
  AlertTriangle,
} from "lucide-react";

import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AttendanceLabel,
  labelColors,
  vietnameseMonths,
  vietnameseDays,
  currentYear,
  yearOptions,
} from "@/data/attendanceTypes";
import { AttendanceUploadModal } from "@/components/attendance/AttendanceUploadModal";
import { AttendanceConfigModal } from "@/components/attendance/AttendanceConfigModal";
import { AttendanceCellEditModal } from "@/components/attendance/AttendanceCellEditModal";
import {
  useAttendanceData,
  ManualAttendanceRecord,
  MonthlySummary,
} from "@/hooks/useAttendanceData";
import { toast } from "sonner";
import { Save, Upload } from "lucide-react";

// Helper to get day name (T2, T3, ..., CN)
function getDayName(date: Date): string {
  return vietnameseDays[date.getDay()];
}

export default function Attendance() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Cell edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editRecord, setEditRecord] = useState<ManualAttendanceRecord | null>(
    null,
  );

  // Fetch data
  const {
    employees: unsortedEmployees,
    attendanceRecords,
    holidays,
    isLoading,
    refetch,
    saveAttendance,
    saveMonthlySummaries,
    reconciliationMap,
    lateCountMap,
    updateLocalDiscrepancy,
  } = useAttendanceData(selectedYear, selectedMonth);

  // Sort employees by employeeID ascending
  const employees = useMemo(() => {
    return [...unsortedEmployees].sort((a, b) => {
      const codeA = a.employeeID || "";
      const codeB = b.employeeID || "";
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
  }, [unsortedEmployees]);

  // Build holiday map for quick lookup
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach((h) => {
      map.set(h.holiday_date, h.name);
    });
    return map;
  }, [holidays]);

  // Generate days for the selected month
  const daysInMonth = useMemo(() => {
    const count = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(selectedYear, selectedMonth, i + 1);
      return {
        day: i + 1,
        date,
        dayName: getDayName(date),
        isSunday: date.getDay() === 0,
        isSaturday: date.getDay() === 6,
        dateStr: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
      };
    });
  }, [selectedYear, selectedMonth]);

  // Get record for employee + date
  const getRecord = (
    employeeId: string,
    dateStr: string,
  ): ManualAttendanceRecord | null => {
    const key = `${employeeId}-${dateStr}`;
    return attendanceRecords.get(key) || null;
  };

  // Calculate summaries for each employee
  const getEmployeeSummary = (employeeId: string) => {
    let totalWork = 0;
    let unpaidLeave = 0;
    let holidaysCount = 0;
    let paidLeave = 0;

    daysInMonth.forEach(({ dateStr, isSunday }) => {
      if (isSunday) return;

      const record = getRecord(employeeId, dateStr);
      const status = record?.status_code as AttendanceLabel;
      const isHoliday = holidayMap.has(dateStr);

      if (status === "X") totalWork++;
      else if (status === "NN" || status === "1/2P" || status === "1/2K")
        totalWork += 0.5;
      else if (status === "K") unpaidLeave++;
      else if (status === "NL" || isHoliday) {
        holidaysCount++;
        totalWork++; // Holidays count as work days
      } else if (status === "P") paidLeave++;
    });

    return { totalWork, unpaidLeave, holidays: holidaysCount, paidLeave };
  };

  // Handle cell click
  const handleCellClick = (
    employee: { id: string; name: string },
    date: Date,
    dateStr: string,
  ) => {
    const record = getRecord(employee.id, dateStr);
    setEditEmployee(employee);
    setEditDate(date);
    setEditRecord(record);
    setIsEditOpen(true);
  };

  // Handle save from modal
  const handleSave = async (data: {
    status: AttendanceLabel;
    leaveTime?: string;
    returnTime?: string;
    note?: string;
  }): Promise<boolean> => {
    if (!editEmployee || !editDate) return false;

    const success = await saveAttendance(
      editEmployee.id,
      editDate,
      data.status,
      {
        note: data.note,
        leaveTime: data.leaveTime,
        returnTime: data.returnTime,
      },
    );

    if (success) {
      // Clear discrepancy flag since user has now resolved it
      // Fix timezone issue: construct YYYY-MM-DD from local date
      const dateStr = `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, "0")}-${String(editDate.getDate()).padStart(2, "0")}`;

      const { supabase } = await import("@/lib/supabase");
      await supabase
        .from("daily_attendance_summary")
        .update({
          is_discrepancy: false,
          manual_status: data.status,
          final_status: data.status,
        })
        .eq("employee_id", editEmployee.id)
        .eq("work_date", dateStr);

      toast.success("Đã lưu chấm công");

      // Update local state directly instead of refetching to avoid full re-render
      updateLocalDiscrepancy(editEmployee.id, dateStr, false);
    }
    return success;
  };

  // Handle save monthly summary
  const handleSaveSummary = async () => {
    if (employees.length === 0) return;

    // Create first day of month string YYYY-MM-01
    const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;

    const summaries: MonthlySummary[] = employees.map((emp) => {
      const stats = getEmployeeSummary(emp.id);
      return {
        employee_id: emp.id,
        month_date: monthStr,
        total_work: stats.totalWork,
        unpaid_leave: stats.unpaidLeave,
        holiday_leave: stats.holidays,
        paid_leave: stats.paidLeave,
      };
    });

    await saveMonthlySummaries(summaries);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              Bảng Chấm Công
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {vietnameseMonths[selectedMonth]} năm {selectedYear}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 ml-2"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="w-3 h-3 mr-1" />
                Upload máy chấm công
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[100px]">
                    {vietnameseMonths[selectedMonth]}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover max-h-[200px] overflow-y-auto hide-scrollbar">
                  {vietnameseMonths.map((month, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => setSelectedMonth(idx)}
                      className={cn(selectedMonth === idx && "bg-muted")}
                    >
                      {month}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNextMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Year Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {selectedYear}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover">
                {yearOptions.map((year) => (
                  <DropdownMenuItem
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={cn(selectedYear === year && "bg-muted")}
                  >
                    {year}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsConfigOpen(true)}
              title="Cấu hình"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* Save Summary */}
            <Button
              variant="default"
              size="sm"
              className="ml-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveSummary}
              disabled={isLoading || employees.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              Chốt công
            </Button>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-card rounded-lg card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
                <p className="text-muted-foreground">Đang tải...</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  {/* Header Row 1: Day numbers */}
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 z-10 px-2 py-2 text-left font-medium text-xs text-muted-foreground w-8">
                      TT
                    </th>
                    <th className="sticky left-8 bg-muted/50 z-10 px-2 py-2 text-left font-medium text-xs text-muted-foreground w-[140px]">
                      Họ và tên
                    </th>
                    {daysInMonth.map(({ day, isSunday, isSaturday }) => (
                      <th
                        key={day}
                        className={cn(
                          "px-0 py-2 text-center font-medium text-xs w-7",
                          isSunday && "bg-red-50 text-red-600",
                          isSaturday && !isSunday && "bg-cyan-50 text-cyan-700",
                        )}
                      >
                        {day}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-medium text-xs bg-green-50 text-green-700 w-10">
                      Tổng
                    </th>
                    <th className="px-1 py-2 text-center font-medium text-xs w-8">
                      K
                    </th>
                    <th className="px-1 py-2 text-center font-medium text-xs w-8 text-amber-600">
                      Muộn
                    </th>
                    <th className="px-1 py-2 text-center font-medium text-xs w-8">
                      P
                    </th>
                  </tr>
                  {/* Header Row 2: Day names */}
                  <tr className="border-b bg-muted/30">
                    <th className="sticky left-0 bg-muted/30 z-10 px-2 py-1"></th>
                    <th className="sticky left-8 bg-muted/30 z-10 px-2 py-1"></th>
                    {daysInMonth.map(
                      ({ day, dayName, isSunday, isSaturday }) => (
                        <th
                          key={day}
                          className={cn(
                            "px-0 py-1 text-center text-[10px] text-muted-foreground",
                            isSunday && "bg-red-50 text-red-500",
                            isSaturday &&
                              !isSunday &&
                              "bg-cyan-50 text-cyan-600",
                          )}
                        >
                          {dayName}
                        </th>
                      ),
                    )}
                    <th className="px-2 py-1 bg-green-50"></th>
                    <th className="px-1 py-1 text-[9px] text-muted-foreground">
                      K.lương
                    </th>
                    <th className="px-1 py-1 text-[9px] text-amber-600">
                      Ngày
                    </th>
                    <th className="px-1 py-1 text-[9px] text-muted-foreground">
                      Phép
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((employee, idx) => {
                    const summary = getEmployeeSummary(employee.id);
                    return (
                      <tr key={employee.id} className="hover:bg-muted/20">
                        <td className="sticky left-0 bg-background z-10 px-2 py-1 text-center text-xs">
                          {idx + 1}
                        </td>
                        <td className="sticky left-8 bg-background z-10 px-2 py-1 font-medium text-xs truncate max-w-[140px]">
                          {employee.name}
                        </td>
                        {daysInMonth.map(
                          ({ day, date, dateStr, isSunday, isSaturday }) => {
                            const record = getRecord(employee.id, dateStr);
                            // Validated status from reconciliation
                            const reconciliationRecord = reconciliationMap.get(
                              `${employee.id}-${dateStr}`,
                            );
                            const hasDiscrepancy =
                              reconciliationRecord?.is_discrepancy;

                            const status =
                              record?.status_code as AttendanceLabel;
                            const hasTimeData =
                              record?.leave_time || record?.return_time;
                            const holidayName = holidayMap.get(dateStr);
                            const colors = status
                              ? labelColors[status]
                              : labelColors[""];

                            // Determine display label
                            let displayLabel = status || "";
                            if (!status && isSunday) displayLabel = "CN";
                            else if (!status && holidayName)
                              displayLabel = "NL";

                            const cellContent = (
                              <button
                                onClick={() =>
                                  !isSunday &&
                                  handleCellClick(
                                    { id: employee.id, name: employee.name },
                                    date,
                                    dateStr,
                                  )
                                }
                                disabled={isSunday}
                                className={cn(
                                  "w-full h-full min-h-[32px] flex items-center justify-center text-[10px] font-semibold transition-colors relative",
                                  isSunday &&
                                    "bg-red-50 text-red-400 cursor-default",
                                  isSaturday &&
                                    !isSunday &&
                                    !hasTimeData &&
                                    "bg-cyan-50",
                                  hasTimeData && "bg-amber-100 text-amber-800",
                                  !isSunday &&
                                    !isSaturday &&
                                    !hasTimeData &&
                                    colors.bg,
                                  !isSunday && !hasTimeData && colors.text,
                                  !isSunday && "hover:bg-muted cursor-pointer",
                                  hasDiscrepancy &&
                                    "ring-2 ring-inset ring-amber-500 z-10",
                                )}
                              >
                                {displayLabel === "X" ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : displayLabel &&
                                  !["CN", "T7"].includes(displayLabel) ? (
                                  displayLabel
                                ) : (
                                  ""
                                )}
                                {hasDiscrepancy && (
                                  <div className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full" />
                                )}
                              </button>
                            );

                            return (
                              <td
                                key={day}
                                className="p-0 border-l border-border/50 relative"
                              >
                                {hasTimeData ||
                                record?.note ||
                                hasDiscrepancy ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      {cellContent}
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="text-xs max-w-[250px]"
                                    >
                                      {hasDiscrepancy &&
                                        reconciliationRecord && (
                                          <div className="mb-2 pb-2 border-b border-amber-300">
                                            <p className="font-bold text-amber-600 flex items-center gap-1">
                                              <AlertTriangle className="w-3 h-3" />
                                              Sai lệch
                                            </p>
                                            <p className="text-amber-700 mt-1">
                                              Máy:{" "}
                                              {reconciliationRecord.machine_check_in ||
                                                "Không có"}
                                              {reconciliationRecord.machine_check_out &&
                                                ` → ${reconciliationRecord.machine_check_out}`}
                                            </p>
                                            <p className="text-muted-foreground">
                                              HR:{" "}
                                              {reconciliationRecord.manual_status ||
                                                "Chưa chấm"}
                                            </p>
                                            {/* Calculate suggestion based on checkout time */}
                                            {(() => {
                                              const checkOut =
                                                reconciliationRecord.machine_check_out;
                                              if (
                                                checkOut &&
                                                checkOut.includes(":")
                                              ) {
                                                const [h, m] = checkOut
                                                  .split(":")
                                                  .map(Number);
                                                const minutes = h * 60 + m;
                                                // 12:00 - 15:30 range suggests half day
                                                if (
                                                  minutes >= 720 &&
                                                  minutes <= 930
                                                ) {
                                                  return (
                                                    <p className="text-green-600 font-medium mt-1">
                                                      💡 Gợi ý: 1/2K hoặc 1/2P
                                                    </p>
                                                  );
                                                }
                                              }
                                              if (
                                                !reconciliationRecord.machine_check_in
                                              ) {
                                                return (
                                                  <p className="text-green-600 font-medium mt-1">
                                                    💡 Gợi ý: K hoặc V
                                                  </p>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </div>
                                        )}
                                      {record?.leave_time && (
                                        <p>Ra: {record.leave_time}</p>
                                      )}
                                      {record?.return_time && (
                                        <p>Vào: {record.return_time}</p>
                                      )}
                                      {record?.note && (
                                        <p className="text-muted-foreground mt-1">
                                          {record.note}
                                        </p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  cellContent
                                )}
                              </td>
                            );
                          },
                        )}
                        <td className="px-2 py-1 text-center text-xs font-medium bg-green-50 text-green-700">
                          {summary.totalWork}
                        </td>
                        <td className="px-1 py-1 text-center text-xs">
                          {summary.unpaidLeave}
                        </td>
                        <td className="px-1 py-1 text-center text-xs text-amber-600 font-medium">
                          {lateCountMap.get(employee.id) || 0}
                        </td>
                        <td className="px-1 py-1 text-center text-xs">
                          {summary.paidLeave}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Cell Edit Modal */}
      <AttendanceCellEditModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        employeeName={editEmployee?.name || ""}
        date={editDate}
        record={editRecord}
        onSave={handleSave}
      />
      {/* Config Modal */}
      <AttendanceConfigModal
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        onHolidayChange={refetch}
      />

      <AttendanceUploadModal
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onUploadComplete={() => {
          refetch();
        }}
      />
    </AuthenticatedLayout>
  );
}

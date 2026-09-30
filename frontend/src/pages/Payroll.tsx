import { useState, useMemo, useEffect } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Send,
  Loader2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  vietnameseMonths,
  currentYear,
  yearOptions,
} from "@/data/attendanceTypes";
import { usePayrollData, PayrollRecord } from "@/hooks/usePayrollData";
import { EditableCell } from "@/components/legacy/EditableCell";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Format number as VND
function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

type SortField = "employeeID" | "total_salary";
type SortOrder = "asc" | "desc";

export default function Payroll() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<{ holiday_date: string }[]>([]);
  const [sortField, setSortField] = useState<SortField>("employeeID");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Fetch holidays on mount and when year changes
  useEffect(() => {
    supabase
      .from("holidays")
      .select("holiday_date")
      .gte("holiday_date", `${selectedYear}-01-01`)
      .lte("holiday_date", `${selectedYear}-12-31`)
      .then(({ data }) => {
        setHolidays(data || []);
      });
  }, [selectedYear]);

  // Calculate standard work days for the month
  const standardWorkDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let sundays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      if (date.getDay() === 0) sundays++;
    }

    const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const holidayCount = holidays.filter((h) => {
      if (!h.holiday_date.startsWith(monthStr)) return false;
      const hDate = new Date(h.holiday_date);
      return hDate.getDay() !== 0;
    }).length;

    return daysInMonth - sundays - holidayCount;
  }, [selectedYear, selectedMonth, holidays]);

  // Fetch payroll data
  const {
    payrollRecords,
    isLoading,
    isCalculating,
    updatePayrollField,
    finalizePayroll,
  } = usePayrollData(selectedYear, selectedMonth, standardWorkDays);

  // Sort records
  const sortedRecords = useMemo(() => {
    return [...payrollRecords].sort((a, b) => {
      let comparison = 0;
      if (sortField === "employeeID") {
        const aId = a.employee?.employeeID || "";
        const bId = b.employee?.employeeID || "";
        comparison = aId.localeCompare(bId);
      } else if (sortField === "total_salary") {
        comparison = a.total_salary - b.total_salary;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [payrollRecords, sortField, sortOrder]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  // Handle finalize
  const handleFinalize = async () => {
    await finalizePayroll();
  };

  // Handle Send Email
  const handleSendEmail = async () => {
    if (!payrollRecords.length) return;

    setIsSendingEmail(true);
    try {
      const payrollIds = payrollRecords.map((r) => r.id);

      const { data, error } = await supabase.functions.invoke(
        "Send-Salary-Emails",
        {
          body: { payrollIds },
        },
      );

      if (error) throw error;

      // Analyze results
      const results = data.results || [];
      const successCount = results.filter(
        (r: any) => r.status === "success",
      ).length;
      const skippedCount = results.filter(
        (r: any) => r.status === "skipped",
      ).length;
      const errorCount = results.filter(
        (r: any) => r.status === "error",
      ).length;

      if (errorCount > 0) {
        toast.warning(
          `Gửi hoàn tất: ${successCount} thành công, ${errorCount} lỗi, ${skippedCount} bỏ qua (thiếu email).`,
        );
      } else {
        toast.success(
          `Gửi thành công cho ${successCount} nhân viên. (${skippedCount} bỏ qua)`,
        );
      }
    } catch (error) {
      console.error("Failed to send emails:", error);
      toast.error("Gửi email thất bại. Vui lòng thử lại sau.");
    } finally {
      setIsSendingEmail(false);
    }
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

  // Check if any record is finalized
  const isFinalized = payrollRecords.some((r) => r.status === "final");

  // Calculate totals
  const totals = useMemo(() => {
    return payrollRecords.reduce(
      (acc, r) => ({
        totalSalary: acc.totalSalary + r.total_salary,
        totalBonus: acc.totalBonus + r.bonus,
        totalFines: acc.totalFines + r.fines,
      }),
      { totalSalary: 0, totalBonus: 0, totalFines: 0 },
    );
  }, [payrollRecords]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="w-6 h-6 text-primary" />
              Bảng Lương
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {vietnameseMonths[selectedMonth]} năm {selectedYear} • Ngày công
              chuẩn: {standardWorkDays}
            </p>
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
                <DropdownMenuContent className="bg-popover max-h-[200px] overflow-y-auto">
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

            {/* Send Email Button */}
            {payrollRecords.length > 0 && isFinalized && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSendingEmail}
                    className="gap-2"
                  >
                    {isSendingEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Gửi Email
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Gửi phiếu lương qua Email?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Hệ thống sẽ gửi email phiếu lương đến tất cả nhân viên có
                      trong danh sách. Vui lòng đảm bảo bảng lương đã chính xác.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSendEmail}>
                      Xác nhận gửi
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Finalize Button with Confirmation */}
            {payrollRecords.length > 0 && !isFinalized && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isLoading || isCalculating}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Lock className="w-4 h-4" />
                    Chốt lương
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Xác nhận chốt bảng lương?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Hành động này sẽ khóa bảng lương tháng {selectedMonth + 1}
                      /{selectedYear}. Sau khi chốt, bạn sẽ không thể chỉnh sửa
                      dữ liệu được nữa.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleFinalize}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Xác nhận chốt
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Payroll Table */}
        <div className="bg-card rounded-xl card-shadow overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {payrollRecords.length}
              </span>{" "}
              nhân viên
              <span className="mx-2">·</span>
              <span className="text-xs">
                Nhấp đúp vào các ô có thể chỉnh sửa • Nhấp vào tiêu đề cột để
                sắp xếp
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            {isLoading || isCalculating ? (
              <div className="p-12 text-center">
                <div className="flex justify-center mb-4">
                  {isCalculating ? (
                    <Calculator className="w-8 h-8 text-primary animate-pulse" />
                  ) : (
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                </div>
                <p className="text-muted-foreground">
                  {isCalculating ? "Đang tính lương..." : "Đang tải..."}
                </p>
              </div>
            ) : sortedRecords.length === 0 ? (
              <div className="p-12 text-center">
                <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Chưa có dữ liệu lương cho tháng này.
                </p>
                <p className="text-xs text-muted-foreground">
                  Hãy chắc chắn rằng đã có dữ liệu chấm công và đã "Chốt công"
                  trong trang Chấm công.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-3 text-left font-medium text-xs text-muted-foreground w-12">
                      TT
                    </th>
                    <th
                      className="px-3 py-3 text-left font-medium text-xs text-muted-foreground w-20 cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("employeeID")}
                    >
                      <div className="flex items-center">
                        Mã NV
                        {getSortIcon("employeeID")}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-xs text-muted-foreground min-w-[150px]">
                      Họ và tên
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-xs text-muted-foreground w-24">
                      Ngày công
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-xs text-muted-foreground w-32">
                      Lương cơ bản
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-xs text-muted-foreground w-28">
                      Phụ cấp
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-xs text-muted-foreground w-28">
                      Thưởng
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-xs text-muted-foreground w-28">
                      Phạt
                    </th>
                    <th
                      className="px-3 py-3 text-right font-medium text-xs text-muted-foreground w-36 cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("total_salary")}
                    >
                      <div className="flex items-center justify-end">
                        Tổng lương
                        {getSortIcon("total_salary")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRecords.map((record, idx) => {
                    return (
                      <tr key={record.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 text-center text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium">
                          {record.employee?.employeeID || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium">
                          {record.employee?.name || "-"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          <span className="font-medium">
                            {record.total_work_days}
                          </span>
                          <span className="text-muted-foreground">
                            /{record.standard_work_days}
                          </span>
                        </td>
                        {/* Base Salary - Editable */}
                        <td className="px-3 py-2 text-right text-xs">
                          {isFinalized ? (
                            formatVND(record.base_salary)
                          ) : (
                            <EditableCell
                              value={record.base_salary}
                              onSave={(value) =>
                                updatePayrollField(
                                  record.id,
                                  record.employee_id,
                                  "base_salary",
                                  parseFloat(value) || 0,
                                )
                              }
                              type="number"
                              formatter={(val) => formatVND(Number(val))}
                              className="text-xs justify-end"
                            />
                          )}
                        </td>
                        {/* Allowances - Non-editable cell */}
                        <td className="px-3 py-2 text-right text-xs">
                          {formatVND(record.allowances)}
                        </td>
                        {/* Bonus - Editable */}
                        <td className="px-3 py-2 text-right text-xs">
                          {isFinalized ? (
                            <span
                              className={
                                record.bonus > 0
                                  ? "text-green-600 font-medium"
                                  : ""
                              }
                            >
                              {formatVND(record.bonus)}
                            </span>
                          ) : (
                            <EditableCell
                              value={record.bonus}
                              onSave={(value) =>
                                updatePayrollField(
                                  record.id,
                                  record.employee_id,
                                  "bonus",
                                  parseFloat(value) || 0,
                                )
                              }
                              type="number"
                              formatter={(val) => formatVND(Number(val))}
                              className={cn(
                                "text-xs justify-end",
                                Number(record.bonus) > 0 &&
                                  "text-green-600 font-medium",
                              )}
                            />
                          )}
                        </td>
                        {/* Fines - Editable */}
                        <td className="px-3 py-2 text-right text-xs">
                          {isFinalized ? (
                            <span
                              className={
                                record.fines > 0
                                  ? "text-red-600 font-medium"
                                  : ""
                              }
                            >
                              {formatVND(record.fines)}
                            </span>
                          ) : (
                            <EditableCell
                              value={record.fines}
                              onSave={(value) =>
                                updatePayrollField(
                                  record.id,
                                  record.employee_id,
                                  "fines",
                                  parseFloat(value) || 0,
                                )
                              }
                              type="number"
                              formatter={(val) => formatVND(Number(val))}
                              className={cn(
                                "text-xs justify-end",
                                Number(record.fines) > 0 &&
                                  "text-red-600 font-medium",
                              )}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-primary">
                          {formatVND(record.total_salary)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-medium">
                    <td colSpan={6} className="px-3 py-3 text-right text-xs">
                      Tổng cộng:
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-green-600">
                      {formatVND(totals.totalBonus)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-red-600">
                      {formatVND(totals.totalFines)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-primary">
                      {formatVND(totals.totalSalary)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Status indicator */}
        {isFinalized && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
            <Lock className="w-4 h-4" />
            Bảng lương tháng này đã được chốt và không thể chỉnh sửa.
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

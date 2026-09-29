import { useState, useMemo, useEffect } from "react";
import {
  Mail,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  CircleDollarSign,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { usePayrollData, PayrollRecord } from "@/hooks/usePayrollData";
import {
  vietnameseMonths,
  currentYear,
  yearOptions,
} from "@/data/attendanceTypes";
import { supabase } from "@/lib/supabase";

// Format number as VND
function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Payslips() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPayslips, setSelectedPayslips] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<{ holiday_date: string }[]>([]);
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
  const { payrollRecords, isLoading, markAsPaid, refetch } = usePayrollData(
    selectedYear,
    selectedMonth,
    standardWorkDays,
  );

  // Filter only finalized records for payslips page
  const finalizedRecords = useMemo(() => {
    return payrollRecords.filter((r) => r.status === "final");
  }, [payrollRecords]);

  const toggleSelection = (id: string) => {
    setSelectedPayslips((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedPayslips.length === finalizedRecords.length) {
      setSelectedPayslips([]);
    } else {
      setSelectedPayslips(finalizedRecords.map((p) => p.id));
    }
  };

  const handleMarkAsPaid = async () => {
    if (selectedPayslips.length === 0) return;
    await markAsPaid(selectedPayslips);
    setSelectedPayslips([]);
  };

  const handleSendEmails = async () => {
    if (!selectedPayslips.length) return;

    setIsSendingEmail(true);
    try {
      const response = await fetch("/api/send-salary-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollIds: selectedPayslips }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send emails");
      }

      const results = data.results || [];
      const successCount = results.filter(
        (r: { status: string }) => r.status === "success",
      ).length;
      const skippedCount = results.filter(
        (r: { status: string }) => r.status === "skipped",
      ).length;
      const errorCount = results.filter(
        (r: { status: string }) => r.status === "error",
      ).length;

      if (errorCount > 0) {
        toast.warning(
          `Gửi hoàn tất: ${successCount} thành công, ${errorCount} lỗi, ${skippedCount} bỏ qua.`,
        );
      } else {
        toast.success(
          `Gửi thành công cho ${successCount} nhân viên. (${skippedCount} bỏ qua)`,
        );
      }

      // Update UI
      await refetch();
      setSelectedPayslips([]);
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

  // Calculate totals
  const totals = useMemo(() => {
    return finalizedRecords.reduce(
      (acc, r) => ({
        totalSalary: acc.totalSalary + r.total_salary,
        paidCount: acc.paidCount + (r.is_paid ? 1 : 0),
        unpaidCount: acc.unpaidCount + (r.is_paid ? 0 : 1),
      }),
      { totalSalary: 0, paidCount: 0, unpaidCount: 0 },
    );
  }, [finalizedRecords]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CircleDollarSign className="w-6 h-6 text-primary" />
              Trung Tâm Phiếu Lương
            </h1>
            <p className="text-muted-foreground mt-1">
              {vietnameseMonths[selectedMonth]} năm {selectedYear}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
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

            {/* Mark as Paid Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={selectedPayslips.length === 0}
                >
                  <Check className="w-4 h-4" />
                  Đánh dấu đã TT ({selectedPayslips.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Đánh dấu đã thanh toán?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn sẽ đánh dấu {selectedPayslips.length} phiếu lương là đã
                    thanh toán. Hành động này có thể hoàn tác sau.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={handleMarkAsPaid}>
                    Xác nhận
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Send Email Button */}
            <Button
              className="gap-2"
              disabled={selectedPayslips.length === 0 || isSendingEmail}
              onClick={handleSendEmails}
            >
              {isSendingEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Gửi Email ({selectedPayslips.length})
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl card-shadow p-4">
            <p className="text-sm text-muted-foreground">Tổng lương</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {formatVND(totals.totalSalary)}
            </p>
          </div>
          <div className="bg-card rounded-xl card-shadow p-4">
            <p className="text-sm text-muted-foreground">Đã thanh toán</p>
            <p className="text-xl font-bold text-green-600 mt-1">
              {totals.paidCount}
            </p>
          </div>
          <div className="bg-card rounded-xl card-shadow p-4">
            <p className="text-sm text-muted-foreground">Chưa thanh toán</p>
            <p className="text-xl font-bold text-amber-600 mt-1">
              {totals.unpaidCount}
            </p>
          </div>
        </div>

        {/* Payslips Table */}
        <div className="bg-card rounded-xl card-shadow overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground mt-4">Đang tải...</p>
            </div>
          ) : finalizedRecords.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Chưa có phiếu lương nào được chốt cho tháng này.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Vui lòng chốt lương trong trang "Bảng Lương" trước.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={
                        selectedPayslips.length === finalizedRecords.length &&
                        finalizedRecords.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-ring"
                    />
                  </TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Mã NV</TableHead>
                  <TableHead>Trạng thái thanh toán</TableHead>
                  <TableHead>Trạng thái Email</TableHead>
                  <TableHead className="text-right">Tổng lương</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalizedRecords.map((record) => {
                  const isSelected = selectedPayslips.includes(record.id);
                  const hasEmail = !!record.employee?.email;
                  const isSent = !!record.email_sent_at;

                  return (
                    <TableRow
                      key={record.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        isSelected && "bg-muted",
                      )}
                      onClick={() => toggleSelection(record.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(record.id)}
                          className="w-5 h-5 rounded border-border text-primary focus:ring-ring"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-base font-medium text-foreground">
                            {record.employee?.name || "Nhân viên"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {record.employee?.email || "Chưa có email"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-base">
                        {record.employee?.employeeID || "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-base font-medium",
                            record.is_paid
                              ? "text-green-600 dark:text-green-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {record.is_paid ? "Đã thanh toán" : "Chưa thanh toán"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isSent ? (
                          <div className="flex flex-col">
                            <span className="text-base text-green-600 font-medium flex items-center gap-1">
                              <Check className="w-4 h-4" /> Đã gửi
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                record.email_sent_at!,
                              ).toLocaleDateString("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ) : hasEmail ? (
                          <span className="text-base text-muted-foreground">
                            Chưa gửi
                          </span>
                        ) : (
                          <span className="text-base text-red-500 font-medium">
                            Thiếu email
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-base font-semibold">
                        {formatVND(record.total_salary)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

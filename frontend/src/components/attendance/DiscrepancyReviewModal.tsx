import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ReconciliationResult,
  reconcileAttendance,
  saveReconciliationResults,
} from "@/lib/attendanceReconciliation";
import { attendanceOptions } from "@/data/attendanceTypes";
import { toast } from "sonner";

interface DiscrepancyReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: number;
  selectedYear: number;
  onReviewComplete: () => void;
}

export function DiscrepancyReviewModal({
  open,
  onOpenChange,
  selectedMonth,
  selectedYear,
  onReviewComplete,
}: DiscrepancyReviewModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [resolvedStatuses, setResolvedStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      loadDiscrepancies();
    }
  }, [open, selectedMonth, selectedYear]);

  const loadDiscrepancies = async () => {
    setIsLoading(true);
    try {
      const data = await reconcileAttendance(selectedYear, selectedMonth);
      // Filter only discrepancies
      const discrepancies = data.filter((r) => r.has_discrepancy);
      setResults(discrepancies);
      
      // Initialize resolved statuses with manual status or 'X' default
      const initial = new Map<string, string>();
      discrepancies.forEach((r) => {
        const key = `${r.employee_id}-${r.work_date}`;
        initial.set(key, r.manual_status || "X");
      });
      setResolvedStatuses(initial);
    } catch (error) {
      console.error("Error loading discrepancies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (employeeId: string, workDate: string, status: string) => {
    const key = `${employeeId}-${workDate}`;
    setResolvedStatuses((prev) => {
      const next = new Map(prev);
      next.set(key, status);
      return next;
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Update results with resolved statuses
      const updatedResults = results.map((r) => {
        const key = `${r.employee_id}-${r.work_date}`;
        const resolvedStatus = resolvedStatuses.get(key);
        return {
          ...r,
          manual_status: resolvedStatus || r.manual_status,
          has_discrepancy: false, // Mark as resolved
        };
      });

      const success = await saveReconciliationResults(updatedResults);
      if (success) {
        toast.success("Đã xử lý tất cả sai lệch");
        onReviewComplete();
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const discrepancyCount = results.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Xử lý sai lệch chấm công
          </DialogTitle>
          <DialogDescription>
            Tháng {selectedMonth + 1}/{selectedYear} - {discrepancyCount} ngày cần xử lý
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : discrepancyCount === 0 ? (
          <div className="text-center py-12">
            <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium">Không có sai lệch</p>
            <p className="text-sm text-muted-foreground">
              Dữ liệu máy và HR khớp nhau
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-2">
                {results.map((record) => {
                  const key = `${record.employee_id}-${record.work_date}`;
                  const currentStatus = resolvedStatuses.get(key) || "";
                  const statusLabel = attendanceOptions.find(
                    (o) => o.value === currentStatus
                  )?.label || currentStatus;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 border-amber-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {record.employee_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({record.employee_code})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(record.work_date).toLocaleDateString("vi-VN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                        <div className="text-xs text-amber-700 mt-1">
                          {record.discrepancy_reason}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-w-[100px]"
                          >
                            <span className="font-bold mr-1">{currentStatus}</span>
                            <span className="text-xs truncate max-w-[60px]">
                              {statusLabel}
                            </span>
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-popover max-h-[200px] overflow-y-auto"
                        >
                          {attendanceOptions.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() =>
                                handleStatusChange(
                                  record.employee_id,
                                  record.work_date,
                                  opt.value
                                )
                              }
                              className={cn(
                                currentStatus === opt.value && "bg-muted"
                              )}
                            >
                              <span className="font-bold mr-2">{opt.value}</span>
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <Badge variant="outline" className="text-amber-600">
                {discrepancyCount} sai lệch
              </Badge>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Hủy
                </Button>
                <Button onClick={handleSaveAll} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Xác nhận tất cả
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

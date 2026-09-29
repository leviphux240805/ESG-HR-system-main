import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerCustom } from "./shared/DatePickerCustom";

interface SalaryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    newSalary: number;
    effectiveDate: string;
    reason: string;
  }) => Promise<void>;
  currentSalary: number;
}

export function SalaryAdjustmentModal({
  isOpen,
  onClose,
  onConfirm,
  currentSalary,
}: SalaryAdjustmentModalProps) {
  const [newSalary, setNewSalary] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewSalary(currentSalary.toString());
      setEffectiveDate(new Date().toISOString().split("T")[0]);
      setReason("");
    }
  }, [isOpen, currentSalary]);

  const formatCurrency = (value: string | number) => {
    const cleaned = String(value).replace(/\D/g, "");
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const unformatCurrency = (value: string) => {
    return value.replace(/,/g, "");
  };

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = unformatCurrency(e.target.value);
    setNewSalary(rawValue);
  };

  const handleConfirm = async () => {
    if (!newSalary || !effectiveDate || !reason) return;

    try {
      setLoading(true);
      await onConfirm({
        newSalary: parseInt(newSalary),
        effectiveDate,
        reason,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update salary", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Điều chỉnh lương cơ bản</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-salary" className="text-right">
              Lương hiện tại
            </Label>
            <Input
              id="current-salary"
              value={formatCurrency(currentSalary)}
              disabled
              className="col-span-3 bg-muted"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="new-salary" className="text-right">
              Lương mới <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-salary"
              value={formatCurrency(newSalary)}
              onChange={handleSalaryChange}
              className="col-span-3"
              placeholder="Nhập mức lương mới"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="effective-date" className="text-right">
              Ngày hiệu lực <span className="text-destructive">*</span>
            </Label>
            <div className="col-span-3">
              <DatePickerCustom
                value={effectiveDate}
                onChange={setEffectiveDate}
                placeholder="Chọn ngày"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reason" className="text-right">
              Lý do <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="col-span-3"
              placeholder="Ví dụ: Tăng lương định kỳ năm 2025"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !newSalary || !reason}>
            {loading ? "Đang xử lý..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

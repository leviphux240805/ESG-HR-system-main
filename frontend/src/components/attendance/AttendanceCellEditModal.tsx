import { useState, useEffect } from "react";
import { Clock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { AttendanceLabel, attendanceOptions } from "@/data/attendanceTypes";
import { ManualAttendanceRecord } from "@/hooks/useAttendanceData";

interface AttendanceCellEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  date: Date | null;
  record: ManualAttendanceRecord | null;
  onSave: (data: {
    status: AttendanceLabel;
    leaveTime?: string;
    returnTime?: string;
    note?: string;
  }) => Promise<boolean>;
}

export function AttendanceCellEditModal({
  open,
  onOpenChange,
  employeeName,
  date,
  record,
  onSave,
}: AttendanceCellEditModalProps) {
  const [status, setStatus] = useState<AttendanceLabel | "">("");
  const [leaveTime, setLeaveTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (open) {
      setStatus((record?.status_code as AttendanceLabel) || "");
      setLeaveTime(record?.leave_time || "");
      setReturnTime(record?.return_time || "");
      setNote(record?.note || "");
    }
  }, [open, record]);

  // Handle leave time change - auto-fill return time if empty
  const handleLeaveTimeChange = (value: string) => {
    setLeaveTime(value);
    // Auto-fill return time to 17:30 if leave time is set and return time is empty
    if (value && !returnTime) {
      setReturnTime("17:30");
    }
  };

  const handleSave = async () => {
    // Allow saving empty status to clear attendance
    
    setIsSaving(true);
    const success = await onSave({
      status: status as AttendanceLabel,
      leaveTime: leaveTime || undefined,
      returnTime: returnTime || undefined,
      note: note || undefined,
    });
    setIsSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Chấm công
          </DialogTitle>
          <DialogDescription>
            {employeeName} - {date?.toLocaleDateString("vi-VN")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto hide-scrollbar py-2 px-1">
          <div className="space-y-2">
            <Label>Trạng thái <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <Select value={status} onValueChange={(v) => setStatus(v as AttendanceLabel)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Chọn trạng thái..." />
                </SelectTrigger>
                <SelectContent>
                  {attendanceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-semibold mr-2">
                        {opt.value === "X" ? (
                          <Check className="w-3.5 h-3.5 inline" />
                        ) : (
                          opt.value
                        )}
                      </span>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {status && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setStatus("");
                    setLeaveTime("");
                    setReturnTime("");
                    setNote("");
                  }}
                  title="Xóa / Bỏ chọn"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Giờ ra</Label>
              <TimePicker
                value={leaveTime}
                onChange={handleLeaveTimeChange}
                placeholder="Chọn giờ..."
              />
            </div>
            <div className="space-y-2">
              <Label>Giờ vào</Label>
              <TimePicker
                value={returnTime}
                onChange={setReturnTime}
                placeholder="Chọn giờ..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Input
              placeholder="Nhập ghi chú..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Check className="w-4 h-4 mr-2" />
            Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

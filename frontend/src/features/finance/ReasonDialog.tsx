import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/api";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText: string;
  onConfirm: (reason: string) => Promise<unknown>;
}

/** Hỏi xác nhận kèm lý do bắt buộc (hủy phiếu, hủy lần thu). */
export function ReasonDialog({ open, onOpenChange, title, description, confirmText, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="reason">
            Lý do<span className="text-destructive ml-0.5">*</span>
          </Label>
          <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)} disabled={pending}>
            Đóng
          </Button>
          <Button variant="destructive" className="min-h-11" onClick={confirm} disabled={pending || !reason.trim()}>
            {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

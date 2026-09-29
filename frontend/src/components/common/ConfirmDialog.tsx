import { ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/api/errors";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có thể trả Promise: nút xác nhận hiện "đang xử lý"; lỗi thì báo toast và giữ hộp thoại mở. */
  onConfirm: () => void | Promise<unknown>;
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

/** Hỏi xác nhận trước khi xóa, khóa hoặc duyệt. */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Xác nhận thao tác",
  description = "Bạn có chắc chắn muốn thực hiện thao tác này không?",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "default",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="min-h-11">
            {cancelText}
          </AlertDialogCancel>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
            className="min-h-11"
          >
            {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

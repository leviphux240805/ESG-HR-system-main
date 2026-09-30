import { ReactNode, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { applyApiErrors } from "@/api";
import { ConfirmDialog } from "./ConfirmDialog";

interface FormSheetProps<T extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Form tạo bằng useForm + zodResolver. */
  form: UseFormReturn<T>;
  /** Gửi dữ liệu lên API; ném lỗi (ApiError) để hiện lỗi dưới ô nhập hoặc toast. */
  onSubmit: (values: T) => Promise<unknown>;
  /** Toast khi lưu thành công. */
  successMessage?: string;
  submitLabel?: string;
  children: ReactNode;
}

/**
 * Form mở dạng panel bên phải (đầy màn hình trên điện thoại). Nút Lưu vô hiệu khi đang gửi; lỗi theo trường hiện
 * dưới ô nhập; thành công thì toast và đóng; đóng khi còn thay đổi chưa lưu thì hỏi lại.
 * Các ô nhập bên trong dùng FormField của components/ui/form.
 */
export function FormSheet<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  successMessage = "Đã lưu.",
  submitLabel = "Lưu",
  children,
}: FormSheetProps<T>) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { isSubmitting, isDirty } = form.formState;

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (isSubmitting) return;
    if (isDirty) return setConfirmDiscard(true);
    onOpenChange(false);
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      toast.success(successMessage);
      form.reset(values);
      onOpenChange(false);
    } catch (error) {
      applyApiErrors(error, form);
    }
  });

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={submit} className="flex flex-1 flex-col min-h-0" noValidate>
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">{children}</div>
              <SheetFooter className="p-6 pt-4 border-t gap-2">
                <Button type="button" variant="outline" onClick={() => requestClose(false)} className="min-h-11">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-h-11">
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? "Đang lưu..." : submitLabel}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Bỏ thay đổi chưa lưu?"
        description="Các thông tin vừa nhập sẽ không được lưu."
        confirmText="Bỏ thay đổi"
        cancelText="Tiếp tục sửa"
        variant="destructive"
        onConfirm={() => {
          form.reset();
          onOpenChange(false);
        }}
      />
    </>
  );
}

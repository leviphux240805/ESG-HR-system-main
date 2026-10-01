import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { lockMonth, unlockMonth } from "@/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { TextAreaField } from "@/features/staff/profile/fields";
import type { MonthSheet } from "@/api";
import { monthLabel } from "./codes";

const unlockSchema = z.object({ reason: z.string().trim().min(1, "Vui lòng ghi lý do mở khóa").max(500) });
type UnlockValues = z.infer<typeof unlockSchema>;

/** Khóa công tháng (ban giám hiệu) và mở khóa kèm lý do (hiệu trưởng). */
export function MonthLockControls({ sheet }: { sheet: MonthSheet }) {
  const queryClient = useQueryClient();
  const [confirmLock, setConfirmLock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const form = useForm<UnlockValues>({ resolver: zodResolver(unlockSchema), defaultValues: { reason: "" } });
  useEffect(() => {
    if (unlocking) form.reset({ reason: "" });
  }, [unlocking, form]);

  const month = sheet.month;
  if (sheet.lock) {
    if (!sheet.canUnlock) return null;
    return (
      <>
        <Button variant="outline" className="min-h-11" onClick={() => setUnlocking(true)}>
          <LockOpen className="w-4 h-4 mr-2" /> Mở khóa công
        </Button>
        <FormSheet
          open={unlocking}
          onOpenChange={setUnlocking}
          title={`Mở khóa công ${monthLabel(month).toLowerCase()}`}
          description="Bảng công sửa được trở lại; lý do được ghi vào nhật ký."
          form={form}
          submitLabel="Mở khóa"
          successMessage="Đã mở khóa công tháng."
          onSubmit={async ({ reason }) => {
            await unlockMonth(month, reason);
            await queryClient.invalidateQueries({ queryKey: ["attendance"] });
          }}
        >
          <TextAreaField form={form} name="reason" label="Lý do mở khóa" required />
        </FormSheet>
      </>
    );
  }
  if (!sheet.canManage) return null;
  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={() => setConfirmLock(true)}>
        <Lock className="w-4 h-4 mr-2" /> Khóa công
      </Button>
      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        title={`Khóa công ${monthLabel(month).toLowerCase()}?`}
        description={
          sheet.discrepancyCount > 0
            ? `Còn ${sheet.discrepancyCount} ngày sai lệch chưa xử lý. Sau khi khóa, bảng công chỉ xem; muốn sửa cần hiệu trưởng mở khóa.`
            : "Tổng công được chốt để tính lương. Sau khi khóa, bảng công chỉ xem; muốn sửa cần hiệu trưởng mở khóa."
        }
        confirmText="Khóa công"
        onConfirm={async () => {
          await lockMonth(month);
          toast.success("Đã khóa công tháng.");
          await queryClient.invalidateQueries({ queryKey: ["attendance"] });
        }}
      />
    </>
  );
}

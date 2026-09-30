import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { terminateStaff, transferStaff } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { FormSheet } from "@/components/common/FormSheet";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate } from "@/lib/format";
import type { FileRef, StaffDetail } from "@/api";
import { todayIso } from "../dates";
import { AttachmentField } from "./AttachmentField";
import { SelectField, TextAreaField, TextField } from "./fields";

interface Props {
  staff: StaffDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const decisionField = (staff: StaffDetail, label: string) =>
  function DecisionField({ field }: { field: { value: FileRef | null; onChange: (file: FileRef | null) => void } }) {
    return (
      <FormItem>
        <AttachmentField label={label} staffId={staff.id} schoolId={staff.schoolId} value={field.value} onChange={field.onChange} />
        <FormMessage />
      </FormItem>
    );
  };

// ---- điều chuyển

const transferSchema = z.object({
  schoolId: z.string().min(1, "Vui lòng chọn cơ sở mới"),
  effectiveDate: z.string().min(1, "Vui lòng chọn ngày hiệu lực"),
  decisionFile: z.custom<FileRef | null>().default(null),
  note: z.string().trim().max(500).default(""),
});
type TransferValues = z.infer<typeof transferSchema>;

/**
 * Điều chuyển sang cơ sở khác (chỉ cấp chuỗi). Hiệu lực hôm nay/quá khứ thì chuyển ngay và đổi cơ sở đang xem sang
 * cơ sở mới để vẫn thấy hồ sơ; ngày tương lai thì hệ thống tự chuyển khi tới ngày.
 */
export function TransferSheet({ staff, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { schools, schoolId: selected, select } = useCurrentSchool();
  const form = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { schoolId: "", effectiveDate: todayIso(), decisionFile: null, note: "" },
  });
  useEffect(() => {
    if (open) form.reset({ schoolId: "", effectiveDate: todayIso(), decisionFile: null, note: "" });
  }, [open, form]);

  const targets = schools.filter((s) => s.id !== staff.schoolId).map((s) => ({ value: s.id, label: s.name }));

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Điều chuyển cơ sở"
      description={`${staff.fullName} đang làm tại ${staff.schoolName}. Quá trình công tác cũ vẫn giữ trong lịch sử.`}
      form={form}
      submitLabel="Điều chuyển"
      successMessage="Đã ghi nhận điều chuyển."
      onSubmit={async (v) => {
        await transferStaff(staff.id, {
          schoolId: v.schoolId,
          effectiveDate: v.effectiveDate,
          decisionFileId: v.decisionFile?.id,
          note: v.note || undefined,
        });
        const target = schools.find((s) => s.id === v.schoolId)?.name ?? "cơ sở mới";
        if (v.effectiveDate <= todayIso()) {
          // Đang xem riêng cơ sở cũ thì hồ sơ sẽ không còn trong phạm vi: chuyển sang xem cơ sở mới
          if (selected !== null && selected !== v.schoolId) select(v.schoolId);
          toast.info(`${staff.fullName} đã chuyển sang ${target}.`);
        } else {
          toast.info(`${staff.fullName} sẽ chuyển sang ${target} từ ngày ${formatDate(v.effectiveDate)}.`);
        }
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <SelectField form={form} name="schoolId" label="Cơ sở mới" required options={targets} />
      <TextField
        form={form}
        name="effectiveDate"
        label="Ngày hiệu lực"
        type="date"
        required
        description="Chọn ngày tương lai nếu quyết định có hiệu lực sau; hệ thống tự chuyển khi tới ngày."
      />
      <FormField control={form.control} name="decisionFile" render={decisionField(staff, "Quyết định điều chuyển")} />
      <TextAreaField form={form} name="note" label="Ghi chú" />
    </FormSheet>
  );
}

// ---- nghỉ việc

const terminateSchema = z.object({
  endDate: z.string().min(1, "Vui lòng chọn ngày nghỉ"),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(500),
  decisionFile: z.custom<FileRef | null>().default(null),
});
type TerminateValues = z.infer<typeof terminateSchema>;

/** Cho nghỉ việc: đổi trạng thái, khóa tài khoản đăng nhập và thu hồi phiên đang mở. */
export function TerminateSheet({ staff, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<TerminateValues>({
    resolver: zodResolver(terminateSchema),
    defaultValues: { endDate: todayIso(), reason: "", decisionFile: null },
  });
  useEffect(() => {
    if (open) form.reset({ endDate: todayIso(), reason: "", decisionFile: null });
  }, [open, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cho nghỉ việc"
      description={`${staff.fullName} – ${staff.staffCode}`}
      form={form}
      submitLabel="Cho nghỉ việc"
      successMessage="Đã cho nhân viên nghỉ việc."
      onSubmit={async (v) => {
        await terminateStaff(staff.id, {
          endDate: v.endDate,
          reason: v.reason,
          decisionFileId: v.decisionFile?.id,
        });
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      {staff.account && (
        <Alert variant="destructive">
          <AlertDescription>
            Tài khoản đăng nhập {staff.account.email} sẽ bị khóa ngay và mọi phiên đăng nhập bị thu hồi.
          </AlertDescription>
        </Alert>
      )}
      <TextField form={form} name="endDate" label="Ngày nghỉ việc" type="date" required />
      <TextAreaField form={form} name="reason" label="Lý do" required />
      <FormField control={form.control} name="decisionFile" render={decisionField(staff, "Quyết định chấm dứt hợp đồng")} />
    </FormSheet>
  );
}

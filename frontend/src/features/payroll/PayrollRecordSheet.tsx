import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ExportButton } from "@/components/common/ExportButton";
import { FormSheet } from "@/components/common/FormSheet";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TextAreaField, TextField } from "@/features/staff/profile/fields";
import { adjustPayrollRecord, type PayrollRow, payslipPdf, usePayslip } from "@/api";
import { PayslipBreakdown } from "./PayslipBreakdown";

const money = z.coerce.number({ invalid_type_error: "Nhập số tiền" }).int("Số tiền là số nguyên").min(0, "Không được âm");
const schema = z.object({ bonus: money, fines: money, note: z.string().trim().max(500) });
type Values = z.infer<typeof schema>;

/** Chi tiết phiếu lương một người; bảng nháp thì sửa được thưởng, phạt, ghi chú. */
export function PayrollRecordSheet({ row, editable, onClose }: { row: PayrollRow | null; editable: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const payslip = usePayslip(row?.id ?? null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { bonus: 0, fines: 0, note: "" } });
  useEffect(() => {
    if (row) form.reset({ bonus: row.bonus, fines: row.fines, note: row.note ?? "" });
  }, [row, form]);

  const detail = payslip.isLoading ? (
    <PageSkeleton />
  ) : payslip.isError ? (
    <ErrorState error={payslip.error} onRetry={() => payslip.refetch()} />
  ) : payslip.data ? (
    <div className="space-y-3">
      <PayslipBreakdown payslip={payslip.data} />
      <ExportButton label="Tải phiếu lương" request={() => payslipPdf(payslip.data!.id)} fileName={`phieu-luong-${payslip.data.staffCode}.pdf`} />
    </div>
  ) : null;

  if (editable) {
    return (
      <FormSheet
        open={!!row}
        onOpenChange={(o) => !o && onClose()}
        title={row?.fullName ?? ""}
        description="Sửa thưởng, phạt; phiếu lương tính lại ngay."
        form={form}
        successMessage="Đã lưu, phiếu lương đã tính lại."
        onSubmit={async (v) => {
          await adjustPayrollRecord(row!.id, { bonus: v.bonus, fines: v.fines, note: v.note || undefined });
          await queryClient.invalidateQueries({ queryKey: ["payroll"] });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField form={form} name="bonus" label="Thưởng (đ)" inputMode="numeric" type="number" />
          <TextField form={form} name="fines" label="Phạt (đ)" inputMode="numeric" type="number" />
        </div>
        <TextAreaField form={form} name="note" label="Ghi chú" />
        {detail}
      </FormSheet>
    );
  }
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-4">
          <SheetTitle>{row?.fullName}</SheetTitle>
          <SheetDescription>Phiếu lương {row?.staffCode}</SheetDescription>
        </SheetHeader>
        {detail}
      </SheetContent>
    </Sheet>
  );
}

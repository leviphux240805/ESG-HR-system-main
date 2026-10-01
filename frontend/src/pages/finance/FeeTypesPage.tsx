import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Receipt } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import { useFinanceAccess } from "@/features/finance/access";
import { CALC_METHOD_LABELS, type FeeType, createFeeType, updateFeeType, useFeeTypes } from "@/api";

const ACTIVE = { true: { label: "Đang dùng", tone: "success" }, false: { label: "Ngừng dùng", tone: "neutral" } } as const;

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,30}$/, "Mã gồm chữ in hoa, số, dấu gạch dưới (2–30 ký tự)"),
  name: z.string().trim().min(1, "Vui lòng nhập tên khoản thu").max(100),
  calcMethod: z.enum(["MONTHLY", "PER_DAY", "ONE_TIME", "OPTIONAL"]),
  orderNo: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), "Nhập số nguyên ≥ 0"),
  refundableOnAbsence: z.boolean(),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function CheckField({ form, name, label }: { form: ReturnType<typeof useForm<FormValues>>; name: "refundableOnAbsence" | "active"; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex min-h-11 items-center gap-3 space-y-0">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
          </FormControl>
          <FormLabel className="font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}

/** Danh mục khoản thu dùng chung trong tổ chức; giá từng cơ sở đặt ở Biểu phí. */
export default function FeeTypesPage() {
  const queryClient = useQueryClient();
  const query = useFeeTypes();
  const { canCatalog } = useFinanceAccess();
  const [editing, setEditing] = useState<FeeType | "new" | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const open = (item: FeeType | "new") => {
    const f = item === "new" ? null : item;
    form.reset({
      code: f?.code ?? "",
      name: f?.name ?? "",
      calcMethod: f?.calcMethod ?? "MONTHLY",
      orderNo: String(f?.orderNo ?? (query.data?.length ?? 0) + 1),
      refundableOnAbsence: f?.refundableOnAbsence ?? false,
      active: f?.active ?? true,
    });
    setEditing(item);
  };

  const submit = async (v: FormValues) => {
    const orderNo = v.orderNo === "" ? undefined : Number(v.orderNo);
    if (editing === "new") await createFeeType({ code: v.code, name: v.name, calcMethod: v.calcMethod, orderNo, refundableOnAbsence: v.refundableOnAbsence });
    else if (editing) await updateFeeType(editing.id, { name: v.name, orderNo, refundableOnAbsence: v.refundableOnAbsence, active: v.active });
    await queryClient.invalidateQueries({ queryKey: ["finance"] });
  };

  const list = query.data ?? [];

  return (
    <div>
      <PageHeader
        title="Khoản thu"
        description="Danh mục khoản thu chung của tổ chức và cách tính; hiệu trưởng quản lý."
        actions={
          canCatalog && (
            <Button className="min-h-11" onClick={() => open("new")}>
              <Plus className="w-4 h-4 mr-2" /> Thêm khoản thu
            </Button>
          )
        }
      />
      {query.isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Receipt} title="Chưa có khoản thu" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">TT</TableHead>
                  <TableHead>Khoản thu</TableHead>
                  <TableHead>Cách tính</TableHead>
                  <TableHead>Hoàn khi vắng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  {canCatalog && <TableHead className="w-14" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.orderNo}</TableCell>
                    <TableCell>
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.code}</p>
                    </TableCell>
                    <TableCell>{CALC_METHOD_LABELS[f.calcMethod]}</TableCell>
                    <TableCell>{f.refundableOnAbsence ? "Có" : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(f.active)} labels={ACTIVE} />
                    </TableCell>
                    {canCatalog && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Sửa ${f.name}`} onClick={() => open(f)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm khoản thu" : "Sửa khoản thu"}
        form={form}
        onSubmit={submit}
      >
        {editing === "new" && <TextField form={form} name="code" label="Mã" required placeholder="VD: BAN_TRU" />}
        <TextField form={form} name="name" label="Tên khoản thu" required />
        {editing === "new" && (
          <SelectField
            form={form}
            name="calcMethod"
            label="Cách tính"
            required
            options={Object.entries(CALC_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
          />
        )}
        <TextField form={form} name="orderNo" label="Thứ tự" inputMode="numeric" />
        <CheckField form={form} name="refundableOnAbsence" label="Hoàn tiền ngày vắng có phép (khoản tính theo ngày)" />
        {editing !== "new" && <CheckField form={form} name="active" label="Đang dùng" />}
      </FormSheet>
    </div>
  );
}

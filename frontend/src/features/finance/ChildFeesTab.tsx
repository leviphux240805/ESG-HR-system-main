import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import { formatMoney, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  INVOICE_STATUS,
  type ChildDiscount,
  type ChildFeeItem,
  deleteChildDiscount,
  deleteChildFeeItem,
  monthStart,
  saveChildDiscount,
  saveChildFeeItem,
  useChildDiscounts,
  useChildFeeItems,
  useChildInvoices,
  useFeeTypes,
} from "@/api";
import { InvoiceSheet } from "./InvoiceSheet";
import { useFinanceAccess } from "./access";
import { moneyInput, parseMoney } from "./money";

const ALL = "__all";
const month = (v?: string) => (v ? formatMonth(v.slice(0, 7)) : "");
const period = (from: string, to?: string) => (to ? `${month(from)} – ${month(to)}` : `Từ ${month(from)}`);
const monthsValid = (v: { fromMonth: string; toMonth?: string }) => !v.toMonth || v.toMonth >= v.fromMonth;

const feeItemSchema = z
  .object({
    feeTypeId: z.string().min(1, "Vui lòng chọn khoản thu"),
    fromMonth: z.string().min(1, "Vui lòng chọn tháng bắt đầu"),
    toMonth: z.string().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(monthsValid, { path: ["toMonth"], message: "Tháng kết thúc phải sau tháng bắt đầu" });
type FeeItemForm = z.infer<typeof feeItemSchema>;

const discountSchema = z
  .object({
    kind: z.enum(["percent", "amount"]),
    value: z.string().trim().min(1, "Vui lòng nhập mức giảm"),
    feeTypeId: z.string(),
    reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(255),
    fromMonth: z.string().min(1, "Vui lòng chọn tháng bắt đầu"),
    toMonth: z.string().optional(),
  })
  .refine(monthsValid, { path: ["toMonth"], message: "Tháng kết thúc phải sau tháng bắt đầu" })
  .refine((v) => (v.kind === "percent" ? Number(v.value) >= 1 && Number(v.value) <= 100 : moneyInput().safeParse(v.value).success), {
    path: ["value"],
    message: "Phần trăm từ 1 đến 100, hoặc số tiền lớn hơn 0",
  });
type DiscountForm = z.infer<typeof discountSchema>;

function InvoicesCard({ childId }: { childId: string }) {
  const query = useChildInvoices(childId);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = query.data ?? [];
  const balance = list.filter((i) => ["ISSUED", "PARTIAL", "PAID"].includes(i.status)).reduce((s, i) => s + i.balance, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Phiếu thu</CardTitle>
        {!query.isLoading && !query.isError && (
          <p className={cn("text-sm", balance > 0 ? "text-destructive" : "text-green-700")}>
            {balance > 0 ? `Còn nợ ${formatMoney(balance)}` : balance < 0 ? `Trả thừa ${formatMoney(-balance)}` : "Đã đóng đủ học phí."}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={Receipt} title="Chưa có phiếu thu" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tháng</TableHead>
                  <TableHead className="text-right">Phải thu</TableHead>
                  <TableHead className="text-right">Còn lại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <button type="button" className="min-h-11 text-left font-medium hover:underline" onClick={() => setOpenId(i.id)}>
                        {month(i.periodMonth)}
                        <span className="block text-xs font-normal text-muted-foreground">{i.invoiceNo ?? "Nháp"}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(i.amountDue)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", i.balance > 0 && "text-destructive")}>{formatMoney(i.balance)}</TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} labels={INVOICE_STATUS} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <InvoiceSheet id={openId} onClose={() => setOpenId(null)} />
    </Card>
  );
}

function FeeItemsCard({ childId, canManage }: { childId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const query = useChildFeeItems(childId);
  const feeTypes = useFeeTypes();
  const [editing, setEditing] = useState<ChildFeeItem | "new" | null>(null);
  const [removing, setRemoving] = useState<ChildFeeItem | null>(null);
  const form = useForm<FeeItemForm>({ resolver: zodResolver(feeItemSchema) });
  const options = (feeTypes.data ?? []).filter((f) => f.calcMethod === "OPTIONAL" && f.active).map((f) => ({ value: f.id, label: f.name }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const open = (item: ChildFeeItem | "new") => {
    const i = item === "new" ? null : item;
    form.reset({ feeTypeId: i?.feeTypeId ?? "", fromMonth: i?.fromMonth.slice(0, 7) ?? "", toMonth: i?.toMonth?.slice(0, 7) ?? "", note: i?.note ?? "" });
    setEditing(item);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Khoản tự chọn</CardTitle>
        {canManage && (
          <Button variant="outline" className="min-h-11" onClick={() => open("new")}>
            <Plus className="w-4 h-4 mr-2" /> Đăng ký
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={2} columns={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa đăng ký khoản tự chọn (năng khiếu, xe đưa đón…).</p>
        ) : (
          <ul className="divide-y">
            {query.data!.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-1">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{i.feeTypeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {period(i.fromMonth, i.toMonth)}
                    {i.note && ` · ${i.note}`}
                  </p>
                </div>
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(i)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Xóa" onClick={() => setRemoving(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Đăng ký khoản tự chọn" : "Sửa khoản tự chọn"}
        form={form}
        onSubmit={async (v) => {
          await saveChildFeeItem(childId, editing === "new" || !editing ? null : editing.id, {
            feeTypeId: v.feeTypeId,
            fromMonth: monthStart(v.fromMonth),
            toMonth: v.toMonth ? monthStart(v.toMonth) : undefined,
            note: v.note || undefined,
          });
          await refresh();
        }}
      >
        <SelectField form={form} name="feeTypeId" label="Khoản thu" options={options} required />
        <TextField form={form} name="fromMonth" label="Từ tháng" type="month" required />
        <TextField form={form} name="toMonth" label="Đến tháng" type="month" description="Bỏ trống nếu chưa có ngày kết thúc." />
        <TextField form={form} name="note" label="Ghi chú" />
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Bỏ đăng ký khoản này?"
        description="Phiếu đã phát hành không thay đổi; phiếu nháp được tính lại khi sinh phiếu."
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteChildFeeItem(childId, removing!.id);
          toast.success("Đã xóa.");
          await refresh();
        }}
      />
    </Card>
  );
}

function discountLabel(d: ChildDiscount) {
  const value = d.percent ? `${d.percent}%` : formatMoney(d.amount ?? 0);
  return `Giảm ${value} ${d.feeTypeName ? d.feeTypeName.toLowerCase() : "tổng phiếu"}`;
}

function DiscountsCard({ childId, canManage }: { childId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const query = useChildDiscounts(childId);
  const feeTypes = useFeeTypes();
  const [editing, setEditing] = useState<ChildDiscount | "new" | null>(null);
  const [removing, setRemoving] = useState<ChildDiscount | null>(null);
  const form = useForm<DiscountForm>({ resolver: zodResolver(discountSchema) });
  const options = [{ value: ALL, label: "Cả phiếu" }, ...(feeTypes.data ?? []).filter((f) => f.active).map((f) => ({ value: f.id, label: f.name }))];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const open = (item: ChildDiscount | "new") => {
    const d = item === "new" ? null : item;
    form.reset({
      kind: d?.amount ? "amount" : "percent",
      value: d ? String(d.percent ?? d.amount ?? "") : "",
      feeTypeId: d?.feeTypeId ?? ALL,
      reason: d?.reason ?? "",
      fromMonth: d?.fromMonth.slice(0, 7) ?? "",
      toMonth: d?.toMonth?.slice(0, 7) ?? "",
    });
    setEditing(item);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Miễn giảm</CardTitle>
        {canManage && (
          <Button variant="outline" className="min-h-11" onClick={() => open("new")}>
            <Plus className="w-4 h-4 mr-2" /> Thêm
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={2} columns={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có miễn giảm.</p>
        ) : (
          <ul className="divide-y">
            {query.data!.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-1">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{discountLabel(d)}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.reason} · {period(d.fromMonth, d.toMonth)}
                  </p>
                </div>
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(d)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Xóa" onClick={() => setRemoving(d)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm miễn giảm" : "Sửa miễn giảm"}
        form={form}
        onSubmit={async (v) => {
          await saveChildDiscount(childId, editing === "new" || !editing ? null : editing.id, {
            percent: v.kind === "percent" ? Number(v.value) : undefined,
            amount: v.kind === "amount" ? parseMoney(v.value) : undefined,
            feeTypeId: v.feeTypeId === ALL ? undefined : v.feeTypeId,
            reason: v.reason,
            fromMonth: monthStart(v.fromMonth),
            toMonth: v.toMonth ? monthStart(v.toMonth) : undefined,
          });
          await refresh();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            form={form}
            name="kind"
            label="Kiểu giảm"
            options={[
              { value: "percent", label: "Phần trăm" },
              { value: "amount", label: "Số tiền" },
            ]}
          />
          <TextField form={form} name="value" label={form.watch("kind") === "amount" ? "Số tiền (₫)" : "Phần trăm (%)"} inputMode="numeric" required />
        </div>
        <SelectField form={form} name="feeTypeId" label="Áp dụng cho" options={options} />
        <TextField form={form} name="reason" label="Lý do" required />
        <TextField form={form} name="fromMonth" label="Từ tháng" type="month" required />
        <TextField form={form} name="toMonth" label="Đến tháng" type="month" description="Bỏ trống nếu chưa có ngày kết thúc." />
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa miễn giảm?"
        description="Phiếu đã phát hành không thay đổi; phiếu nháp được tính lại khi sinh phiếu."
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteChildDiscount(childId, removing!.id);
          toast.success("Đã xóa.");
          await refresh();
        }}
      />
    </Card>
  );
}

/** Tab Học phí trong hồ sơ trẻ: phiếu thu, khoản tự chọn, miễn giảm. */
export function ChildFeesTab({ childId }: { childId: string }) {
  const { canManage } = useFinanceAccess();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InvoicesCard childId={childId} />
      <div className="space-y-4">
        <FeeItemsCard childId={childId} canManage={canManage} />
        <DiscountsCard childId={childId} canManage={canManage} />
      </div>
    </div>
  );
}

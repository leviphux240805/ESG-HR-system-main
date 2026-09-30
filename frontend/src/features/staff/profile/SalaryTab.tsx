import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { z } from "zod";
import { api, unwrap } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormSheet } from "@/components/common/FormSheet";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getAllBanks } from "@/data/bankData";
import { formatDate, formatMoney } from "@/lib/format";
import { type SalaryConfigDto, type StaffDetail, useSalaryConfigs } from "../api";
import { todayIso } from "../dates";
import {
  ALLOWANCE_LABELS,
  type AllowanceKey,
  options,
  SALARY_MODE_LABELS,
  SALARY_REGION_LABELS,
} from "../labels";
import { SelectField, TextAreaField, TextField } from "./fields";

const ALLOWANCE_KEYS = Object.keys(ALLOWANCE_LABELS) as AllowanceKey[];

const amount = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0), "Nhập số tiền (đồng), không có dấu chấm")
  .default("");

const salarySchema = z
  .object({
    effectiveFrom: z.string().min(1, "Vui lòng chọn ngày hiệu lực"),
    salaryMode: z.enum(["FIXED", "COEFFICIENT"]),
    baseSalary: amount,
    coefficient: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+(\.\d{1,3})?$/.test(v) && Number(v) > 0), "Hệ số dạng 2.34")
      .default(""),
    region: z.enum(["I", "II", "III", "IV"]).optional(),
    allowances: z.object(Object.fromEntries(ALLOWANCE_KEYS.map((k) => [k, amount])) as Record<AllowanceKey, typeof amount>),
    insuranceSalary: amount,
    note: z.string().trim().max(500).default(""),
  })
  .refine((v) => v.salaryMode !== "FIXED" || v.baseSalary !== "", { path: ["baseSalary"], message: "Nhập lương cơ bản" })
  .refine((v) => v.salaryMode !== "COEFFICIENT" || v.coefficient !== "", { path: ["coefficient"], message: "Nhập hệ số lương" });

type SalaryValues = z.infer<typeof salarySchema>;

/** Giá trị form mặc định: chép từ cấu hình đang áp dụng để chỉ cần sửa phần thay đổi. */
function toValues(base?: SalaryConfigDto): SalaryValues {
  const allowances = Object.fromEntries(
    ALLOWANCE_KEYS.map((k) => [k, base?.allowances?.[k] != null ? String(base.allowances[k]) : ""]),
  ) as Record<AllowanceKey, string>;
  return {
    effectiveFrom: "",
    salaryMode: base?.salaryMode ?? "FIXED",
    baseSalary: base?.baseSalary != null ? String(base.baseSalary) : "",
    coefficient: base?.coefficient != null ? String(base.coefficient) : "",
    region: base?.region ?? undefined,
    allowances,
    insuranceSalary: base?.insuranceSalary != null ? String(base.insuranceSalary) : "",
    note: "",
  };
}

const num = (v: string) => (v === "" ? undefined : Number(v));

function SalarySheet({
  staff,
  base,
  open,
  onOpenChange,
}: {
  staff: StaffDetail;
  base?: SalaryConfigDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<SalaryValues>({ resolver: zodResolver(salarySchema), defaultValues: toValues(base) });
  useEffect(() => {
    if (open) form.reset(toValues(base));
  }, [open, base, form]);
  const mode = form.watch("salaryMode");

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Điều chỉnh lương"
      description="Tạo cấu hình lương mới từ ngày hiệu lực; cấu hình cũ giữ nguyên trong lịch sử."
      form={form}
      successMessage="Đã lưu cấu hình lương mới."
      onSubmit={async (v) => {
        const allowances = Object.fromEntries(
          ALLOWANCE_KEYS.filter((k) => v.allowances[k] !== "").map((k) => [k, Number(v.allowances[k])]),
        );
        unwrap(
          await api.POST("/api/v1/staff/{staffId}/salary-configs", {
            params: { path: { staffId: staff.id } },
            body: {
              effectiveFrom: v.effectiveFrom,
              salaryMode: v.salaryMode,
              baseSalary: v.salaryMode === "FIXED" ? num(v.baseSalary) : undefined,
              coefficient: v.salaryMode === "COEFFICIENT" ? num(v.coefficient) : undefined,
              region: v.region,
              allowances,
              insuranceSalary: num(v.insuranceSalary),
              note: v.note || undefined,
            },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="effectiveFrom" label="Hiệu lực từ ngày" type="date" required />
        <SelectField form={form} name="salaryMode" label="Hình thức lương" required options={options(SALARY_MODE_LABELS)} />
        {mode === "FIXED" ? (
          <TextField form={form} name="baseSalary" label="Lương cơ bản (đồng/tháng)" inputMode="numeric" required />
        ) : (
          <TextField form={form} name="coefficient" label="Hệ số lương" inputMode="decimal" required placeholder="2.34" />
        )}
        <SelectField form={form} name="region" label="Vùng lương tối thiểu" options={options(SALARY_REGION_LABELS)} />
        <TextField
          form={form}
          name="insuranceSalary"
          label="Lương đóng bảo hiểm (đồng)"
          inputMode="numeric"
          description="Bỏ trống nếu bằng lương cơ bản."
        />
      </div>
      <p className="text-sm font-medium pt-2">Phụ cấp (đồng/tháng)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {ALLOWANCE_KEYS.map((k) => (
          <TextField key={k} form={form} name={`allowances.${k}`} label={ALLOWANCE_LABELS[k]} inputMode="numeric" />
        ))}
      </div>
      <TextAreaField form={form} name="note" label="Ghi chú (lý do điều chỉnh)" />
    </FormSheet>
  );
}

// ---- ngân hàng

const bankSchema = z.object({
  bankName: z.string().trim().max(100).default(""),
  bankAccountNo: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9]{6,30}$/.test(v), "Số tài khoản chỉ gồm chữ số")
    .default(""),
  bankAccountHolder: z.string().trim().max(200).default(""),
});
type BankValues = z.infer<typeof bankSchema>;

function BankSheet({ staff, open, onOpenChange }: { staff: StaffDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const banks = useQuery({ queryKey: ["banks"], queryFn: getAllBanks, staleTime: Infinity, enabled: open });
  const initial = (): BankValues => ({
    bankName: staff.bank?.bankName ?? "",
    bankAccountNo: staff.bank?.bankAccountNo ?? "",
    // Chủ tài khoản mặc định là tên nhân viên viết hoa, như trên thẻ ngân hàng
    bankAccountHolder: staff.bank?.bankAccountHolder ?? staff.fullName.toLocaleUpperCase("vi-VN"),
  });
  const form = useForm<BankValues>({ resolver: zodResolver(bankSchema), defaultValues: initial() });
  useEffect(() => {
    if (open) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở
  }, [open]);

  const bankOptions = (banks.data ?? []).map((b) => ({ value: b.shortName, label: `${b.shortName} – ${b.name}` }));
  const current = form.watch("bankName");
  if (current && !bankOptions.some((o) => o.value === current)) bankOptions.unshift({ value: current, label: current });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tài khoản nhận lương"
      form={form}
      successMessage="Đã lưu tài khoản ngân hàng."
      onSubmit={async (v) => {
        unwrap(
          await api.PUT("/api/v1/staff/{staffId}/bank", {
            params: { path: { staffId: staff.id } },
            body: { bankName: v.bankName || undefined, bankAccountNo: v.bankAccountNo || undefined, bankAccountHolder: v.bankAccountHolder || undefined },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <SelectField form={form} name="bankName" label="Ngân hàng" options={bankOptions} placeholder={banks.isLoading ? "Đang tải..." : "Chọn ngân hàng"} />
      <TextField form={form} name="bankAccountNo" label="Số tài khoản" inputMode="numeric" />
      <TextField form={form} name="bankAccountHolder" label="Chủ tài khoản" />
    </FormSheet>
  );
}

// ---- hiển thị

function salaryText(c: SalaryConfigDto) {
  return c.salaryMode === "FIXED" ? formatMoney(c.baseSalary) : `Hệ số ${c.coefficient}`;
}

function allowanceLines(c: SalaryConfigDto) {
  return ALLOWANCE_KEYS.filter((k) => c.allowances?.[k]).map((k) =>
    k === "seniorityPercent" ? `${ALLOWANCE_LABELS[k]}: ${c.allowances[k]}%` : `${ALLOWANCE_LABELS[k]}: ${formatMoney(c.allowances[k])}`,
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-0.5">{children || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

/** Tab "Lương & phụ cấp": chỉ hiện với người được xem lương (hiệu trưởng không thấy tab này). */
export function SalaryTab({ staff }: { staff: StaffDetail }) {
  const configs = useSalaryConfigs(staff.id, staff.permissions.canViewSalary);
  const [adjusting, setAdjusting] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const canManage = staff.permissions.canManageSalary && staff.status === "ACTIVE";
  const today = todayIso();
  const current = configs.data?.find((c) => c.current);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Lương đang áp dụng</CardTitle>
          {canManage && (
            <Button className="min-h-11" onClick={() => setAdjusting(true)}>
              <Plus className="w-4 h-4 mr-2" /> Điều chỉnh lương
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {configs.isLoading ? (
            <TableSkeleton rows={1} columns={3} />
          ) : configs.isError ? (
            <ErrorState error={configs.error} onRetry={() => configs.refetch()} />
          ) : !current ? (
            <EmptyState title="Chưa có cấu hình lương" description={canManage ? "Bấm “Điều chỉnh lương” để nhập lương cho nhân viên." : undefined} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Row label="Hình thức">{SALARY_MODE_LABELS[current.salaryMode]}</Row>
              <Row label={current.salaryMode === "FIXED" ? "Lương cơ bản" : "Hệ số"}>{salaryText(current)}</Row>
              <Row label="Vùng">{current.region && SALARY_REGION_LABELS[current.region]}</Row>
              <Row label="Lương đóng bảo hiểm">{formatMoney(current.insuranceSalary)}</Row>
              <Row label="Hiệu lực từ">{formatDate(current.effectiveFrom)}</Row>
              <Row label="Phụ cấp">
                {allowanceLines(current).length > 0 && (
                  <ul className="text-sm">
                    {allowanceLines(current).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </Row>
            </dl>
          )}
        </CardContent>
      </Card>

      {configs.data && configs.data.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lịch sử điều chỉnh lương</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hiệu lực từ</TableHead>
                  <TableHead>Lương</TableHead>
                  <TableHead>Phụ cấp</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead>Người nhập</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        {formatDate(c.effectiveFrom)}
                        {c.current && <StatusBadge status="CURRENT" labels={{ CURRENT: { label: "Đang áp dụng", tone: "success" } }} />}
                        {c.effectiveFrom > today && <StatusBadge status="UPCOMING" labels={{ UPCOMING: { label: "Sắp áp dụng", tone: "info" } }} />}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{salaryText(c)}</TableCell>
                    <TableCell className="text-sm">{allowanceLines(c).join(", ") || "—"}</TableCell>
                    <TableCell className="max-w-[16rem] truncate" title={c.note ?? undefined}>
                      {c.note ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {c.createdByName ?? ""} · {formatDate(c.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Tài khoản nhận lương</CardTitle>
          {canManage && (
            <Button variant="outline" className="min-h-11" onClick={() => setEditingBank(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Sửa
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Row label="Ngân hàng">{staff.bank?.bankName}</Row>
            <Row label="Số tài khoản">{staff.bank?.bankAccountNo}</Row>
            <Row label="Chủ tài khoản">{staff.bank?.bankAccountHolder}</Row>
          </dl>
        </CardContent>
      </Card>

      <SalarySheet staff={staff} base={current ?? configs.data?.[0]} open={adjusting} onOpenChange={setAdjusting} />
      <BankSheet staff={staff} open={editingBank} onOpenChange={setEditingBank} />
    </div>
  );
}

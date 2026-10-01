import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate, formatMoney } from "@/lib/format";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import { useFinanceAccess } from "@/features/finance/access";
import { moneyInput, parseMoney } from "@/features/finance/money";
import {
  CALC_METHOD_LABELS,
  MEAL_REFUND_LABELS,
  PRORATION_LABELS,
  type FeeSchedule,
  type SchoolYear,
  createFeeSchedule,
  createFinanceConfig,
  deleteFeeSchedule,
  useAgeGroups,
  useFeeSchedules,
  useFeeTypes,
  useFinanceConfigs,
  useSchoolYears,
} from "@/api";

const ALL = "__all";

const scheduleSchema = z.object({
  feeTypeId: z.string().min(1, "Vui lòng chọn khoản thu"),
  ageGroupId: z.string(),
  amount: moneyInput(),
  effectiveFrom: z.string().min(1, "Vui lòng chọn ngày hiệu lực"),
  note: z.string().trim().max(255).optional(),
});
type ScheduleForm = z.infer<typeof scheduleSchema>;

const configSchema = z.object({
  effectiveFrom: z.string().min(1, "Vui lòng chọn ngày hiệu lực"),
  dueDay: z
    .string()
    .trim()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 28, "Nhập ngày từ 1 đến 28"),
  mealRefundRule: z.enum(["BEFORE_CUTOFF", "ALL_EXCUSED", "NONE"]),
  proration: z.enum(["FULL_MONTH", "BY_SCHOOL_DAYS"]),
  organizationWide: z.boolean(),
});
type ConfigForm = z.infer<typeof configSchema>;

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function SchedulesTab({ year, canManage }: { year: SchoolYear; canManage: boolean }) {
  const queryClient = useQueryClient();
  const query = useFeeSchedules(year.id);
  const feeTypes = useFeeTypes();
  const ageGroups = useAgeGroups();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<FeeSchedule | null>(null);
  const form = useForm<ScheduleForm>({ resolver: zodResolver(scheduleSchema) });

  const groups = useMemo(() => {
    const map = new Map<string, FeeSchedule[]>();
    for (const s of query.data ?? []) map.set(s.feeTypeId, [...(map.get(s.feeTypeId) ?? []), s]);
    return [...map.values()];
  }, [query.data]);

  const open = () => {
    form.reset({ feeTypeId: "", ageGroupId: ALL, amount: "", effectiveFrom: year.startDate, note: "" });
    setAdding(true);
  };

  if (query.isLoading) return <TableSkeleton rows={6} columns={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-3">
      {canManage && (
        <Button className="min-h-11" onClick={open}>
          <Plus className="w-4 h-4 mr-2" /> Thêm mức thu
        </Button>
      )}
      {groups.length === 0 ? (
        <EmptyState icon={Receipt} title="Chưa có biểu phí" description={`Năm học ${year.name} chưa có mức thu nào.`} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((list) => (
            <Card key={list[0].feeTypeId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{list[0].feeTypeName}</CardTitle>
                <p className="text-xs text-muted-foreground">{CALC_METHOD_LABELS[list[0].calcMethod]}</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Khối</TableHead>
                      <TableHead className="text-right">Mức thu</TableHead>
                      <TableHead>Hiệu lực</TableHead>
                      {canManage && <TableHead className="w-14" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          {s.ageGroupName ?? "Mọi khối"}
                          {s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(s.amount)}</TableCell>
                        <TableCell>{formatDate(s.effectiveFrom)}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Xóa mức thu" onClick={() => setRemoving(s)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FormSheet
        open={adding}
        onOpenChange={setAdding}
        title="Thêm mức thu"
        description={`Năm học ${year.name}. Mức mới áp dụng từ ngày hiệu lực; mức cũ giữ cho các tháng trước.`}
        form={form}
        onSubmit={async (v) => {
          await createFeeSchedule({
            schoolYearId: year.id,
            feeTypeId: v.feeTypeId,
            ageGroupId: v.ageGroupId === ALL ? undefined : v.ageGroupId,
            amount: parseMoney(v.amount),
            effectiveFrom: v.effectiveFrom,
            note: v.note || undefined,
          });
          await queryClient.invalidateQueries({ queryKey: ["finance"] });
        }}
      >
        <SelectField
          form={form}
          name="feeTypeId"
          label="Khoản thu"
          required
          options={(feeTypes.data ?? []).filter((f) => f.active).map((f) => ({ value: f.id, label: f.name }))}
        />
        <SelectField
          form={form}
          name="ageGroupId"
          label="Khối"
          options={[{ value: ALL, label: "Mọi khối" }, ...(ageGroups.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
        />
        <TextField form={form} name="amount" label="Mức thu (₫)" inputMode="numeric" required description="Khoản theo ngày: giá một ngày." />
        <TextField form={form} name="effectiveFrom" label="Hiệu lực từ" type="date" required />
        <TextField form={form} name="note" label="Ghi chú" />
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa mức thu?"
        description="Phiếu đã phát hành không thay đổi; phiếu nháp được tính lại khi sinh phiếu."
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteFeeSchedule(removing!.id);
          toast.success("Đã xóa mức thu.");
          await queryClient.invalidateQueries({ queryKey: ["finance"] });
        }}
      />
    </div>
  );
}

function ConfigsTab({ canManage, canCatalog }: { canManage: boolean; canCatalog: boolean }) {
  const queryClient = useQueryClient();
  const query = useFinanceConfigs();
  const [adding, setAdding] = useState(false);
  const form = useForm<ConfigForm>({ resolver: zodResolver(configSchema) });
  const latest = query.data?.[0];

  const open = () => {
    form.reset({
      effectiveFrom: new Date().toLocaleDateString("sv-SE"),
      dueDay: String(latest?.dueDay ?? 10),
      mealRefundRule: latest?.mealRefundRule ?? "BEFORE_CUTOFF",
      proration: latest?.proration ?? "FULL_MONTH",
      organizationWide: !canManage,
    });
    setAdding(true);
  };

  if (query.isLoading) return <TableSkeleton rows={3} columns={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-3">
      {(canManage || canCatalog) && (
        <Button className="min-h-11" onClick={open}>
          <Plus className="w-4 h-4 mr-2" /> Thêm quy tắc mới
        </Button>
      )}
      {(query.data ?? []).length === 0 ? (
        <EmptyState icon={Receipt} title="Chưa có quy tắc thu" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hiệu lực từ</TableHead>
                  <TableHead>Phạm vi</TableHead>
                  <TableHead>Hạn nộp</TableHead>
                  <TableHead>Hoàn tiền ăn</TableHead>
                  <TableHead>Nhập/nghỉ giữa tháng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data!.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.effectiveFrom)}</TableCell>
                    <TableCell>{c.schoolId ? "Cơ sở" : "Cả tổ chức"}</TableCell>
                    <TableCell>Ngày {c.dueDay}</TableCell>
                    <TableCell>{MEAL_REFUND_LABELS[c.mealRefundRule]}</TableCell>
                    <TableCell>{PRORATION_LABELS[c.proration]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <FormSheet
        open={adding}
        onOpenChange={setAdding}
        title="Thêm quy tắc thu"
        description="Không sửa đè quy tắc cũ: quy tắc mới áp dụng cho các tháng từ ngày hiệu lực."
        form={form}
        onSubmit={async (v) => {
          await createFinanceConfig({
            effectiveFrom: v.effectiveFrom!,
            dueDay: Number(v.dueDay),
            mealRefundRule: v.mealRefundRule!,
            proration: v.proration!,
            organizationWide: v.organizationWide,
          });
          await queryClient.invalidateQueries({ queryKey: ["finance"] });
        }}
      >
        <TextField form={form} name="effectiveFrom" label="Hiệu lực từ" type="date" required />
        <TextField form={form} name="dueDay" label="Hạn nộp (ngày trong tháng)" inputMode="numeric" required />
        <SelectField form={form} name="mealRefundRule" label="Hoàn tiền ăn" options={options(MEAL_REFUND_LABELS)} />
        <SelectField form={form} name="proration" label="Trẻ nhập/nghỉ giữa tháng" options={options(PRORATION_LABELS)} />
        {canCatalog && canManage && (
          <FormField
            control={form.control}
            name="organizationWide"
            render={({ field }) => (
              <FormItem className="flex min-h-11 items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <FormLabel className="font-normal">Áp dụng cả tổ chức (cơ sở không có quy tắc riêng)</FormLabel>
              </FormItem>
            )}
          />
        )}
      </FormSheet>
    </div>
  );
}

/** Biểu phí theo cơ sở và năm học, cùng quy tắc thu (hạn nộp, hoàn tiền ăn, nhập/nghỉ giữa tháng). */
export default function FeeSchedulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const years = useSchoolYears();
  const { isAllSchools } = useCurrentSchool();
  const access = useFinanceAccess();
  const canManage = access.canManage && !isAllSchools;
  const yearId = searchParams.get("year") ?? years.data?.find((y) => y.current)?.id ?? years.data?.[0]?.id;
  const year = years.data?.find((y) => y.id === yearId);
  const tab = searchParams.get("tab") === "quy-tac" ? "quy-tac" : "bieu-phi";
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Biểu phí"
        description="Mức thu từng khoản theo khối và năm học của cơ sở đang chọn."
        actions={
          tab === "bieu-phi" &&
          years.data && (
            <Select value={yearId} onValueChange={(v) => set("year", v)}>
              <SelectTrigger className="min-h-11 w-44" aria-label="Năm học">
                <SelectValue placeholder="Năm học" />
              </SelectTrigger>
              <SelectContent>
                {years.data.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    Năm học {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => set("tab", v)}>
        <TabsList className="mb-4">
          <TabsTrigger value="bieu-phi" className="min-h-9">
            Biểu phí
          </TabsTrigger>
          <TabsTrigger value="quy-tac" className="min-h-9">
            Quy tắc thu
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bieu-phi">
          {years.isLoading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : years.isError ? (
            <ErrorState error={years.error} onRetry={() => years.refetch()} />
          ) : year ? (
            <SchedulesTab year={year} canManage={canManage} />
          ) : (
            <EmptyState icon={Receipt} title="Chưa có năm học" />
          )}
        </TabsContent>
        <TabsContent value="quy-tac">
          <ConfigsTab canManage={canManage} canCatalog={access.canCatalog} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

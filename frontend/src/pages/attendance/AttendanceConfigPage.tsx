import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { addAttendanceConfig, addHolidays, deleteHoliday, useAttendanceConfig, useHolidays } from "@/api";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { commonHolidays } from "@/data/vietnameseHolidays";
import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate } from "@/lib/format";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import { WEEKDAY_SHORT } from "@/features/attendance/codes";

type ConfigDto = components["schemas"]["ConfigDto"];
type HolidayDto = components["schemas"]["HolidayDto"];

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const hhmm = (v: string) => v.slice(0, 5);
const time = z.string().regex(/^\d{2}:\d{2}$/, "Giờ dạng HH:mm");
const number = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max, `Nhập số từ ${min} đến ${max}`);

const configSchema = z
  .object({
    effectiveFrom: z.string().min(1, "Vui lòng chọn ngày hiệu lực"),
    shiftStart: time,
    shiftEnd: time,
    lunchStart: time,
    lunchEnd: time,
    graceMinutes: number(0, 240),
    maxLateAllowed: number(0, 31),
    annualLeaveDays: number(0, 60),
    workingWeekdays: z.array(z.number()).min(1, "Chọn ít nhất một ngày làm việc"),
    halfDayWeekdays: z.array(z.number()),
  })
  .refine((v) => v.shiftStart < v.shiftEnd, { path: ["shiftEnd"], message: "Giờ ra ca phải sau giờ vào ca" })
  .refine((v) => v.shiftStart < v.lunchStart && v.lunchStart < v.lunchEnd && v.lunchEnd < v.shiftEnd, {
    path: ["lunchEnd"],
    message: "Nghỉ trưa phải nằm trong ca",
  })
  .refine((v) => v.halfDayWeekdays.every((d) => v.workingWeekdays.includes(d)), {
    path: ["halfDayWeekdays"],
    message: "Ngày nửa buổi phải là ngày làm việc",
  });
type ConfigValues = z.infer<typeof configSchema>;

const toValues = (c?: ConfigDto | null): ConfigValues => ({
  effectiveFrom: "",
  shiftStart: c ? hhmm(c.shiftStart) : "07:30",
  shiftEnd: c ? hhmm(c.shiftEnd) : "17:00",
  lunchStart: c ? hhmm(c.lunchStart) : "11:30",
  lunchEnd: c ? hhmm(c.lunchEnd) : "13:00",
  graceMinutes: String(c?.graceMinutes ?? 15),
  maxLateAllowed: String(c?.maxLateAllowed ?? 3),
  annualLeaveDays: String(c?.annualLeaveDays ?? 12),
  workingWeekdays: c?.workingWeekdays ?? [1, 2, 3, 4, 5, 6],
  halfDayWeekdays: c?.halfDayWeekdays ?? [6],
});

function WeekdayField({ form, name, label }: { form: ReturnType<typeof useForm<ConfigValues>>; name: "workingWeekdays" | "halfDayWeekdays"; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm min-h-11">
                <Checkbox
                  checked={field.value.includes(d)}
                  onCheckedChange={(checked) =>
                    field.onChange(checked ? [...field.value, d].sort() : field.value.filter((x) => x !== d))
                  }
                  aria-label={`${label} ${WEEKDAY_SHORT[d]}`}
                />
                {WEEKDAY_SHORT[d]}
              </label>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ConfigSheet({ schoolId, base, open, onOpenChange }: { schoolId: string | null; base?: ConfigDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<ConfigValues>({ resolver: zodResolver(configSchema), defaultValues: toValues(base) });
  useEffect(() => {
    if (open) form.reset(toValues(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở
  }, [open]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cấu hình chấm công mới"
      description="Áp dụng từ ngày hiệu lực; cấu hình cũ giữ nguyên cho các tháng trước."
      form={form}
      successMessage="Đã lưu cấu hình."
      onSubmit={async (v) => {
        await addAttendanceConfig({
          schoolId: schoolId ?? undefined,
          effectiveFrom: v.effectiveFrom,
          shiftStart: v.shiftStart,
          shiftEnd: v.shiftEnd,
          lunchStart: v.lunchStart,
          lunchEnd: v.lunchEnd,
          graceMinutes: Number(v.graceMinutes),
          maxLateAllowed: Number(v.maxLateAllowed),
          annualLeaveDays: Number(v.annualLeaveDays),
          workingWeekdays: v.workingWeekdays,
          halfDayWeekdays: v.halfDayWeekdays,
        });
        await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      }}
    >
      <TextField form={form} name="effectiveFrom" label="Hiệu lực từ ngày" type="date" required />
      <div className="grid grid-cols-2 gap-4">
        <TextField form={form} name="shiftStart" label="Giờ vào ca" type="time" required />
        <TextField form={form} name="shiftEnd" label="Giờ ra ca" type="time" required />
        <TextField form={form} name="lunchStart" label="Nghỉ trưa từ" type="time" required />
        <TextField form={form} name="lunchEnd" label="Nghỉ trưa đến" type="time" required />
        <TextField form={form} name="graceMinutes" label="Phút ân hạn" inputMode="numeric" required description="Muộn trong số phút này là muộn nhẹ." />
        <TextField form={form} name="maxLateAllowed" label="Số lần muộn nhẹ cho phép/tháng" inputMode="numeric" required />
        <TextField form={form} name="annualLeaveDays" label="Ngày phép năm" inputMode="decimal" required />
      </div>
      <WeekdayField form={form} name="workingWeekdays" label="Ngày làm việc" />
      <WeekdayField form={form} name="halfDayWeekdays" label="Ngày làm nửa buổi" />
    </FormSheet>
  );
}

const weekdays = (list: number[]) => list.map((d) => WEEKDAY_SHORT[d]).join(", ") || "—";

function ConfigSection({ schoolId, scopeLabel }: { schoolId: string | null; scopeLabel: string }) {
  const { queryKey } = useCurrentSchool();
  const [adding, setAdding] = useState(false);
  const overview = useAttendanceConfig(schoolId);
  if (overview.isLoading) return <TableSkeleton rows={3} columns={4} />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const data = overview.data!;
  const current = data.effective;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Đang áp dụng – {scopeLabel}</CardTitle>
          {data.canManage && (
            <Button className="min-h-11" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-2" /> Cấu hình mới
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!current ? (
            <EmptyState title="Chưa có cấu hình" description={data.canManage ? "Bấm “Cấu hình mới” để tạo." : "Liên hệ văn phòng điều hành."} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm" data-testid="effective-config">
              <div><dt className="text-muted-foreground">Ca làm việc</dt><dd>{hhmm(current.shiftStart)} – {hhmm(current.shiftEnd)}</dd></div>
              <div><dt className="text-muted-foreground">Nghỉ trưa</dt><dd>{hhmm(current.lunchStart)} – {hhmm(current.lunchEnd)}</dd></div>
              <div><dt className="text-muted-foreground">Ân hạn / muộn nhẹ cho phép</dt><dd>{current.graceMinutes} phút / {current.maxLateAllowed} lần</dd></div>
              <div><dt className="text-muted-foreground">Phép năm</dt><dd>{current.annualLeaveDays} ngày</dd></div>
              <div><dt className="text-muted-foreground">Ngày làm việc</dt><dd>{weekdays(current.workingWeekdays)}</dd></div>
              <div><dt className="text-muted-foreground">Nửa buổi</dt><dd>{weekdays(current.halfDayWeekdays)}</dd></div>
              <div>
                <dt className="text-muted-foreground">Nguồn</dt>
                <dd>{current.schoolId ? "Riêng cơ sở" : "Mặc định toàn chuỗi"} · từ {formatDate(current.effectiveFrom)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
      {data.versions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Các bản cấu hình</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hiệu lực từ</TableHead>
                  <TableHead>Phạm vi</TableHead>
                  <TableHead>Ca</TableHead>
                  <TableHead>Ân hạn</TableHead>
                  <TableHead>Ngày làm việc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(v.effectiveFrom)}{" "}
                      {current?.id === v.id && <StatusBadge status="CURRENT" labels={{ CURRENT: { label: "Đang áp dụng", tone: "success" } }} />}
                    </TableCell>
                    <TableCell>{v.schoolId ? "Riêng cơ sở" : "Toàn chuỗi"}</TableCell>
                    <TableCell>{hhmm(v.shiftStart)} – {hhmm(v.shiftEnd)}</TableCell>
                    <TableCell>{v.graceMinutes} phút / {v.maxLateAllowed} lần</TableCell>
                    <TableCell>{weekdays(v.workingWeekdays)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <ConfigSheet schoolId={schoolId} base={current} open={adding} onOpenChange={setAdding} />
    </div>
  );
}

// ---- ngày lễ

const CUSTOM = "custom";
const holidaySchema = z
  .object({
    preset: z.string().min(1, "Chọn ngày lễ"),
    customName: z.string().trim().max(200).default(""),
    fromDate: z.string().min(1, "Chọn ngày"),
    toDate: z.string().default(""),
    scope: z.string(),
  })
  .refine((v) => v.preset !== CUSTOM || v.customName !== "", { path: ["customName"], message: "Nhập tên ngày nghỉ" })
  .refine((v) => !v.toDate || v.toDate >= v.fromDate, { path: ["toDate"], message: "Đến ngày phải sau từ ngày" });
type HolidayValues = z.infer<typeof holidaySchema>;
const CHAIN = "chain";

function HolidaySection({ schoolId }: { schoolId: string | null }) {
  const queryClient = useQueryClient();
  const { queryKey } = useCurrentSchool();
  const { me } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<HolidayDto | null>(null);
  const holidays = useHolidays(year);
  const isChainAdmin = !!me?.roles.some((r) => r.role === "CHAIN_ADMIN" && !r.schoolId);
  // Chỉ để ẩn/hiện: chủ chuỗi, kế toán chỉ xem; backend kiểm tra lại
  const canManage = useCan("manage", "attendance");
  const canAddSchool = !!schoolId && canManage;
  const form = useForm<HolidayValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { preset: "", customName: "", fromDate: "", toDate: "", scope: schoolId ?? CHAIN },
  });
  useEffect(() => {
    if (adding) form.reset({ preset: "", customName: "", fromDate: "", toDate: "", scope: schoolId ?? CHAIN });
  }, [adding, form, schoolId]);
  const preset = form.watch("preset");
  const scopeOptions = [
    ...(isChainAdmin ? [{ value: CHAIN, label: "Toàn chuỗi" }] : []),
    ...(canAddSchool ? [{ value: schoolId!, label: "Riêng cơ sở đang chọn" }] : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3 flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Ngày lễ</CardTitle>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28 min-h-11" aria-label="Năm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[-1, 0, 1].map((d) => {
                const y = new Date().getFullYear() + d;
                return (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {scopeOptions.length > 0 && (
            <Button className="min-h-11" onClick={() => setAdding(true)}>
              <CalendarPlus className="w-4 h-4 mr-2" /> Thêm ngày lễ
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {holidays.isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : holidays.isError ? (
          <ErrorState error={holidays.error} onRetry={() => holidays.refetch()} />
        ) : !holidays.data?.length ? (
          <p className="text-sm text-muted-foreground">Chưa có ngày lễ năm {year}.</p>
        ) : (
          <ul className="divide-y" aria-label="Danh sách ngày lễ">
            {holidays.data.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <span className="w-28 text-sm tabular-nums">{formatDate(h.date)}</span>
                <span className="flex-1 min-w-0">
                  {h.name} <span className="text-xs text-muted-foreground">· {h.schoolName ?? "Toàn chuỗi"}</span>
                </span>
                {h.canManage && (
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setDeleting(h)} aria-label={`Xóa ngày lễ ${formatDate(h.date)}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <FormSheet
        open={adding}
        onOpenChange={setAdding}
        title="Thêm ngày lễ"
        form={form}
        successMessage="Đã thêm ngày lễ."
        onSubmit={async (v) => {
          const name = v.preset === CUSTOM ? v.customName : commonHolidays.find((h) => h.id === v.preset)?.name ?? v.preset;
          await addHolidays({
            schoolId: v.scope === CHAIN ? undefined : v.scope,
            fromDate: v.fromDate,
            toDate: v.toDate || undefined,
            name,
          });
          await queryClient.invalidateQueries({ queryKey: ["attendance"] });
        }}
      >
        <SelectField form={form} name="preset" label="Ngày lễ" required options={commonHolidays.map((h) => ({ value: h.id, label: h.name }))} />
        {preset === CUSTOM && <TextField form={form} name="customName" label="Tên ngày nghỉ" required />}
        <div className="grid grid-cols-2 gap-4">
          <TextField form={form} name="fromDate" label="Từ ngày" type="date" required />
          <TextField form={form} name="toDate" label="Đến ngày" type="date" description="Bỏ trống nếu một ngày." />
        </div>
        <SelectField form={form} name="scope" label="Áp dụng" required options={scopeOptions} />
      </FormSheet>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa ngày lễ?"
        description={deleting ? `${deleting.name} – ${formatDate(deleting.date)}` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteHoliday(deleting!.id);
          await queryClient.invalidateQueries({ queryKey: ["attendance"] });
        }}
      />
    </Card>
  );
}

/** Cấu hình chấm công theo cơ sở (bản mới theo ngày hiệu lực) và danh sách ngày lễ. */
export default function AttendanceConfigPage() {
  const { schoolId, school } = useCurrentSchool();
  const scopeLabel = schoolId ? school?.name ?? "Cơ sở" : "Mặc định toàn chuỗi";
  return (
    <div>
      <PageHeader
        title="Cấu hình chấm công"
        description={schoolId ? `Cấu hình của ${scopeLabel}; không có thì dùng mặc định toàn chuỗi.` : "Đang xem cấu hình mặc định toàn chuỗi (chọn một cơ sở để cấu hình riêng)."}
        breadcrumbs={[{ label: "Chấm công", to: "/cham-cong" }, { label: "Cấu hình" }]}
      />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Giờ làm việc</TabsTrigger>
          <TabsTrigger value="holidays">Ngày lễ</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
          <ConfigSection schoolId={schoolId} scopeLabel={scopeLabel} />
        </TabsContent>
        <TabsContent value="holidays" className="mt-4">
          <HolidaySection schoolId={schoolId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

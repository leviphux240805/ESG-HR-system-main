import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Ruler } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GrowthStatuses } from "@/features/health/GrowthStatuses";
import { todayIso } from "@/features/health/week";
import {
  type MeasurementRow,
  type MeasurementSource,
  SOURCE_LABELS,
  applyApiErrors,
  needsAttention,
  saveClassMeasurements,
  useClasses,
  useClassMeasurements,
} from "@/api";

const decimal = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === "") return true;
      const n = Number(v.replace(",", "."));
      return !Number.isNaN(n) && n >= min && n <= max;
    }, `${label} từ ${min} đến ${max}`);

const schema = z.object({
  source: z.enum(["CLASS", "CHECKUP", "PARENT"]),
  rows: z
    .array(z.object({ childId: z.string(), weightKg: decimal("Cân nặng (kg)", 1, 99), heightCm: decimal("Chiều cao (cm)", 40, 199), note: z.string().max(300) }))
    .refine((rows) => rows.every((r) => (r.weightKg === "") === (r.heightCm === "")), "Nhập đủ cả cân nặng và chiều cao cho mỗi trẻ"),
});
type SheetForm = z.infer<typeof schema>;

const num = (v: string) => Number(v.replace(",", "."));
const str = (v: number | undefined) => (v == null ? "" : String(v));

function Previous({ row }: { row: MeasurementRow }) {
  const p = row.previous;
  return p ? (
    <span className="text-xs text-muted-foreground">
      Lần trước {formatDate(p.measuredOn)}: {p.weightKg} kg · {p.heightCm} cm
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Chưa cân đo lần nào</span>
  );
}

/** Nhập cân đo cả lớp; backend xếp kênh cân nặng/tuổi, chiều cao/tuổi, BMI/tuổi theo chuẩn WHO. */
export default function GrowthPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const classes = useClasses();
  const classId = searchParams.get("lop") ?? classes.data?.[0]?.id;
  const date = searchParams.get("ngay") ?? todayIso();
  const query = useClassMeasurements(classId, date);
  const form = useForm<SheetForm>({ resolver: zodResolver(schema), defaultValues: { source: "CLASS", rows: [] } });
  const { fields } = useFieldArray({ control: form.control, name: "rows" });
  const sheet = query.data;
  const rowsById = useMemo(() => new Map((sheet?.rows ?? []).map((r) => [r.childId, r])), [sheet]);

  useEffect(() => {
    if (!sheet) return;
    form.reset({
      source: sheet.rows.find((r) => r.current)?.current?.source ?? form.getValues("source") ?? "CLASS",
      rows: sheet.rows.map((r) => ({ childId: r.childId, weightKg: str(r.current?.weightKg), heightCm: str(r.current?.heightCm), note: r.current?.note ?? "" })),
    });
  }, [sheet, form]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const submit = form.handleSubmit(async (v) => {
    const rows = v.rows.filter((r) => r.weightKg !== "").map((r) => ({ childId: r.childId, weightKg: num(r.weightKg), heightCm: num(r.heightCm), note: r.note || undefined }));
    if (rows.length === 0) {
      toast.error("Chưa nhập số liệu của trẻ nào.");
      return;
    }
    try {
      await saveClassMeasurements(classId!, { date, source: v.source, rows });
      toast.success(`Đã lưu cân đo ${rows.length} trẻ.`);
      await queryClient.invalidateQueries({ queryKey: ["health"] });
    } catch (error) {
      applyApiErrors(error, form);
    }
  });

  const attention = (sheet?.rows ?? []).filter((r) => r.current && needsAttention(r.current)).length;
  const measured = (sheet?.rows ?? []).filter((r) => r.current).length;
  const canEdit = !!sheet?.canEdit;
  const rootError = form.formState.errors.rows?.root?.message ?? form.formState.errors.rows?.message;

  return (
    <div className="space-y-4">
      <PageHeader title="Cân đo" description="Nhập cân nặng, chiều cao cả lớp; hệ thống xếp kênh theo chuẩn tăng trưởng WHO." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="growth-class">Lớp</Label>
          <Select value={classId ?? ""} onValueChange={(v) => setParam("lop", v)}>
            <SelectTrigger id="growth-class" className="min-h-11 w-[12rem]">
              <SelectValue placeholder="Chọn lớp" />
            </SelectTrigger>
            <SelectContent>
              {(classes.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="growth-date">Ngày cân đo</Label>
          <Input id="growth-date" type="date" className="min-h-11 w-[10.5rem]" value={date} max={todayIso()} onChange={(e) => e.target.value && setParam("ngay", e.target.value)} />
        </div>
        {canEdit && (
          <div className="space-y-1">
            <Label htmlFor="growth-source">Nguồn số liệu</Label>
            <Select value={form.watch("source")} onValueChange={(v) => form.setValue("source", v as MeasurementSource, { shouldDirty: true })}>
              <SelectTrigger id="growth-source" className="min-h-11 w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {classes.isError ? (
        <ErrorState error={classes.error} onRetry={() => classes.refetch()} />
      ) : !classId && !classes.isLoading ? (
        <EmptyState icon={Ruler} title="Chưa có lớp" description="Bạn chưa được phân công lớp nào." />
      ) : query.isLoading || classes.isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : sheet!.rows.length === 0 ? (
        <EmptyState icon={Ruler} title="Lớp chưa có trẻ" description="Không có trẻ nào trong lớp vào ngày này." />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Đã cân đo {measured}/{sheet!.rows.length} trẻ{attention > 0 && <span className="text-amber-700"> · {attention} trẻ cần theo dõi</span>}
          </p>
          <Card>
            <CardContent className="divide-y p-0">
              {fields.map((f, index) => {
                const row = rowsById.get(f.childId)!;
                const err = form.formState.errors.rows?.[index];
                return (
                  <div key={f.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(10rem,1fr)_7rem_7rem_minmax(10rem,1fr)] sm:items-center">
                    <div className="min-w-0">
                      <Link to={`/tre/${row.childId}?tab=suc-khoe`} className="font-medium hover:text-primary hover:underline">
                        {row.fullName}
                      </Link>
                      <div>
                        <Previous row={row} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      <div>
                        <Label htmlFor={`w-${index}`} className="text-xs text-muted-foreground sm:sr-only">
                          Cân nặng (kg)
                        </Label>
                        <Input
                          id={`w-${index}`}
                          inputMode="decimal"
                          placeholder="kg"
                          disabled={!canEdit}
                          className={cn("min-h-11", err?.weightKg && "border-destructive")}
                          aria-label={`Cân nặng của ${row.fullName}`}
                          {...form.register(`rows.${index}.weightKg`)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`h-${index}`} className="text-xs text-muted-foreground sm:sr-only">
                          Chiều cao (cm)
                        </Label>
                        <Input
                          id={`h-${index}`}
                          inputMode="decimal"
                          placeholder="cm"
                          disabled={!canEdit}
                          className={cn("min-h-11", err?.heightCm && "border-destructive")}
                          aria-label={`Chiều cao của ${row.fullName}`}
                          {...form.register(`rows.${index}.heightCm`)}
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      {row.current ? <GrowthStatuses m={row.current} /> : <span className="text-xs text-muted-foreground">Chưa cân đo ngày này</span>}
                      {(err?.weightKg || err?.heightCm) && <p className="text-xs text-destructive">{err.weightKg?.message ?? err.heightCm?.message}</p>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          {rootError && <p className="text-sm text-destructive">{rootError}</p>}
          {canEdit && (
            <div className="sticky bottom-16 flex justify-end md:bottom-4">
              <Button type="submit" className="min-h-11 shadow" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Lưu cân đo
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

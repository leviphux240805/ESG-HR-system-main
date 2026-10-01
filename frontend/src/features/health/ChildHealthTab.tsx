import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Paperclip, Plus, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FileUpload } from "@/components/common/FileUpload";
import { FormSheet } from "@/components/common/FormSheet";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { openDownload } from "@/lib/filePreview";
import { formatDate } from "@/lib/format";
import { TextAreaField, TextField } from "@/features/staff/profile/fields";
import { GrowthStatuses } from "./GrowthStatuses";
import { todayIso } from "./week";
import {
  type Checkup,
  type ChildHealth,
  type CurvePoint,
  HEALTH_LOG_TYPE,
  SOURCE_LABELS,
  STANDARD_LABELS,
  type StoredFile,
  addCheckup,
  checkupFileUrl,
  deleteCheckup,
  useChildHealth,
} from "@/api";

type Kind = "weight" | "height" | "bmi";

const KINDS: Record<Kind, { label: string; unit: string; curve: keyof ChildHealth["growth"]; value: (m: ChildHealth["growth"]["measurements"][number]) => number }> = {
  weight: { label: "Cân nặng/tuổi", unit: "kg", curve: "weightCurve", value: (m) => m.weightKg },
  height: { label: "Chiều cao/tuổi", unit: "cm", curve: "heightCurve", value: (m) => m.heightCm },
  bmi: { label: "BMI/tuổi", unit: "kg/m²", curve: "bmiCurve", value: (m) => m.bmi },
};

const checkupSchema = z.object({
  checkupDate: z.string().min(1, "Vui lòng chọn ngày khám").refine((v) => v <= todayIso(), "Ngày khám không được ở tương lai"),
  provider: z.string().trim().max(200, "Nơi khám tối đa 200 ký tự"),
  summary: z.string().trim().min(1, "Vui lòng nhập kết luận").max(2000, "Kết luận tối đa 2000 ký tự"),
  file: z.custom<StoredFile | null>().nullable(),
});
type CheckupForm = z.infer<typeof checkupSchema>;

function GrowthChart({ data }: { data: ChildHealth["growth"] }) {
  const [kind, setKind] = useState<Kind>("weight");
  const meta = KINDS[kind];
  const rows = useMemo(() => {
    const ages = data.measurements.map((m) => m.ageMonths);
    const from = Math.max(0, Math.floor(Math.min(...ages, 24)) - 6);
    const to = Math.ceil(Math.max(...ages, from + 12)) + 6;
    const curve = (data[meta.curve] as CurvePoint[]).filter((p) => p.ageMonths >= from && p.ageMonths <= to);
    const points: Record<string, number>[] = curve.map((p) => ({ age: p.ageMonths, sd3neg: p.sd3neg, sd2neg: p.sd2neg, median: p.median, sd2: p.sd2, sd3: p.sd3 }));
    for (const m of data.measurements) points.push({ age: m.ageMonths, child: meta.value(m) });
    return points.sort((a, b) => a.age - b.age);
  }, [data, meta]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Biểu đồ tăng trưởng</CardTitle>
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList>
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <TabsTrigger key={k} value={k} className="min-h-9">
                {KINDS[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="h-80 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} fontSize={12} tickCount={8} label={{ value: "tháng tuổi", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} fontSize={12} width={40} />
            <Tooltip formatter={(value: number, name: string) => [`${value} ${meta.unit}`, name]} labelFormatter={(age: number) => `${Math.round(age * 10) / 10} tháng tuổi`} />
            <Legend />
            <Line type="monotone" dataKey="sd3" name="+3 SD" stroke="hsl(0 70% 55%)" strokeDasharray="2 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="sd2" name="+2 SD" stroke="hsl(35 90% 55%)" strokeDasharray="5 4" dot={false} connectNulls />
            <Line type="monotone" dataKey="median" name="Trung vị WHO" stroke="hsl(145 55% 40%)" dot={false} connectNulls />
            <Line type="monotone" dataKey="sd2neg" name="−2 SD" stroke="hsl(35 90% 55%)" strokeDasharray="5 4" dot={false} connectNulls />
            <Line type="monotone" dataKey="sd3neg" name="−3 SD" stroke="hsl(0 70% 55%)" strokeDasharray="2 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="child" name="Của trẻ" stroke="hsl(var(--primary))" strokeWidth={3} connectNulls dot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Tab "Sức khỏe" trong hồ sơ trẻ: biểu đồ tăng trưởng WHO, các lần cân đo, khám định kỳ, sổ theo dõi gần đây. */
export function ChildHealthTab({ childId }: { childId: string }) {
  const queryClient = useQueryClient();
  const query = useChildHealth(childId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Checkup | null>(null);
  const form = useForm<CheckupForm>({ resolver: zodResolver(checkupSchema) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["health"] });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data!;
  const { growth } = data;
  const measurements = [...growth.measurements].reverse();

  return (
    <div className="space-y-4">
      {(data.allergyNote || data.healthNote) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="space-y-1 p-4 text-sm text-amber-900">
            {data.allergyNote && (
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Dị ứng: {data.allergyNote}
              </p>
            )}
            {data.healthNote && <p>Lưu ý sức khỏe: {data.healthNote}</p>}
          </CardContent>
        </Card>
      )}

      {growth.measurements.length === 0 ? (
        <EmptyState
          title="Chưa có số liệu cân đo"
          description="Nhập cân nặng, chiều cao ở trang Cân đo để xem biểu đồ tăng trưởng."
          action={
            growth.canEdit && (
              <Button asChild className="min-h-11">
                <Link to="/suc-khoe/can-do">Đến trang Cân đo</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <GrowthChart data={growth} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Các lần cân đo</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead className="text-right">Cân nặng</TableHead>
                    <TableHead className="text-right">Chiều cao</TableHead>
                    <TableHead className="text-right">BMI</TableHead>
                    <TableHead>Đánh giá</TableHead>
                    <TableHead>Nguồn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {measurements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(m.measuredOn)}
                        <span className="block text-xs text-muted-foreground">{Math.floor(m.ageMonths)} tháng tuổi</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.weightKg} kg
                        {m.weightZ != null && <span className="block text-xs text-muted-foreground">z {m.weightZ}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.heightCm} cm
                        {m.heightZ != null && <span className="block text-xs text-muted-foreground">z {m.heightZ}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.bmi}
                        {m.bmiZ != null && <span className="block text-xs text-muted-foreground">z {m.bmiZ}</span>}
                      </TableCell>
                      <TableCell>
                        <GrowthStatuses m={m} />
                        {m.standard && <span className="text-xs text-muted-foreground">{STANDARD_LABELS[m.standard]}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {SOURCE_LABELS[m.source]}
                        {m.recordedByName && <span className="block text-xs text-muted-foreground">{m.recordedByName}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Khám sức khỏe định kỳ</CardTitle>
          {data.canEditCheckups && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                form.reset({ checkupDate: todayIso(), provider: "", summary: "", file: null });
                setAdding(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Thêm kết quả
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.checkups.length === 0 && <p className="text-muted-foreground">Chưa có kết quả khám.</p>}
          {data.checkups.map((c) => (
            <div key={c.id} className="flex items-start gap-2 border-b pb-3 last:border-0 last:pb-0">
              <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {formatDate(c.checkupDate)}
                  {c.provider && <span className="font-normal text-muted-foreground"> · {c.provider}</span>}
                </p>
                <p className="whitespace-pre-line">{c.summary}</p>
              </div>
              {c.fileId && (
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Xem biên bản" onClick={() => openDownload(() => checkupFileUrl(c.id))}>
                  <Paperclip className="w-4 h-4" />
                </Button>
              )}
              {data.canEditCheckups && (
                <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Xóa" onClick={() => setRemoving(c)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Sổ theo dõi gần đây</CardTitle>
          <Button asChild variant="link" className="min-h-11">
            <Link to={`/suc-khoe/so-theo-doi?q=${encodeURIComponent(growth.fullName)}`}>Xem sổ theo dõi</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.recentLogs.length === 0 && <p className="text-muted-foreground">Chưa có ghi chép.</p>}
          {data.recentLogs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{formatDate(l.logDate)}</span>
              <StatusBadge status={l.type} labels={HEALTH_LOG_TYPE} />
              <span className="min-w-0 flex-1">
                {l.temperatureC != null && <b className="text-destructive">{l.temperatureC} °C · </b>}
                {l.content}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <FormSheet
        open={adding}
        onOpenChange={setAdding}
        title="Thêm kết quả khám"
        form={form}
        onSubmit={async (v) => {
          await addCheckup(childId, { checkupDate: v.checkupDate, provider: v.provider || undefined, summary: v.summary, fileId: v.file?.id });
          await refresh();
        }}
      >
        <TextField form={form} name="checkupDate" label="Ngày khám" type="date" required />
        <TextField form={form} name="provider" label="Nơi khám" />
        <TextAreaField form={form} name="summary" label="Kết luận" required rows={4} />
        <FormField
          control={form.control}
          name="file"
          render={({ field }) => (
            <FormItem>
              <FileUpload label="Biên bản khám (nếu có)" value={field.value ?? null} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa kết quả khám?"
        description={removing ? `${formatDate(removing.checkupDate)} · ${removing.summary}` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteCheckup(removing!.id);
          toast.success("Đã xóa kết quả khám.");
          await refresh();
        }}
      />
    </div>
  );
}

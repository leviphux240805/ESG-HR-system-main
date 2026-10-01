import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Baby, CalendarCheck, type LucideIcon, Receipt, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/common/ExportButton";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { useCan } from "@/hooks/useCan";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { MonthNav } from "@/features/finance/MonthNav";
import { useMonthParam } from "@/features/finance/useMonthParam";
import { type Dashboard, type ReportName, type SchoolMetrics, TASK_COLUMNS, exportReport, useDashboard } from "@/api";

// Bảng màu phân loại cố định (đã kiểm tra mù màu): xanh, cam; lưới và trục dùng màu nhạt
const SERIES = { blue: "#2a78d6", orange: "#eb6834" };
const GRID = "hsl(var(--border))";
const AXIS = { fontSize: 12, stroke: "hsl(var(--muted-foreground))" };
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

const NUTRITION_LABELS: Record<string, string> = {
  NORMAL: "Bình thường",
  UNDERWEIGHT: "Nhẹ cân",
  STUNTED: "Thấp còi",
  WASTED: "Gầy còm",
  OVERWEIGHT: "Thừa cân, béo phì",
};
const TASK_LABELS: Record<string, string> = { ...Object.fromEntries(TASK_COLUMNS.map((c) => [c.status, c.label])), CANCELLED: "Đã hủy" };

const shortMonth = (m: string) => formatMonth(m).replace("Tháng ", "T");
const millions = (v: number) => `${Math.round(v / 1_000_000)}tr`;
const shortDate = (d: string) => formatDate(d).slice(0, 5);
const value = (v: number | null | undefined, format: (n: number) => string = String) => (v == null ? "—" : format(v));

function Kpi({ icon: Icon, label, value: text, hint, tone }: { icon: LucideIcon; label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="w-4 h-4 text-primary" /> {label}
        </p>
        <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${tone ?? ""}`}>{text}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56 px-1 pb-4 sm:h-64 sm:px-2">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function Kpis({ d }: { d: Dashboard }) {
  const t = d.totals;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {d.showOperations && (
        <>
          <Kpi icon={Baby} label="Trẻ đang học" value={value(t.children)} hint={t.capacity ? `Sĩ số tối đa ${t.capacity}` : undefined} />
          <Kpi icon={CalendarCheck} label="Đi học hôm nay" value={value(t.attendanceRate, (n) => `${n}%`)} hint={`${value(t.presentToday)} có mặt · ${value(t.absentToday)} vắng`} />
          <Kpi icon={Users} label="Nhân sự đang làm" value={value(t.staff)} hint={t.overdueTasks ? `${t.overdueTasks} việc quá hạn` : "Không có việc quá hạn"} />
          <Kpi icon={AlertTriangle} label="Trẻ cần theo dõi tăng trưởng" value={value(t.growthAlerts)} hint="Theo lần cân đo gần nhất trong 6 tháng" tone={t.growthAlerts ? "text-amber-700" : undefined} />
        </>
      )}
      {d.showFinance && (
        <>
          <Kpi icon={Wallet} label="Công nợ học phí" value={value(t.receivable, formatMoney)} hint={t.overdueInvoices ? `${t.overdueInvoices} phiếu quá hạn` : undefined} tone={t.receivable ? "text-destructive" : undefined} />
          <Kpi icon={Receipt} label={`Thu ${formatMonth(d.month).toLowerCase()}`} value={value(t.income, formatMoney)} hint={`Chi ${value(t.expense, formatMoney)}`} />
        </>
      )}
    </div>
  );
}

function SchoolTable({ d }: { d: Dashboard }) {
  const cols: { key: string; label: string; show: boolean; render: (s: SchoolMetrics) => string }[] = [
    { key: "children", label: "Trẻ", show: d.showOperations, render: (s) => value(s.children) },
    { key: "rate", label: "Đi học", show: d.showOperations, render: (s) => value(s.attendanceRate, (n) => `${n}%`) },
    { key: "staff", label: "Nhân sự", show: d.showOperations, render: (s) => value(s.staff) },
    { key: "growth", label: "Cần theo dõi", show: d.showOperations, render: (s) => value(s.growthAlerts) },
    { key: "tasks", label: "Việc quá hạn", show: d.showOperations, render: (s) => value(s.overdueTasks) },
    { key: "receivable", label: "Công nợ", show: d.showFinance, render: (s) => value(s.receivable, formatMoney) },
    { key: "income", label: "Thu tháng", show: d.showFinance, render: (s) => value(s.income, formatMoney) },
    { key: "expense", label: "Chi tháng", show: d.showFinance, render: (s) => value(s.expense, formatMoney) },
  ].filter((c) => c.show);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">So sánh các cơ sở</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cơ sở</TableHead>
              {cols.map((c) => (
                <TableHead key={c.key} className="text-right">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...d.schools, d.totals].map((s) => (
              <TableRow key={s.schoolId ?? "total"} className={s.schoolId ? undefined : "bg-muted/50 font-medium"}>
                <TableCell className="whitespace-nowrap">{s.schoolName}</TableCell>
                {cols.map((c) => (
                  <TableCell key={c.key} className="whitespace-nowrap text-right tabular-nums">
                    {c.render(s)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Exports({ d }: { d: Dashboard }) {
  const [month, setMonth] = useMonthParam();
  const { isAllSchools } = useCurrentSchool();
  const canPayroll = useCan("view", "payroll");
  const canAttendance = useCan("view", "attendance");
  const items: { name: ReportName; label: string; show: boolean }[] = [
    { name: "staff-attendance", label: "Bảng công", show: canAttendance && d.showOperations && !isAllSchools },
    { name: "payroll", label: "Bảng lương", show: canPayroll },
    { name: "receivables", label: "Công nợ học phí", show: d.showFinance },
    { name: "children", label: "Danh sách trẻ", show: d.showOperations },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Xuất Excel</CardTitle>
        <MonthNav month={month} onChange={setMonth} />
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items
          .filter((i) => i.show)
          .map((i) => (
            <ExportButton key={i.name} label={i.label} request={() => exportReport(i.name, month)} fileName={`${i.name}-${month}.xlsx`} />
          ))}
        {isAllSchools && canAttendance && d.showOperations && <p className="w-full text-xs text-muted-foreground">Chọn một cơ sở để xuất bảng công.</p>}
      </CardContent>
    </Card>
  );
}

/** Dashboard chuỗi/cơ sở: sĩ số, đi học, nhân sự, tăng trưởng, công nợ, thu chi; so sánh cơ sở và xuất Excel. */
export default function ReportsPage() {
  const query = useDashboard();
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const d = query.data!;
  const scope = d.chainView ? `${d.schools.length} cơ sở` : (d.schools[0]?.schoolName ?? "");

  return (
    <div className="space-y-4">
      <PageHeader title="Báo cáo" description={`${scope} · số liệu ngày ${formatDate(d.date)}`} />
      <Kpis d={d} />
      {d.chainView && <SchoolTable d={d} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {d.showOperations && (
          <ChartCard title="Tỷ lệ đi học các ngày gần đây (%)">
            <LineChart data={d.attendanceTrend.map((p) => ({ ...p, label: shortDate(p.date) }))} margin={{ top: 5, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis domain={[0, 100]} {...AXIS} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Đi học"]} />
              <Line type="monotone" dataKey="rate" stroke={SERIES.blue} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartCard>
        )}
        {d.showFinance && (
          <ChartCard title="Thu chi 6 tháng">
            <BarChart data={d.cashTrend.map((m) => ({ ...m, label: shortMonth(m.month) }))} margin={{ top: 5, right: 12, bottom: 0, left: -4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis tickFormatter={millions} {...AXIS} />
              <Tooltip formatter={(v: number, name: string) => [formatMoney(v), name]} />
              <Legend />
              <Bar dataKey="income" name="Thu" fill={SERIES.blue} radius={BAR_RADIUS} />
              <Bar dataKey="expense" name="Chi" fill={SERIES.orange} radius={BAR_RADIUS} />
            </BarChart>
          </ChartCard>
        )}
        {d.showOperations && (
          <ChartCard title="Tình trạng dinh dưỡng (lần cân gần nhất)">
            <BarChart data={d.nutrition.map((n) => ({ ...n, label: NUTRITION_LABELS[n.status] ?? n.status }))} layout="vertical" margin={{ top: 5, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="label" width={110} {...AXIS} />
              <Tooltip formatter={(v: number) => [`${v} trẻ`, "Số trẻ"]} />
              <Bar dataKey="count" fill={SERIES.blue} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>
        )}
        {d.showOperations && (
          <ChartCard title="Công việc theo trạng thái">
            <BarChart data={d.tasks.map((t) => ({ ...t, label: TASK_LABELS[t.status] ?? t.status }))} margin={{ top: 5, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip formatter={(v: number) => [`${v} việc`, "Số việc"]} />
              <Bar dataKey="count" fill={SERIES.orange} radius={BAR_RADIUS} />
            </BarChart>
          </ChartCard>
        )}
      </div>
      <Exports d={d} />
    </div>
  );
}

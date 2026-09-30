import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Baby, CalendarCheck, type LucideIcon, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { AGE_GROUP_LABELS } from "@/api";
import { TASK_COLUMNS } from "@/api";
import { useDashboard } from "@/api";

// Bảng màu phân loại cố định (đã kiểm tra mù màu): xanh, cam; lưới và trục dùng màu nhạt
const SERIES = { blue: "#2a78d6", orange: "#eb6834" };
const GRID = "hsl(var(--border))";
const AXIS = { fontSize: 12, stroke: "hsl(var(--muted-foreground))" };
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

// Nhãn trục ngắn cho màn hình hẹp; tên đầy đủ nằm trong tooltip
const AGE_SHORT = { NHA_TRE: "Nhà trẻ", MAM: "Bé", CHOI: "Nhỡ", LA: "Lớn" } as const;

const shortMonth = (m: string) => formatMonth(m).replace("Tháng ", "T");
const millions = (v: number) => `${Math.round(v / 1_000_000)}tr`;

function Kpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="w-4 h-4 text-primary" /> {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
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

/** Báo cáo tổng hợp của cơ sở: đi học, học phí, sĩ số, dinh dưỡng, nhân sự, công việc. */
export default function ReportsPage() {
  const { school } = useCurrentSchool();
  const query = useDashboard();
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const d = query.data!;
  const age = d.enrollmentByAge.map((x) => ({ label: AGE_SHORT[x.ageGroup], full: AGE_GROUP_LABELS[x.ageGroup], count: x.count }));
  const tasks = d.tasks.map((t) => ({ label: TASK_COLUMNS.find((c) => c.status === t.status)!.label, count: t.count }));

  return (
    <div className="space-y-4">
      <PageHeader title="Báo cáo" description={`Số liệu 3 tháng gần nhất · ${school?.name ?? ""}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Baby} label="Trẻ đang học" value={String(d.kpis.children)} hint={`${d.attendanceByClass.length} lớp`} />
        <Kpi icon={Users} label="Nhân viên" value={String(d.kpis.staff)} hint="Đang làm việc" />
        <Kpi icon={CalendarCheck} label="Tỷ lệ đi học" value={`${d.kpis.attendanceRate.toLocaleString("vi-VN")}%`} hint="Trung bình 30 ngày" />
        <Kpi icon={Wallet} label="Đã thu học phí" value={`${d.kpis.collectionRate.toLocaleString("vi-VN")}%`} hint="Tháng này" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Tỷ lệ trẻ đi học theo ngày (%)" className="xl:col-span-2">
          <LineChart data={d.attendanceByDay} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(v) => formatDate(v).slice(0, 5)} minTickGap={24} {...AXIS} />
            <YAxis domain={[80, 100]} width={36} {...AXIS} />
            <Tooltip labelFormatter={(v) => formatDate(v as string)} formatter={(v: number) => [`${v}%`, "Có mặt"]} />
            <Line type="monotone" dataKey="rate" stroke={SERIES.blue} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Học phí theo tháng">
          <BarChart data={d.feesByMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={shortMonth} {...AXIS} />
            <YAxis tickFormatter={millions} width={44} {...AXIS} />
            <Tooltip labelFormatter={(v) => formatMonth(v as string)} formatter={(v: number, name: string) => [formatMoney(v), name]} />
            <Legend formatter={(value) => <span className="text-foreground">{value}</span>} />
            <Bar dataKey="collected" name="Đã thu" stackId="fee" fill={SERIES.blue} stroke="hsl(var(--card))" strokeWidth={2} />
            <Bar dataKey="outstanding" name="Còn phải thu" stackId="fee" fill={SERIES.orange} stroke="hsl(var(--card))" strokeWidth={2} radius={BAR_RADIUS} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Tỷ lệ đi học theo lớp, 30 ngày (%)">
          <BarChart data={d.attendanceByClass} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="className" tickFormatter={(v: string) => v.split(" – ")[1] ?? v} interval={0} {...AXIS} />
            <YAxis domain={[80, 100]} width={36} {...AXIS} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Có mặt"]} />
            <Bar dataKey="rate" fill={SERIES.blue} radius={BAR_RADIUS} maxBarSize={40} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Sĩ số theo độ tuổi">
          <BarChart data={age} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" interval={0} {...AXIS} />
            <YAxis allowDecimals={false} width={32} {...AXIS} />
            <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""} formatter={(v: number) => [`${v} trẻ`, "Sĩ số"]} />
            <Bar dataKey="count" fill={SERIES.blue} radius={BAR_RADIUS} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Tình trạng dinh dưỡng (lần cân gần nhất)">
          <BarChart data={d.nutrition} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...AXIS} />
            <YAxis type="category" dataKey="label" width={110} {...AXIS} />
            <Tooltip formatter={(v: number) => [`${v} trẻ`, "Số trẻ"]} />
            <Bar dataKey="count" fill={SERIES.blue} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Ngày nghỉ phép của nhân viên">
          <BarChart data={d.staffLeaveByMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={shortMonth} {...AXIS} />
            <YAxis allowDecimals={false} width={32} {...AXIS} />
            <Tooltip labelFormatter={(v) => formatMonth(v as string)} formatter={(v: number) => [`${v} ngày`, "Nghỉ"]} />
            <Bar dataKey="days" fill={SERIES.blue} radius={BAR_RADIUS} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Công việc theo trạng thái">
          <BarChart data={tasks} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" interval={0} {...AXIS} />
            <YAxis allowDecimals={false} width={32} {...AXIS} />
            <Tooltip formatter={(v: number) => [`${v} việc`, "Số việc"]} />
            <Bar dataKey="count" fill={SERIES.blue} radius={BAR_RADIUS} maxBarSize={48} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

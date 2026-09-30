import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { type GrowthChart, useGrowthChart } from "@/features/health/api";

type Kind = "weight" | "height";

function Chart({ data, kind }: { data: GrowthChart; kind: Kind }) {
  const ref = kind === "weight" ? data.weightRef : data.heightRef;
  const unit = kind === "weight" ? "kg" : "cm";
  // Gộp đường tham chiếu và số đo của trẻ theo tháng tuổi
  const rows = useMemo(() => {
    const byAge = new Map<number, Record<string, number>>(ref.map((r) => [r.ageMonths, { age: r.ageMonths, low: r.low, median: r.median, high: r.high }]));
    for (const m of data.measurements) {
      const row = byAge.get(m.ageMonths) ?? { age: m.ageMonths };
      row.child = kind === "weight" ? m.weightKg : m.heightCm;
      byAge.set(m.ageMonths, row);
    }
    return [...byAge.values()].sort((a, b) => a.age - b.age);
  }, [data, ref, kind]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{kind === "weight" ? "Cân nặng theo tuổi" : "Chiều cao theo tuổi"}</CardTitle>
      </CardHeader>
      <CardContent className="h-72 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="age" fontSize={12} label={{ value: "tháng tuổi", position: "insideBottomRight", offset: -2, fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} fontSize={12} width={40} unit="" />
            <Tooltip
              formatter={(value: number, name: string) => [`${value} ${unit}`, name]}
              labelFormatter={(age) => `${age} tháng tuổi`}
            />
            <Legend />
            <Line type="monotone" dataKey="high" name="+2SD" stroke="hsl(35 90% 55%)" strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="median" name="Trung vị WHO" stroke="hsl(145 55% 40%)" dot={false} />
            <Line type="monotone" dataKey="low" name="-2SD" stroke="hsl(0 70% 55%)" strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="child" name="Của bé" stroke="hsl(var(--primary))" strokeWidth={3} connectNulls dot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Biểu đồ tăng trưởng một trẻ so với chuẩn WHO. */
export default function GrowthChartPage() {
  const { childId = "" } = useParams();
  const query = useGrowthChart(childId);
  const data = query.data;
  const breadcrumbs = [{ label: "Cân đo", to: "/can-do" }, { label: data?.child.fullName ?? "Biểu đồ" }];

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <PageHeader title={`Biểu đồ tăng trưởng – ${data!.child.fullName}`} description={`${data!.child.className} · sinh ngày ${formatDate(data!.child.dob)}`} breadcrumbs={breadcrumbs} />
      <div className="flex flex-wrap gap-2">
        {data!.status.map((s) => (
          <Badge key={s} variant={s === "Bình thường" ? "secondary" : "destructive"}>
            {s}
          </Badge>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Chart data={data!} kind="weight" />
        <Chart data={data!} kind="height" />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Các lần cân đo</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-normal">Ngày</th>
                <th className="py-1 font-normal">Tháng tuổi</th>
                <th className="py-1 text-right font-normal">Chiều cao</th>
                <th className="py-1 text-right font-normal">Cân nặng</th>
              </tr>
            </thead>
            <tbody>
              {[...data!.measurements].reverse().map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2">{formatDate(m.date)}</td>
                  <td className="py-2">{m.ageMonths}</td>
                  <td className="py-2 text-right tabular-nums">{m.heightCm} cm</td>
                  <td className="py-2 text-right tabular-nums">{m.weightKg} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

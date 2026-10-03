import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ALLOWANCE_LABELS } from "@/features/staff/labels";
import { formatDays } from "@/features/attendance/codes";
import type { Payslip } from "@/api";

const LABELS: Record<string, string> = { ...ALLOWANCE_LABELS, seniority: "Thâm niên" };

type Line = { label: string; value: number; strong?: boolean; minus?: boolean };

/** Diễn giải phiếu lương: thu nhập, khấu trừ bảo hiểm, thuế TNCN, thực lĩnh. */
export function PayslipBreakdown({ payslip: p }: { payslip: Payslip }) {
  const lines: Line[] = [
    { label: `Lương theo công (${formatDays(p.workDays)}/${formatDays(p.standardWorkDays)} công)`, value: p.salaryByWork },
    ...Object.entries(p.allowances).map(([key, value]) => ({ label: `Phụ cấp ${(LABELS[key] ?? key).toLowerCase()}`, value })),
    ...(p.bonus ? [{ label: "Thưởng", value: p.bonus }] : []),
    ...(p.fines ? [{ label: "Phạt", value: p.fines, minus: true }] : []),
    { label: "Tổng thu nhập", value: p.grossSalary, strong: true },
    { label: "BHXH", value: p.socialInsurance, minus: true },
    { label: "BHYT", value: p.healthInsurance, minus: true },
    { label: "BHTN", value: p.unemploymentInsurance, minus: true },
    { label: `Thu nhập tính thuế (${p.dependentCount} người phụ thuộc)`, value: p.taxableIncome },
    { label: "Thuế TNCN", value: p.pit, minus: true },
  ];
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {lines.map((l) => (
        <div key={l.label} className={cn("flex justify-between gap-3 px-3 py-2", l.strong && "font-semibold")}>
          <dt>{l.label}</dt>
          <dd className="shrink-0 tabular-nums">{l.minus && l.value ? `−${formatMoney(l.value)}` : formatMoney(l.value)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3 bg-muted px-3 py-2.5 font-semibold">
        <dt>Thực lĩnh</dt>
        <dd className="tabular-nums text-primary">{formatMoney(p.netSalary)}</dd>
      </div>
    </dl>
  );
}

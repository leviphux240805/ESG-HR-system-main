import { useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ExportButton } from "@/components/common/ExportButton";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatMoney, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type MyPayslip, PAYROLL_STATUS, payslipPdf, useMyPayslips, usePayslip } from "@/api";
import { PayslipBreakdown } from "@/features/payroll/PayslipBreakdown";

function PayslipCard({ item, open, onToggle }: { item: MyPayslip; open: boolean; onToggle: () => void }) {
  const detail = usePayslip(open ? item.id : null);
  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{formatMonth(item.month)}</p>
            <p className="text-xs text-muted-foreground">{item.schoolName}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatMoney(item.netSalary)}</p>
            <StatusBadge status={item.status} labels={PAYROLL_STATUS} />
          </div>
          <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="space-y-3 border-t p-4">
            {detail.isLoading ? (
              <PageSkeleton />
            ) : detail.isError ? (
              <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
            ) : detail.data ? (
              <>
                <PayslipBreakdown payslip={detail.data} />
                <ExportButton label="Tải phiếu lương PDF" request={() => payslipPdf(item.id)} fileName={`phieu-luong-${item.month.slice(0, 7)}.pdf`} />
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Phiếu lương của tôi: các tháng đã duyệt, bấm để xem chi tiết và tải PDF; dùng tốt trên điện thoại. */
export default function MyPayslipsPage() {
  const query = useMyPayslips();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Phiếu lương của tôi" description="Phiếu lương các tháng đã được duyệt." />
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState icon={Wallet} title="Chưa có phiếu lương" description="Phiếu lương hiện ở đây khi bảng lương tháng được duyệt." />
      ) : (
        <div className="space-y-3">
          {query.data.map((item) => (
            <PayslipCard key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

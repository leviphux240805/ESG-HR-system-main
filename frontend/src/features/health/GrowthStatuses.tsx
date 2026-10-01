import { StatusBadge } from "@/components/common/StatusBadge";
import { BMI_STATUS, HEIGHT_STATUS, type MeasurementDto, WEIGHT_STATUS, needsAttention } from "@/api";

/** Chỉ hiện kênh lệch chuẩn; cả ba bình thường thì một nhãn "Bình thường". */
export function GrowthStatuses({ m }: { m: MeasurementDto }) {
  if (!m.standard) return <span className="text-xs text-muted-foreground">Ngoài bảng chuẩn WHO</span>;
  if (!needsAttention(m)) return <StatusBadge status="NORMAL" labels={WEIGHT_STATUS} />;
  return (
    <div className="flex flex-wrap gap-1">
      {m.weightStatus && m.weightStatus !== "NORMAL" && <StatusBadge status={m.weightStatus} labels={WEIGHT_STATUS} />}
      {m.heightStatus && m.heightStatus !== "NORMAL" && <StatusBadge status={m.heightStatus} labels={HEIGHT_STATUS} />}
      {m.bmiStatus && m.bmiStatus !== "NORMAL" && <StatusBadge status={m.bmiStatus} labels={BMI_STATUS} />}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ATTENDANCE_CODES, CODE_LABELS, codeTone } from "./codes";

/** Chú thích mã công và ký hiệu trên lưới (điện thoại: thu gọn, bấm để mở). */
export function AttendanceLegend() {
  return (
    <details className="group text-xs text-muted-foreground md:[&>summary]:hidden" open={typeof window !== "undefined" && window.innerWidth >= 768}>
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground">Chú thích mã công</summary>
      <Legend />
    </details>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Chú thích">
      {ATTENDANCE_CODES.map((code) => (
        <span key={code}>
          <b className={cn("font-semibold", codeTone(code))}>{code}</b> {CODE_LABELS[code]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 bg-muted border" /> Ngày nghỉ tuần
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 bg-red-50 border" /> Ngày lễ
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 text-amber-500" /> Sai lệch với máy
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" /> Tính đi muộn
      </span>
    </div>
  );
}

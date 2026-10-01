import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonth } from "@/lib/format";
import { shiftMonth } from "@/features/attendance/codes";

export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Chọn tháng">
      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Tháng trước">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="min-w-[8.5rem] text-center font-medium">{formatMonth(month)}</span>
      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Tháng sau">
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

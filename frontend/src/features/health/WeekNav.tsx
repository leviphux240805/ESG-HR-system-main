import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, mondayOf, todayIso, weekRangeLabel } from "./week";

export function WeekNav({ week, onChange }: { week: string; onChange: (week: string) => void }) {
  const isCurrent = week === mondayOf(todayIso());
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Chọn tuần">
      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(addDays(week, -7))} aria-label="Tuần trước">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="min-w-[9.5rem] text-center font-medium tabular-nums">{weekRangeLabel(week)}</span>
      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(addDays(week, 7))} aria-label="Tuần sau">
        <ChevronRight className="w-4 h-4" />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" className="min-h-11" onClick={() => onChange(todayIso())}>
          Tuần này
        </Button>
      )}
    </div>
  );
}

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerCustomProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  openDirection?: "left" | "right" | "top" | "bottom";
}

// Parse ISO date string safely without timezone conversion
function parseISO(dateString: string) {
  if (!dateString) return null;
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;
  return new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2])
  );
}

// Format date to ISO string (YYYY-MM-DD)
function toISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatePickerCustom({
  value,
  onChange,
  placeholder = "Chọn ngày",
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  openDirection = "bottom",
}: DatePickerCustomProps) {
  const [isOpen, setIsOpen] = useState(false);

  const parsedDate = value ? parseISO(value) : null;
  const [displayMonth, setDisplayMonth] = useState(
    parsedDate ? parsedDate.getMonth() : new Date().getMonth()
  );
  const [displayYear, setDisplayYear] = useState(
    parsedDate ? parsedDate.getFullYear() : new Date().getFullYear()
  );

  const selectedDay = parsedDate ? parsedDate.getDate() : null;

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(displayYear, displayMonth, day);
    const dateString = toISOString(newDate);
    onChange(dateString);
    setIsOpen(false);
  };

  const handleMonthChange = (month: string) => {
    setDisplayMonth(parseInt(month));
  };

  const handleYearChange = (year: string) => {
    setDisplayYear(parseInt(year));
  };

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const daysInMonth = getDaysInMonth(displayMonth, displayYear);
  const firstDay = getFirstDayOfMonth(displayMonth, displayYear);

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  const displayDate = value
    ? (() => {
        const d = parseISO(value);
        if (!d) return placeholder;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      })()
    : placeholder;

  // Map openDirection to Popover side/align
  const side = openDirection === "left" ? "left" : openDirection === "right" ? "right" : "bottom";
  const align = openDirection === "top" || openDirection === "bottom" ? "start" : "start";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayDate}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-4" 
        side={side}
        align={align}
      >
        <div className="w-[280px]">
          {/* Month & Year Selectors */}
          <div className="flex gap-2 mb-4">
            <Select
              value={displayMonth.toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((month, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={displayYear.toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {Array.from(
                  { length: maxYear - minYear + 1 },
                  (_, i) => maxYear - i
                ).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-muted-foreground h-8 flex items-center justify-center"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8"></div>
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                selectedDay === day &&
                parsedDate?.getMonth() === displayMonth &&
                parsedDate?.getFullYear() === displayYear;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "h-8 rounded flex items-center justify-center text-sm hover:bg-muted transition-colors",
                    isSelected &&
                      "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-2 justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Đóng
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

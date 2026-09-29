import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Clock, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string; // "HH:mm" format
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Generate hours (00-23) and minutes (00-59 in 5-min intervals)
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

export function TimePicker({
  value,
  onChange,
  placeholder = "Chọn giờ...",
  className,
  disabled = false,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);

  // Parse value into hour and minute
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setSelectedHour(h || null);
      setSelectedMinute(m || null);
    } else {
      setSelectedHour(null);
      setSelectedMinute(null);
    }
  }, [value]);

  // Scroll to selected values when opening
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (selectedHour && hourScrollRef.current) {
          const hourIndex = hours.indexOf(selectedHour);
          hourScrollRef.current.scrollTop = Math.max(0, hourIndex * 36 - 72);
        }
        if (selectedMinute && minuteScrollRef.current) {
          const minuteIndex = minutes.indexOf(selectedMinute);
          minuteScrollRef.current.scrollTop = Math.max(0, minuteIndex * 36 - 72);
        }
      });
    }
  }, [isOpen, selectedHour, selectedMinute]);

  // Handle wheel event manually to ensure scrolling works
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.scrollTop += e.deltaY;
  }, []);

  const handleHourSelect = (hour: string) => {
    setSelectedHour(hour);
    const newValue = `${hour}:${selectedMinute || "00"}`;
    onChange?.(newValue);
  };

  const handleMinuteSelect = (minute: string) => {
    setSelectedMinute(minute);
    const newValue = `${selectedHour || "08"}:${minute}`;
    onChange?.(newValue);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHour(null);
    setSelectedMinute(null);
    onChange?.("");
  };

  const displayValue = value || placeholder;
  const hasValue = !!value;

  const scrollContainerStyle: React.CSSProperties = {
    height: 200,
    overflowY: "scroll",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !hasValue && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 opacity-50" />
            {displayValue}
          </span>
          <span className="flex items-center gap-1">
            {hasValue && (
              <span
                role="button"
                onClick={handleClear}
                className="p-0.5 hover:bg-muted rounded transition-colors"
              >
                <X className="h-3 w-3 opacity-50 hover:opacity-100" />
              </span>
            )}
            <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-[9999] w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 time-picker-popover"
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <style>{`
            .time-picker-popover [data-scroll]::-webkit-scrollbar { display: none; }
          `}</style>
          <div className="flex">
            {/* Hours Column */}
            <div className="flex-1 border-r">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/50 text-center">
                Giờ
              </div>
              <div
                ref={hourScrollRef}
                data-scroll
                style={scrollContainerStyle}
                onWheel={handleWheel}
              >
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => handleHourSelect(hour)}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-center hover:bg-accent hover:text-accent-foreground transition-colors",
                      selectedHour === hour && "bg-primary text-primary-foreground font-medium"
                    )}
                  >
                    {hour}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="flex-1">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/50 text-center">
                Phút
              </div>
              <div
                ref={minuteScrollRef}
                data-scroll
                style={scrollContainerStyle}
                onWheel={handleWheel}
              >
                {minutes.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => handleMinuteSelect(minute)}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-center hover:bg-accent hover:text-accent-foreground transition-colors",
                      selectedMinute === minute && "bg-primary text-primary-foreground font-medium"
                    )}
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

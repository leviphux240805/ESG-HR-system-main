import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { AttendanceLabel, AttendanceRecord } from "@/data/attendanceTypes";
import { Holiday } from "@/data/vietnameseHolidays";
import { toast } from "sonner";

export interface Employee {
  id: string;
  employeeID: string;
  name: string;
  department?: string;
  position?: string;
}

export interface ManualAttendanceRecord {
  id?: string;
  employee_id: string;
  work_date: string;
  status_code: string;
  note?: string | null;
  leave_time?: string | null;
  return_time?: string | null;
}

export interface MonthlySummary {
  employee_id: string;
  month_date: string;
  total_work: number;
  unpaid_leave: number;
  holiday_leave: number;
  paid_leave: number;
}

interface UseAttendanceDataReturn {
  employees: Employee[];
  attendanceRecords: Map<string, ManualAttendanceRecord>; // key: "employeeId-YYYY-MM-DD"
  holidays: Holiday[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveAttendance: (
    employeeId: string,
    date: Date,
    statusCode: AttendanceLabel,
    options?: {
      note?: string;
      leaveTime?: string;
      returnTime?: string;
    },
  ) => Promise<boolean>;
  deleteAttendance: (employeeId: string, date: Date) => Promise<boolean>;
  saveMonthlySummaries: (summaries: MonthlySummary[]) => Promise<boolean>;
  reconciliationMap: Map<string, any>;
  lateCountMap: Map<string, number>; // employee_id -> late count for the month
  updateLocalDiscrepancy: (
    employeeId: string,
    dateStr: string,
    isDiscrepancy: boolean,
  ) => void;
}

export function useAttendanceData(
  year: number,
  month: number,
): UseAttendanceDataReturn {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    Map<string, ManualAttendanceRecord>
  >(new Map());
  const [reconciliationMap, setReconciliationMap] = useState<Map<string, any>>(
    new Map(),
  );
  const [lateCountMap, setLateCountMap] = useState<Map<string, number>>(
    new Map(),
  );
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch employees
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, employeeID, name, department, position")
        .order("name");

      if (empError) throw empError;
      setEmployees(empData || []);

      // Fetch attendance records for the month
      // Fetch attendance records for the month
      const startDate = `${year}-${(month + 1).toString().padStart(2, "0")}-01`;
      // Fix timezone issue: toISOString() converts 00:00 local to previous day UTC
      // Use manual formatting to keep local date
      const lastDay = new Date(year, month + 1, 0);
      const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      const { data: attData, error: attError } = await supabase
        .from("attendance_manual")
        .select("*")
        .gte("work_date", startDate)
        .lte("work_date", endDate);

      if (attError) throw attError;

      // Build map of attendance records (full records)
      const recordMap = new Map<string, ManualAttendanceRecord>();
      (attData || []).forEach((record) => {
        const key = `${record.employee_id}-${record.work_date}`;
        recordMap.set(key, record as ManualAttendanceRecord);
      });
      setAttendanceRecords(recordMap);

      // Fetch holidays for the month
      const { data: holidayData, error: holidayError } = await supabase
        .from("holidays")
        .select("*")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate);

      setHolidays(holidayData || []);

      // Fetch daily attendance summary (reconciliation results)
      const { data: summaryData, error: summaryError } = await supabase
        .from("daily_attendance_summary")
        .select("*")
        .gte("work_date", startDate)
        .lte("work_date", endDate);

      if (summaryError) throw summaryError;

      const summaryMap = new Map<string, any>();
      const lateCounts = new Map<string, number>();
      (summaryData || []).forEach((record) => {
        const key = `${record.employee_id}-${record.work_date}`;
        summaryMap.set(key, record);

        // Count late days per employee
        if (record.is_counted_late) {
          const current = lateCounts.get(record.employee_id) || 0;
          lateCounts.set(record.employee_id, current + 1);
        }
      });
      setReconciliationMap(summaryMap);
      setLateCountMap(lateCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Error fetching attendance data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveAttendance = async (
    employeeId: string,
    date: Date,
    statusCode: AttendanceLabel,
    options?: {
      note?: string;
      leaveTime?: string;
      returnTime?: string;
    },
  ): Promise<boolean> => {
    try {
      // Format date without timezone conversion
      const workDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      // Build upsert data - always include time fields (null to clear)
      const upsertData: Record<string, unknown> = {
        employee_id: employeeId,
        work_date: workDate,
        status_code: statusCode,
        updated_at: new Date().toISOString(),
        note: options?.note || null,
        leave_time: options?.leaveTime || null,
        return_time: options?.returnTime || null,
      };

      const { error } = await supabase
        .from("attendance_manual")
        .upsert(upsertData, { onConflict: "employee_id,work_date" });

      if (error) throw error;

      // Update local state with full record
      const key = `${employeeId}-${workDate}`;
      const recordData: ManualAttendanceRecord = {
        employee_id: employeeId,
        work_date: workDate,
        status_code: statusCode,
        note: options?.note || null,
        leave_time: options?.leaveTime || null,
        return_time: options?.returnTime || null,
      };
      setAttendanceRecords((prev) => {
        const next = new Map(prev);
        next.set(key, recordData);
        return next;
      });

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Lỗi lưu chấm công: " + message);
      return false;
    }
  };

  const saveMonthlySummaries = async (
    summaries: MonthlySummary[],
  ): Promise<boolean> => {
    try {
      if (summaries.length === 0) return true;

      const { error } = await supabase
        .from("attendance_monthly_summaries")
        .upsert(summaries, { onConflict: "employee_id,month_date" });

      if (error) throw error;

      toast.success("Đã lưu bảng tổng hợp chấm công!");
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Lỗi lưu tổng hợp: " + message);
      return false;
    }
  };

  return {
    employees,
    attendanceRecords,
    holidays,
    isLoading,
    error,
    refetch: fetchData,

    saveAttendance,
    deleteAttendance: async () => false, // Placeholder as user reverted deletion logic
    saveMonthlySummaries,
    reconciliationMap,
    lateCountMap,
    updateLocalDiscrepancy: (
      employeeId: string,
      dateStr: string,
      isDiscrepancy: boolean,
    ) => {
      const key = `${employeeId}-${dateStr}`;
      setReconciliationMap((prev) => {
        const next = new Map(prev);
        const record = next.get(key);
        if (record) {
          next.set(key, { ...record, is_discrepancy: isDiscrepancy });
        }
        return next;
      });
    },
  };
}

/**
 * Get attendance record for a specific employee and date
 */
export function getAttendanceRecord(
  records: Map<string, ManualAttendanceRecord>,
  employeeId: string,
  date: Date,
): ManualAttendanceRecord | null {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const key = `${employeeId}-${dateStr}`;
  return records.get(key) || null;
}

/**
 * Generate calendar data for a month with attendance labels
 * Uses holidays from database to mark public holidays with 'NL' label
 */
export function generateCalendarData(
  year: number,
  month: number,
  employeeId: string | null,
  records: Map<string, AttendanceLabel>,
  holidays: Holiday[],
): AttendanceRecord[] {
  const result: AttendanceRecord[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a map of holidays by date for quick lookup
  const holidayMap = new Map<string, string>();
  holidays.forEach((h) => {
    holidayMap.set(h.holiday_date, h.name);
  });

  // Helper function to format date as YYYY-MM-DD without timezone conversion
  const formatDateStr = (y: number, m: number, d: number): string => {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const dateStr = formatDateStr(year, month, day);

    // Check for holiday from database
    const holidayName = holidayMap.get(dateStr);

    // Default labels for weekends and holidays
    let label: AttendanceLabel = "";
    let note: string | undefined;

    if (dayOfWeek === 0) {
      label = "CN";
    } else if (holidayName) {
      // Vietnamese public holiday
      label = "NL";
      note = holidayName;
    } else if (dayOfWeek === 6) {
      label = "T7";
    }

    // Check for saved attendance (overrides default labels)
    if (employeeId) {
      const key = `${employeeId}-${dateStr}`;
      const savedLabel = records.get(key);
      if (savedLabel) {
        label = savedLabel;
      }
    }

    result.push({ date, label, note });
  }

  return result;
}

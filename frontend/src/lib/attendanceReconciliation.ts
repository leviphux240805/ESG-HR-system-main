import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface AttendanceConfig {
  id: string;
  max_late_count_allowed: number;
  late_grace_minutes: number;
  official_start_time: string;
  apply_from: string;
}

export interface MachineRecord {
  employee_code: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
}

export interface ManualRecord {
  employee_id: string;
  work_date: string;
  status_code: string;
  note?: string;
}

export interface ReconciliationResult {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  work_date: string;
  machine_check_in: string | null;
  machine_check_out: string | null;
  manual_status: string | null;
  has_discrepancy: boolean;
  discrepancy_reason?: string;
  suggested_status?: string;
  late_minutes: number;
  is_counted_late: boolean;
}

/**
 * Calculate late minutes based on check-in time and official start time
 */
export function calculateLateMinutes(
  checkIn: string | null,
  officialStart: string,
): number {
  if (!checkIn || !checkIn.includes(":")) return 0;

  const [checkHour, checkMin] = checkIn.split(":").map(Number);
  const [startHour, startMin] = officialStart.split(":").map(Number);

  const checkInMinutes = checkHour * 60 + checkMin;
  const startMinutes = startHour * 60 + startMin;

  return Math.max(0, checkInMinutes - startMinutes);
}

/**
 * Determine if this late instance should be counted based on X/Y rules
 */
export function shouldCountLate(
  lateMinutes: number,
  lateGraceMinutes: number,
  previousMinorLateCount: number,
  maxLateCountAllowed: number,
): boolean {
  // If late more than grace period, always count
  if (lateMinutes > lateGraceMinutes) {
    return true;
  }

  // If within grace period but exceeded allowed count
  if (lateMinutes > 0 && previousMinorLateCount >= maxLateCountAllowed) {
    return true;
  }

  return false;
}

/**
 * Detect discrepancy between machine and manual data
 */
// Helper to parse time "HH:mm" to minutes from midnight
function parseTimeToMinutes(timeStr: string | null): number | null {
  if (!timeStr || !timeStr.includes(":") || isNaN(parseInt(timeStr)))
    return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Detect discrepancy between machine and manual data
 * Now supports Half-Day logic based on checkout time
 */
export function detectDiscrepancy(
  machineCheckIn: string | null,
  machineCheckOut: string | null,
  manualStatus: string | null,
  config: { official_start_time: string },
  workDate?: string, // Optional: YYYY-MM-DD to check if Saturday
): { hasDiscrepancy: boolean; reason?: string; suggestStatus?: string } {
  const startMinutes = parseTimeToMinutes(config.official_start_time) || 480; // Default 08:00
  const lunchStart = startMinutes + 4 * 60; // +4h
  const lunchEnd = startMinutes + 5.5 * 60; // +5.5h (1.5h break)
  const afternoonEarlyEnd = startMinutes + 7.5 * 60; // +7.5h (2h into afternoon)

  // Check if Saturday (company works half-day)
  const isSaturday = workDate ? new Date(workDate).getDay() === 6 : false;

  const checkInMinutes = parseTimeToMinutes(machineCheckIn);
  const checkOutMinutes = parseTimeToMinutes(machineCheckOut);

  // Case 0: Machine has 'K' or 'V' (Absent)
  if (machineCheckIn === "K" || machineCheckIn === "V") {
    if (manualStatus && !["K", "V", "O", "CO"].includes(manualStatus)) {
      return {
        hasDiscrepancy: true,
        reason: `Máy: Vắng (${machineCheckIn}), HR: ${manualStatus}`,
      };
    }
    return { hasDiscrepancy: false };
  }

  // Case 1: Machine shows absent (null) but HR marked as present
  if (
    !machineCheckIn &&
    manualStatus &&
    !["K", "V", "O", "CO", "TS", "T"].includes(manualStatus)
  ) {
    return {
      hasDiscrepancy: true,
      reason: `Máy: Vắng mặt, HR: ${manualStatus}`,
    };
  }

  // Case 2: Machine shows present but HR marked as absent/leave
  if (
    machineCheckIn &&
    manualStatus &&
    ["V", "K", "O", "CO"].includes(manualStatus)
  ) {
    return {
      hasDiscrepancy: true,
      reason: `Máy: Có mặt (${machineCheckIn}), HR: ${manualStatus}`,
    };
  }

  // Case 3: Has check_in but NO check_out (missing punch out)
  if (
    machineCheckIn &&
    machineCheckIn !== "K" &&
    machineCheckIn !== "V" &&
    !machineCheckOut
  ) {
    // Determine suggested status based on check-in time
    let suggestedStatus = "X"; // Default to full day
    let reason = "Có giờ vào, thiếu giờ về - Cần xác nhận";

    if (checkInMinutes) {
      // If check-in is after lunch (afternoon shift), suggest full day
      if (checkInMinutes >= lunchEnd) {
        suggestedStatus = "X";
        reason = "Có giờ vào (ca chiều), thiếu giờ về - Cần xác nhận";
      }
      // If check-in is before lunch, could be half day or full day
      else if (checkInMinutes < lunchStart) {
        suggestedStatus = "X"; // Assume full day, HR to confirm
        reason = "Có giờ vào, thiếu giờ về - Có thể quên chấm công về";
      }
    }

    return {
      hasDiscrepancy: true,
      reason: reason,
      suggestStatus: suggestedStatus,
    };
  }

  // Case 4: Half-day check (Check-out during lunch or early afternoon)
  if (checkOutMinutes) {
    // If checkout is between Lunch Start and Afternoon Start + 2h
    // Lunch Start (12:00) -> Afternoon Early End (15:30) roughly
    if (checkOutMinutes >= lunchStart && checkOutMinutes <= afternoonEarlyEnd) {
      // Saturday: company works half-day, so this is normal - NO discrepancy
      if (isSaturday) {
        return { hasDiscrepancy: false };
      }

      // Weekday: Should be half day (1/2K or 1/2P or X/2)
      // If manual status is not half-day code, flag it
      const isHalfDayStatus =
        manualStatus &&
        (manualStatus.includes("1/2") || manualStatus.includes("/2"));

      if (!isHalfDayStatus) {
        return {
          hasDiscrepancy: true,
          reason: `Về sớm (nửa ngày), HR: ${manualStatus || "Chưa chấm"}`,
          suggestStatus: "1/2K",
        };
      }
    }
  }

  // Case 5: No manual data for a work day with machine data
  if (machineCheckIn && !manualStatus) {
    return {
      hasDiscrepancy: false, // Not a discrepancy, just needs HR to confirm (or auto-fill X later)
    };
  }

  return { hasDiscrepancy: false };
}

/**
 * Perform reconciliation for a specific month
 */
export async function reconcileAttendance(
  year: number,
  month: number,
): Promise<ReconciliationResult[]> {
  const startDate = `${year}-${(month + 1).toString().padStart(2, "0")}-01`;
  // Fix timezone issue: use local date components instead of toISOString()
  const lastDay = new Date(year, month + 1, 0);
  const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  try {
    // Fetch config
    const { data: configData } = await supabase
      .from("attendance_config")
      .select("*")
      .order("apply_from", { ascending: false })
      .limit(1)
      .single();

    const config = configData || {
      max_late_count_allowed: 3,
      late_grace_minutes: 15,
      official_start_time: "08:00",
    };

    // Fetch machine data
    const { data: machineData, error: machineError } = await supabase
      .from("attendance_raw_machine")
      .select("*")
      .gte("work_date", startDate)
      .lte("work_date", endDate);

    if (machineError) throw machineError;

    // Fetch manual data with employee info
    const { data: manualData, error: manualError } = await supabase
      .from("attendance_manual")
      .select(
        `
        *,
        employees(id, employeeID, name)
      `,
      )
      .gte("work_date", startDate)
      .lte("work_date", endDate);

    if (manualError) throw manualError;

    // Fetch all employees for mapping - now map by ID (UUID) for direct lookup
    const { data: employees } = await supabase
      .from("employees")
      .select("id, employeeID, name");

    // Create map by employee ID (UUID) for direct lookup
    const employeeMapById = new Map((employees || []).map((e) => [e.id, e]));

    // Also create map by employeeID (code) for fallback
    const employeeMapByCode = new Map(
      (employees || []).map((e) => [e.employeeID?.toLowerCase(), e]),
    );

    // Build reconciliation results
    const results: ReconciliationResult[] = [];
    const processedDates = new Set<string>();

    type MachineRecordType = typeof machineData extends (infer T)[] ? T : never;

    // Track minor late counts per employee
    const minorLateCounts = new Map<string, number>();

    // Process all machine records
    for (const record of machineData || []) {
      // Use employee_id as primary key for deduplication
      const key = record.employee_id
        ? `${record.employee_id}-${record.work_date}`
        : `${record.employee_code}-${record.work_date}`;
      if (processedDates.has(key)) {
        continue;
      }
      processedDates.add(key);

      // Find employee - prefer employee_id (UUID), fallback to employee_code
      let employee = record.employee_id
        ? employeeMapById.get(record.employee_id)
        : null;

      // Fallback to employee_code if employee_id not found
      if (!employee && record.employee_code) {
        employee = employeeMapByCode.get(record.employee_code?.toLowerCase());
      }

      if (!employee) {
        continue;
      }

      const manualRecord = (manualData || []).find(
        (m) =>
          m.employee_id === employee.id && m.work_date === record.work_date,
      );

      const lateMinutes = calculateLateMinutes(
        record.check_in,
        config.official_start_time,
      );

      // Track minor lates (within grace period)
      const employeeKey = employee.id;
      if (lateMinutes > 0 && lateMinutes <= config.late_grace_minutes) {
        minorLateCounts.set(
          employeeKey,
          (minorLateCounts.get(employeeKey) || 0) + 1,
        );
      }

      const isCountedLate = shouldCountLate(
        lateMinutes,
        config.late_grace_minutes,
        (minorLateCounts.get(employeeKey) || 1) - 1,
        config.max_late_count_allowed,
      );

      const { hasDiscrepancy, reason, suggestStatus } = detectDiscrepancy(
        record.check_in,
        record.check_out,
        manualRecord?.status_code || null,
        config,
        record.work_date, // Pass workDate to check Saturday
      );

      results.push({
        employee_id: employee.id,
        employee_code: record.employee_code,
        employee_name: employee.name,
        work_date: record.work_date,
        machine_check_in: record.check_in,
        machine_check_out: record.check_out,
        manual_status: manualRecord?.status_code || null,
        has_discrepancy: hasDiscrepancy,
        discrepancy_reason: reason,
        suggested_status: suggestStatus,
        late_minutes: lateMinutes,
        is_counted_late: isCountedLate,
      });
    }

    // Process manual records not in machine data
    for (const record of manualData || []) {
      const emp = record.employees;
      if (!emp) continue;

      // Use employee.id (UUID) to match with machine records key
      const key = `${emp.id}-${record.work_date}`;
      if (processedDates.has(key)) continue;
      processedDates.add(key);

      // Manual entry without machine data
      const { hasDiscrepancy, reason, suggestStatus } = detectDiscrepancy(
        null,
        null,
        record.status_code,
        config,
        record.work_date, // Pass workDate to check Saturday
      );

      results.push({
        employee_id: emp.id,
        employee_code: emp.employeeID,
        employee_name: emp.name,
        work_date: record.work_date,
        machine_check_in: null,
        machine_check_out: null,
        manual_status: record.status_code,
        has_discrepancy: hasDiscrepancy,
        discrepancy_reason: reason,
        suggested_status: suggestStatus,
        late_minutes: 0,
        is_counted_late: false,
      });
    }

    // Sort by date and employee
    results.sort((a, b) => {
      const dateCompare = a.work_date.localeCompare(b.work_date);
      if (dateCompare !== 0) return dateCompare;
      return a.employee_name.localeCompare(b.employee_name);
    });

    return results;
  } catch (error: any) {
    toast.error("Lỗi đối soát: " + error.message);
    return [];
  }
}

/**
 * Save reconciliation results to daily_attendance_summary
 */
export async function saveReconciliationResults(
  results: ReconciliationResult[],
): Promise<boolean> {
  try {
    // Deduplicate by employee_id + work_date (keep last occurrence)
    const uniqueMap = new Map<string, ReconciliationResult>();
    for (const r of results) {
      const key = `${r.employee_id}-${r.work_date}`;
      uniqueMap.set(key, r);
    }

    const records = Array.from(uniqueMap.values()).map((r) => ({
      employee_id: r.employee_id,
      work_date: r.work_date,
      machine_check_in: r.machine_check_in,
      machine_check_out: r.machine_check_out,
      manual_status: r.manual_status,
      final_status: r.manual_status || (r.machine_check_in ? "X" : null),
      late_minutes: r.late_minutes,
      is_counted_late: r.is_counted_late,
      is_discrepancy: r.has_discrepancy,
    }));

    const { error } = await supabase
      .from("daily_attendance_summary")
      .upsert(records, { onConflict: "employee_id,work_date" });

    if (error) throw error;

    // Update attendance_manual to reflect the resolved status
    // This ensures the discrepancy doesn't reappear in the next check because the HR data will now match or be updated
    const manualRecords = Array.from(uniqueMap.values())
      .filter((r) => r.manual_status) // Only update if status is set
      .map((r) => ({
        employee_id: r.employee_id,
        work_date: r.work_date,
        status_code: r.manual_status,
        updated_at: new Date().toISOString(),
      }));

    if (manualRecords.length > 0) {
      const { error: manualError } = await supabase
        .from("attendance_manual")
        .upsert(manualRecords, { onConflict: "employee_id,work_date" });

      if (manualError) throw manualError;
    }

    toast.success(`Đã lưu ${records.length} bản ghi đối soát`);
    return true;
  } catch (error: any) {
    toast.error("Lỗi lưu đối soát: " + error.message);
    return false;
  }
}

/**
 * Get discrepancies for a specific month
 */
export async function getDiscrepancies(
  year: number,
  month: number,
): Promise<ReconciliationResult[]> {
  const results = await reconcileAttendance(year, month);
  return results.filter((r) => r.has_discrepancy);
}

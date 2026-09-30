/**
 * BẢN THAM CHIẾU – KHÔNG DÙNG TRONG APP. Chép nguyên logic đối soát của ESG HR (`lib/attendanceReconciliation.ts`) để
 * sinh kết quả chuẩn (golden) cho test đối chiếu với bộ đối soát Java (`AttendanceReconciler`). Chỉ bỏ phần gọi
 * Supabase: vòng lặp của `reconcileAttendance` nhận dữ liệu máy + mã chấm tay trực tiếp, nhân viên khớp theo mã.
 * Không sửa logic ở đây; muốn đổi hành vi thì đổi ở Java và ghi rõ trong test.
 */

export interface ReferenceConfig {
  max_late_count_allowed: number;
  late_grace_minutes: number;
  official_start_time: string;
}

export interface ReferenceMachineRecord {
  employee_code: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
}

export interface ReferenceManualRecord {
  employee_code: string;
  work_date: string;
  status_code: string;
}

export interface ReferenceResult {
  employee_code: string;
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

// ---- nguyên văn bản cũ

export function calculateLateMinutes(checkIn: string | null, officialStart: string): number {
  if (!checkIn || !checkIn.includes(":")) return 0;

  const [checkHour, checkMin] = checkIn.split(":").map(Number);
  const [startHour, startMin] = officialStart.split(":").map(Number);

  const checkInMinutes = checkHour * 60 + checkMin;
  const startMinutes = startHour * 60 + startMin;

  return Math.max(0, checkInMinutes - startMinutes);
}

export function shouldCountLate(
  lateMinutes: number,
  lateGraceMinutes: number,
  previousMinorLateCount: number,
  maxLateCountAllowed: number,
): boolean {
  if (lateMinutes > lateGraceMinutes) {
    return true;
  }
  if (lateMinutes > 0 && previousMinorLateCount >= maxLateCountAllowed) {
    return true;
  }
  return false;
}

function parseTimeToMinutes(timeStr: string | null): number | null {
  if (!timeStr || !timeStr.includes(":") || isNaN(parseInt(timeStr))) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function detectDiscrepancy(
  machineCheckIn: string | null,
  machineCheckOut: string | null,
  manualStatus: string | null,
  config: { official_start_time: string },
  workDate?: string,
): { hasDiscrepancy: boolean; reason?: string; suggestStatus?: string } {
  const startMinutes = parseTimeToMinutes(config.official_start_time) || 480;
  const lunchStart = startMinutes + 4 * 60;
  const lunchEnd = startMinutes + 5.5 * 60;
  const afternoonEarlyEnd = startMinutes + 7.5 * 60;

  const isSaturday = workDate ? new Date(workDate).getDay() === 6 : false;

  const checkInMinutes = parseTimeToMinutes(machineCheckIn);
  const checkOutMinutes = parseTimeToMinutes(machineCheckOut);

  if (machineCheckIn === "K" || machineCheckIn === "V") {
    if (manualStatus && !["K", "V", "O", "CO"].includes(manualStatus)) {
      return {
        hasDiscrepancy: true,
        reason: `Máy: Vắng (${machineCheckIn}), HR: ${manualStatus}`,
      };
    }
    return { hasDiscrepancy: false };
  }

  if (!machineCheckIn && manualStatus && !["K", "V", "O", "CO", "TS", "T"].includes(manualStatus)) {
    return {
      hasDiscrepancy: true,
      reason: `Máy: Vắng mặt, HR: ${manualStatus}`,
    };
  }

  if (machineCheckIn && manualStatus && ["V", "K", "O", "CO"].includes(manualStatus)) {
    return {
      hasDiscrepancy: true,
      reason: `Máy: Có mặt (${machineCheckIn}), HR: ${manualStatus}`,
    };
  }

  if (machineCheckIn && machineCheckIn !== "K" && machineCheckIn !== "V" && !machineCheckOut) {
    let suggestedStatus = "X";
    let reason = "Có giờ vào, thiếu giờ về - Cần xác nhận";

    if (checkInMinutes) {
      if (checkInMinutes >= lunchEnd) {
        suggestedStatus = "X";
        reason = "Có giờ vào (ca chiều), thiếu giờ về - Cần xác nhận";
      } else if (checkInMinutes < lunchStart) {
        suggestedStatus = "X";
        reason = "Có giờ vào, thiếu giờ về - Có thể quên chấm công về";
      }
    }

    return {
      hasDiscrepancy: true,
      reason: reason,
      suggestStatus: suggestedStatus,
    };
  }

  if (checkOutMinutes) {
    if (checkOutMinutes >= lunchStart && checkOutMinutes <= afternoonEarlyEnd) {
      if (isSaturday) {
        return { hasDiscrepancy: false };
      }
      const isHalfDayStatus = manualStatus && (manualStatus.includes("1/2") || manualStatus.includes("/2"));
      if (!isHalfDayStatus) {
        return {
          hasDiscrepancy: true,
          reason: `Về sớm (nửa ngày), HR: ${manualStatus || "Chưa chấm"}`,
          suggestStatus: "1/2K",
        };
      }
    }
  }

  if (machineCheckIn && !manualStatus) {
    return {
      hasDiscrepancy: false,
    };
  }

  return { hasDiscrepancy: false };
}

// ---- vòng lặp của reconcileAttendance, bỏ Supabase (nhân viên = mã)

export function reconcileReference(
  config: ReferenceConfig,
  machineData: ReferenceMachineRecord[],
  manualData: ReferenceManualRecord[],
): ReferenceResult[] {
  const results: ReferenceResult[] = [];
  const processedDates = new Set<string>();
  const minorLateCounts = new Map<string, number>();

  for (const record of machineData) {
    const key = `${record.employee_code}-${record.work_date}`;
    if (processedDates.has(key)) continue;
    processedDates.add(key);

    const manualRecord = manualData.find((m) => m.employee_code === record.employee_code && m.work_date === record.work_date);

    const lateMinutes = calculateLateMinutes(record.check_in, config.official_start_time);

    const employeeKey = record.employee_code;
    if (lateMinutes > 0 && lateMinutes <= config.late_grace_minutes) {
      minorLateCounts.set(employeeKey, (minorLateCounts.get(employeeKey) || 0) + 1);
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
      record.work_date,
    );

    results.push({
      employee_code: record.employee_code,
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

  for (const record of manualData) {
    const key = `${record.employee_code}-${record.work_date}`;
    if (processedDates.has(key)) continue;
    processedDates.add(key);

    const { hasDiscrepancy, reason, suggestStatus } = detectDiscrepancy(null, null, record.status_code, config, record.work_date);

    results.push({
      employee_code: record.employee_code,
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

  results.sort((a, b) => {
    const dateCompare = a.work_date.localeCompare(b.work_date);
    if (dateCompare !== 0) return dateCompare;
    return a.employee_code.localeCompare(b.employee_code);
  });

  return results;
}

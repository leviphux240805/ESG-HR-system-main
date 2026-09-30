// Ngày thứ Bảy trong bản cũ tính bằng new Date("yyyy-MM-dd").getDay() → cố định múi giờ để kết quả không phụ thuộc máy
process.env.TZ = "Asia/Ho_Chi_Minh";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMachineWorkbook } from "@/features/attendance/machineExcel";
import {
  type ReferenceConfig,
  type ReferenceMachineRecord,
  type ReferenceManualRecord,
  reconcileReference,
} from "./attendanceReconciliationReference";

/**
 * Sinh/kiểm tra dữ liệu chuẩn cho test đối chiếu bộ đối soát Java (`AttendanceReconcilerParityTests`):
 * file Excel mẫu → parser (giữ thuật toán cũ) → đối soát bản TS cũ → JSON trong backend/src/test/resources/attendance.
 * Chạy `GEN_GOLDEN=1 npx vitest run src/lib/legacy` để ghi lại khi đổi file mẫu; mặc định chỉ kiểm file đã khớp.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const OUT_DIR = path.join(ROOT, "backend/src/test/resources/attendance");
const GENERATE = process.env.GEN_GOLDEN === "1";

interface Case {
  name: string;
  config: ReferenceConfig;
  punches: ReferenceMachineRecord[];
  manual: ReferenceManualRecord[];
}

function golden({ name, config, punches, manual }: Case) {
  const results = reconcileReference(config, punches, manual);
  return {
    description: `Sinh tự động từ bản đối soát TS cũ (${name}); không sửa tay.`,
    config: {
      officialStart: config.official_start_time,
      graceMinutes: config.late_grace_minutes,
      maxLateAllowed: config.max_late_count_allowed,
    },
    punches: punches.map((p) => ({ code: p.employee_code, date: p.work_date, checkIn: p.check_in, checkOut: p.check_out })),
    manual: manual.map((m) => ({ code: m.employee_code, date: m.work_date, status: m.status_code })),
    expected: results.map((r) => ({
      code: r.employee_code,
      date: r.work_date,
      lateMinutes: r.late_minutes,
      countedLate: r.is_counted_late,
      discrepancy: r.has_discrepancy,
      reason: r.discrepancy_reason ?? null,
      suggested: r.suggested_status ?? null,
    })),
  };
}

function check(fileName: string, data: ReturnType<typeof golden>) {
  const file = path.join(OUT_DIR, fileName);
  const json = JSON.stringify(data, null, 2) + "\n";
  if (GENERATE) {
    writeFileSync(file, json, "utf8");
    return;
  }
  expect(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).toBe(json);
}

const manual = (code: string, date: string, status_code: string): ReferenceManualRecord => ({
  employee_code: code,
  work_date: date,
  status_code,
});

describe("dữ liệu chuẩn đối soát (bản TS cũ)", () => {
  it("file Excel mẫu tháng 9/2026", () => {
    const buffer = readFileSync(path.join(ROOT, "docs/mau/may-cham-cong-gia-lap-2026-09.xlsx"));
    const rows = parseMachineWorkbook(buffer, 2026, 8);
    expect(rows.length).toBeGreaterThan(100);
    // Mã không có trong hệ thống vẫn có trong dữ liệu đọc được (backend báo không khớp)
    expect(rows.some((r) => r.machineCode === "999")).toBe(true);

    const punches = rows.map((r) => ({ employee_code: r.machineCode, work_date: r.workDate, check_in: r.checkIn, check_out: r.checkOut }));
    check(
      "sample-2026-09.json",
      golden({
        name: "docs/mau/may-cham-cong-gia-lap-2026-09.xlsx",
        config: { official_start_time: "07:30", late_grace_minutes: 15, max_late_count_allowed: 3 },
        punches,
        manual: [
          manual("101", "2026-09-03", "X"),
          manual("104", "2026-09-21", "P"),
          manual("104", "2026-09-22", "K"),
          manual("104", "2026-09-23", "O"),
          manual("105", "2026-09-21", "P"),
          manual("105", "2026-09-22", "K"),
          manual("105", "2026-09-23", "1/2P"),
          manual("107", "2026-09-03", "X"),
          manual("107", "2026-09-04", "TS"),
        ],
      }),
    );
  });

  it("các trường hợp biên (giờ vào 08:00, được muộn 2 lần)", () => {
    const p = (code: string, date: string, check_in: string | null, check_out: string | null): ReferenceMachineRecord => ({
      employee_code: code,
      work_date: date,
      check_in,
      check_out,
    });
    check(
      "edge-cases.json",
      golden({
        name: "ca biên viết tay",
        config: { official_start_time: "08:00", late_grace_minutes: 10, max_late_count_allowed: 2 },
        punches: [
          p("E1", "2026-10-01", "08:10", "17:00"), // đúng ân hạn: muộn nhẹ lần 1
          p("E1", "2026-10-02", "08:01", "17:00"), // lần 2
          p("E1", "2026-10-05", "08:05", "17:00"), // lần 3 > cho phép → tính
          p("E1", "2026-10-06", "08:11", "17:00"), // quá ân hạn
          p("E1", "2026-10-07", "07:59", "17:00"), // sớm
          p("E2", "2026-10-01", "00:00", null), // 00:00: nhánh "if (checkInMinutes)" sai → lý do mặc định
          p("E2", "2026-10-02", "12:00", null), // giữa lunchStart (12:00) và lunchEnd (13:30)
          p("E2", "2026-10-05", "13:30", null), // đúng lunchEnd → ca chiều
          p("E2", "2026-10-06", "08:00", "K"), // giờ ra "K" không phải giờ → không sai lệch
          p("E2", "2026-10-07", "08:00", "12:00"), // về đúng lunchStart
          p("E2", "2026-10-08", "08:00", "15:30"), // về đúng mốc chiều sớm (08:00 + 7,5h)
          p("E2", "2026-10-09", "08:00", "15:31"),
          p("E2", "2026-10-10", "08:00", "12:30"), // thứ Bảy về trưa
          p("E3", "2026-10-01", "7:05", "17:00"), // giờ không đủ 2 chữ số
          p("E3", "2026-10-02", "08:20:45", "17:00"), // có giây
          p("E3", "2026-10-05", "K", "K"), // vắng, HR ghi O
          p("E3", "2026-10-06", "K", "K"), // vắng, HR ghi NB
          p("E3", "2026-10-07", "08:00", "12:15"), // về trưa, HR ghi NN
          p("E3", "2026-10-08", "08:00", "12:15"), // về trưa, HR ghi 1/2K
          p("E3", "2026-10-09", "08:00", "17:00"), // có mặt, HR ghi CO
          p("E3", "2026-10-12", null, "17:00"), // chỉ có giờ ra, HR ghi X
        ],
        manual: [
          manual("E3", "2026-10-05", "O"),
          manual("E3", "2026-10-06", "NB"),
          manual("E3", "2026-10-07", "NN"),
          manual("E3", "2026-10-08", "1/2K"),
          manual("E3", "2026-10-09", "CO"),
          manual("E3", "2026-10-12", "X"),
          manual("E4", "2026-10-01", "P"), // chỉ có chấm tay
          manual("E4", "2026-10-02", "NL"),
          manual("E4", "2026-10-05", "T"),
        ],
      }),
    );
  });
});

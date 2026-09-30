import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { generateDb } from "./seed";
import { setSessionRole } from "./router";
import { mockFetch, resetDb } from "./index";

async function call<T>(method: string, path: string, body?: unknown, schoolId?: string): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (schoolId) headers["X-School-Id"] = schoolId;
  const res = await mockFetch(new Request(`http://localhost/api/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : undefined };
}

describe("dữ liệu demo", () => {
  it("seed cố định: cùng ngày cho cùng dữ liệu, đủ quy mô yêu cầu", () => {
    const day = new Date(2026, 8, 30);
    const a = generateDb(day);
    const b = generateDb(day);
    expect(a.children.map((c) => c.fullName)).toEqual(b.children.map((c) => c.fullName));
    expect(a.schools).toHaveLength(2);
    expect(a.classes).toHaveLength(8);
    expect(a.staff).toHaveLength(30);
    expect(a.children.length).toBeGreaterThanOrEqual(184);
    expect(a.children.length).toBeLessThanOrEqual(216);
    expect(a.startDate).toBe("2026-07-01");
  });
});

describe("API giả", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 30, 9, 0));
    resetDb();
    // bỏ độ trễ mạng giả trong test
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as unknown as typeof setTimeout);
  });

  it("chưa đăng nhập thì 401; giáo viên không vào được Hộp duyệt", async () => {
    setSessionRole(null);
    expect((await call("GET", "/today")).status).toBe(401);
    setSessionRole("teacher");
    expect((await call("GET", "/approvals")).status).toBe(403);
  });

  it("chặn cơ sở ngoài phạm vi", async () => {
    setSessionRole("vice");
    const other = db().schools[1].id;
    expect((await call("GET", "/today", undefined, other)).status).toBe(403);
  });

  it("duyệt đơn nghỉ trong Hộp duyệt ghi mã vào bảng công", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    const { data: items } = await call<{ id: string; type: string }[]>("GET", "/approvals", undefined, school);
    const leave = items.find((i) => i.type === "LEAVE")!;
    const rec = db().leaves.find((l) => l.id === leave.id)!;
    expect((await call("POST", `/approvals/LEAVE/${leave.id}/approve`, {}, school)).status).toBe(204);
    expect(rec.status).toBe("APPROVED");
    expect(db().staffDays[rec.staffId][rec.fromDate]).toBe(rec.halfDay ? `1/2${rec.leaveCode}` : rec.leaveCode);
    const { data: after } = await call<{ id: string }[]>("GET", "/approvals", undefined, school);
    expect(after.some((i) => i.id === leave.id)).toBe(false);
  });

  it("phân công người thay xóa cảnh báo lớp thiếu người", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    const { data: today } = await call<{ classes: { id: string; shortStaffed: boolean; teachers: { id: string; onLeave: boolean }[] }[]; availableStaff: { id: string }[] }>("GET", "/today", undefined, school);
    const short = today.classes.find((c) => c.shortStaffed)!;
    expect(short).toBeDefined();
    const absent = short.teachers.find((t) => t.onLeave)!;
    await call("POST", "/substitutions", { classId: short.id, absentStaffId: absent.id, staffId: today.availableStaff[0].id }, school);
    const { data: again } = await call<{ classes: { id: string; shortStaffed: boolean }[] }>("GET", "/today", undefined, school);
    expect(again.classes.find((c) => c.id === short.id)!.shortStaffed).toBe(false);
  });

  it("nhân sự: BGH chỉ thấy cơ sở đang chọn, giáo viên không xem danh sách", async () => {
    setSessionRole("principal");
    const [a, b] = db().schools;
    const { data } = await call<{ items: { schoolId: string }[]; totalElements: number }>("GET", "/staff?size=100", undefined, b.id);
    expect(data.totalElements).toBe(15);
    expect(data.items.every((s) => s.schoolId === b.id)).toBe(true);
    setSessionRole("teacher");
    expect((await call("GET", "/staff", undefined, a.id)).status).toBe(403);
  });

  it("chấm công: tháng đã khóa không sửa được; sửa ô tháng đang mở cập nhật tổng", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    const staffId = db().staff.find((s) => s.schoolId === school)!.id;
    expect((await call("PUT", `/attendance/staff/${staffId}/2026-08-03`, { code: "K" }, school)).status).toBe(409);
    const before = await call<{ staff: { staffId: string; totals: { unpaidLeave: number } }[] }>("GET", "/attendance/staff?month=2026-09", undefined, school);
    const unpaid = before.data.staff.find((r) => r.staffId === staffId)!.totals.unpaidLeave;
    expect((await call("PUT", `/attendance/staff/${staffId}/2026-09-03`, { code: "K" }, school)).status).toBe(200);
    const after = await call<{ staff: { staffId: string; totals: { unpaidLeave: number } }[] }>("GET", "/attendance/staff?month=2026-09", undefined, school);
    expect(after.data.staff.find((r) => r.staffId === staffId)!.totals.unpaidLeave).toBe(unpaid + 1);
  });
});

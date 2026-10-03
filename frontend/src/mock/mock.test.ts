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

  it("chưa đăng nhập thì 401; giáo viên không xem Hôm nay, Hộp duyệt trống", async () => {
    setSessionRole(null);
    expect((await call("GET", "/today")).status).toBe(401);
    setSessionRole("teacher");
    expect((await call("GET", "/today")).status).toBe(403);
    expect((await call<unknown[]>("GET", "/approvals")).data).toEqual([]);
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

  it("sổ điểm danh tháng: lưới trẻ × ngày, tổng theo ngày; tháng sai báo 400", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    const cls = db().classes.find((c) => c.schoolId === school)!;
    const month = new Date().toISOString().slice(0, 7);
    type Book = { days: { date: string; schoolDay: boolean; present: number }[]; rows: { childId: string; present: number }[] };
    const { status, data } = await call<Book>("GET", `/classes/${cls.id}/attendance/month?month=${month}`, undefined, school);
    expect(status).toBe(200);
    expect(data.rows.length).toBe(db().children.filter((c) => c.classId === cls.id).length);
    expect(data.days.length).toBeGreaterThanOrEqual(28);
    const totalByDay = data.days.reduce((s, d) => s + d.present, 0);
    expect(totalByDay).toBe(data.rows.reduce((s, r) => s + r.present, 0));
    expect((await call("GET", `/classes/${cls.id}/attendance/month?month=2026-13`, undefined, school)).status).toBe(400);
  });

  it("phân công người thay xóa cảnh báo lớp thiếu người", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    type Today = { classes: { id: string; shortStaffed: boolean; teachers: { staffId: string; onLeave: boolean }[] }[]; availableStaff: { staffId: string; schoolId: string }[] };
    const { data: today } = await call<Today>("GET", "/today", undefined, school);
    const short = today.classes.find((c) => c.shortStaffed)!;
    expect(short).toBeDefined();
    const absent = short.teachers.find((t) => t.onLeave)!;
    const substitute = today.availableStaff.find((s) => s.schoolId === school)!;
    expect((await call("POST", "/substitutions", { classId: short.id, absentStaffId: absent.staffId, staffId: substitute.staffId }, school)).status).toBe(204);
    const { data: again } = await call<{ classes: { id: string; shortStaffed: boolean }[] }>("GET", "/today", undefined, school);
    expect(again.classes.find((c) => c.id === short.id)!.shortStaffed).toBe(false);
  });

  it("nhân sự: đề xuất đổi SĐT được duyệt thì hồ sơ cập nhật; điều chuyển sang trường khác", async () => {
    setSessionRole("teacher");
    const teacher = db().users.teacher.staffId;
    const school = db().staff.find((s) => s.id === teacher)!.schoolId;
    const submitted = await call<{ id: string; kind: string }>("POST", "/me/change-requests", { changes: { phone: "0987654321" } }, school);
    expect(submitted.data.kind).toBe("CONTACT");
    expect((await call("POST", `/staff/change-requests/${submitted.data.id}/approve`, {}, school)).status).toBe(403);

    setSessionRole("principal");
    expect((await call("POST", `/staff/change-requests/${submitted.data.id}/reject`, {}, school)).status).toBe(400);
    expect((await call("POST", `/staff/change-requests/${submitted.data.id}/approve`, {}, school)).status).toBe(200);
    expect(db().staff.find((s) => s.id === teacher)!.phone).toBe("0987654321");

    const other = db().schools.find((s) => s.id !== school)!;
    const staff = db().staff.find((s) => s.schoolId === school && ![teacher, db().users.principal.staffId].includes(s.id) && s.status === "ACTIVE")!;
    const today = new Date().toLocaleDateString("sv-SE");
    const moved = await call<{ schoolId: string }>("POST", `/staff/${staff.id}/transfer`, { schoolId: other.id, effectiveDate: today }, school);
    expect(moved.data, JSON.stringify(moved)).toMatchObject({ schoolId: other.id });
    const history = await call<{ assignments: { schoolId: string; toDate?: string }[] }>("GET", `/staff/${staff.id}/history`, undefined, other.id);
    expect(history.data.assignments.map((a) => a.schoolId)).toEqual([school, other.id]);
    resetDb(); // trả dữ liệu mẫu cho các test sau
  });

  it("chấm công: cấu hình theo ngày hiệu lực, ngày lễ riêng trường, import máy chấm công", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    const overview = await call<{ versions: { effectiveFrom: string }[] }>("GET", `/attendance/configs?schoolId=${school}`, undefined, school);
    expect(overview.data.versions).toHaveLength(1);
    const body = { schoolId: school, effectiveFrom: "2026-11-01", shiftStart: "07:00", shiftEnd: "16:30", lunchStart: "11:30", lunchEnd: "13:00", graceMinutes: 10, maxLateAllowed: 3, workingWeekdays: [1, 2, 3, 4, 5], halfDayWeekdays: [], annualLeaveDays: 14 };
    expect((await call("POST", "/attendance/configs", body, school)).status).toBe(200);
    expect((await call("POST", "/attendance/configs", body, school)).status).toBe(409);

    const added = await call<{ id: string }[]>("POST", "/holidays", { name: "Ngày hội trường", fromDate: "2026-11-20", schoolId: school }, school);
    expect(added.data).toHaveLength(1);
    const sheet = await call<{ days: { date: string; holiday?: string; working: boolean }[] }>("GET", "/attendance/staff?month=2026-11", undefined, school);
    expect(sheet.data.days.find((d) => d.date === "2026-11-20")!.holiday).toBe("Ngày hội trường");
    expect(sheet.data.days.find((d) => d.date === "2026-11-07")!.working).toBe(false); // thứ Bảy nghỉ theo cấu hình mới
    expect((await call("DELETE", `/holidays/${added.data[0].id}`, undefined, school)).status).toBe(204);

    const staff = db().staff.find((s) => s.schoolId === school && s.machineCode)!;
    const result = await call<{ matchedRows: number; autoFilled: number; discrepancyCount: number; unmatched: { machineCode: string }[] }>(
      "POST",
      "/attendance/imports",
      {
        month: "2026-11",
        rows: [
          { machineCode: staff.machineCode, workDate: "2026-11-02", checkIn: "07:20", checkOut: "16:40" },
          { machineCode: staff.machineCode, workDate: "2026-11-03", checkIn: "07:05" },
          { machineCode: "999", workDate: "2026-11-02", checkIn: "07:00", checkOut: "16:30" },
        ],
      },
      school,
    );
    expect(result.data).toMatchObject({ matchedRows: 2, autoFilled: 1, discrepancyCount: 1, unmatched: [{ machineCode: "999" }] });
    resetDb();
  });

  it("lương: tháng trước đã duyệt, giáo viên xem phiếu của mình; tháng chưa khóa công không tính được", async () => {
    const school = db().schools[0].id;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [y, m] = thisMonth.split("-").map(Number);
    const lastMonth = new Date(y, m - 2, 1).toLocaleDateString("sv-SE").slice(0, 7);
    setSessionRole("principal");
    const sheet = await call<{ status: string; rows: { netSalary: number }[]; totals: { netSalary: number } }>("GET", `/payroll/periods/${lastMonth}`, undefined, school);
    expect(sheet.data.status).toBe("APPROVED");
    expect(sheet.data.totals.netSalary).toBe(sheet.data.rows.reduce((s, r) => s + r.netSalary, 0));
    expect((await call("POST", `/payroll/periods/${thisMonth}/calculate`, undefined, school)).status).toBe(409);

    setSessionRole("teacher");
    expect((await call("GET", `/payroll/periods/${lastMonth}`, undefined, school)).status).toBe(403);
    const mine = await call<{ id: string }[]>("GET", "/me/payslips");
    expect(mine.data.length).toBeGreaterThan(0);
    expect((await call("GET", `/payroll/records/${mine.data[0].id}`)).status).toBe(200);
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

  it("học phí: sinh → phát hành → thu hai lần → đã thu đủ; sinh lại không trùng phiếu", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    type Row = { id: string; childId: string; status: string; balance: number };
    const list = async () => (await call<{ items: Row[] }>("GET", "/invoices?month=2026-10&size=100", undefined, school)).data.items;
    const first = await call<{ created: number }>("POST", "/invoices/generate", { month: "2026-10" }, school);
    expect(first.status).toBe(200);
    expect(first.data.created).toBeGreaterThan(0);
    await call("POST", "/invoices/generate", { month: "2026-10" }, school);
    const drafts = await list();
    expect(new Set(drafts.map((r) => r.childId)).size).toBe(drafts.length);
    const target = drafts[0];
    expect((await call("POST", "/invoices/issue", { month: "2026-10", ids: [target.id] }, school)).status).toBe(200);
    const issued = (await list()).find((r) => r.id === target.id)!;
    expect(issued.status).toBe("ISSUED");
    const half = Math.floor(issued.balance / 2);
    const pay = (amount: number) => call<{ invoice: Row }>("POST", `/invoices/${target.id}/payments`, { amount, method: "CASH", paidOn: "2026-09-30" }, school);
    expect((await pay(half)).data.invoice.status).toBe("PARTIAL");
    const done = await pay(issued.balance - half);
    expect(done.data.invoice.status).toBe("PAID");
    expect(done.data.invoice.balance).toBe(0);
  });

  it("thực đơn: giáo viên chỉ xem; sao chép tuần hỏi trước khi ghi đè; cảnh báo dị ứng liệt kê mọi trẻ có ghi chú", async () => {
    const school = db().schools[0].id;
    setSessionRole("teacher");
    const seen = await call<{ items: unknown[]; canEdit: boolean }>("GET", "/menus/week?weekStart=2026-09-28", undefined, school);
    expect(seen.data.items.length).toBeGreaterThan(0);
    expect(seen.data.canEdit).toBe(false);
    expect((await call("PUT", "/menus/week", { weekStart: "2026-09-28", items: [] }, school)).status).toBe(403);

    setSessionRole("principal");
    expect((await call("GET", "/menus/week?weekStart=2026-09-29", undefined, school)).status).toBe(400);
    const copy = (overwrite: boolean) => call("POST", "/menus/copy", { fromWeekStart: "2026-09-28", toWeekStart: "2026-10-05", overwrite }, school);
    expect((await copy(false)).status).toBe(409);
    const copied = await copy(true);
    expect(copied.status).toBe(200);
    expect((copied.data as { status: string }).status).toBe("DRAFT");

    type Warning = { allergyNote: string; matches: unknown[] };
    const warnings = (await call<Warning[]>("GET", "/menus/allergy-warnings?weekStart=2026-09-28", undefined, school)).data;
    const allergic = db().children.filter((c) => c.schoolId === school && c.allergies);
    expect(warnings).toHaveLength(allergic.length);
  });

  it("cân đo: lưu cả lớp, xếp kênh WHO; biểu đồ có đường chuẩn và số đo", async () => {
    setSessionRole("principal");
    const school = db().schools[0].id;
    const cls = db().classes.find((c) => c.schoolId === school)!;
    const child = db().children.find((c) => c.classId === cls.id)!;
    type Sheet = { rows: { childId: string; current?: { weightStatus?: string; standard?: string } }[] };
    const saved = await call<Sheet>("PUT", `/classes/${cls.id}/measurements`, { date: "2026-09-30", source: "CLASS", rows: [{ childId: child.id, weightKg: 9, heightCm: 100 }] }, school);
    expect(saved.status).toBe(200);
    const row = saved.data.rows.find((r) => r.childId === child.id)!;
    expect(row.current?.standard).toBeTruthy();
    expect(row.current?.weightStatus).toBe("SEVERE_UNDERWEIGHT");
    const health = await call<{ growth: { measurements: unknown[]; weightCurve: unknown[] } }>("GET", `/children/${child.id}/health`, undefined, school);
    expect(health.data.growth.measurements.length).toBeGreaterThan(0);
    expect(health.data.growth.weightCurve.length).toBeGreaterThan(24);
    expect((await call("PUT", `/classes/${cls.id}/measurements`, { date: "2026-10-30", source: "CLASS", rows: [{ childId: child.id, weightKg: 15, heightCm: 100 }] }, school)).status).toBe(400);
  });

  it("hiệu trưởng: \"Tất cả trường\" gộp số liệu, tạo trường mới, gán phó hiệu trưởng cần nhóm chức năng", async () => {
    setSessionRole("principal");
    const [a, b] = db().schools;
    const all = await call<{ chainView: boolean; schools: { schoolId: string }[]; totals: { children: number } }>("GET", "/reports/dashboard");
    expect(all.data.chainView).toBe(true);
    expect(all.data.schools.map((s) => s.schoolId)).toEqual([a.id, b.id]);
    const one = await call<{ totals: { children: number } }>("GET", "/reports/dashboard", undefined, a.id);
    expect(all.data.totals.children).toBeGreaterThan(one.data.totals.children);
    const approvals = await call<unknown[]>("GET", "/approvals");
    const approvalsA = await call<unknown[]>("GET", "/approvals", undefined, a.id);
    expect(approvals.data.length).toBeGreaterThanOrEqual(approvalsA.data.length);

    const created = await call<{ id: string; canEdit: boolean }>("POST", "/schools", { code: "MNV-MOI", name: "Trường Mới" });
    expect(created.data.canEdit).toBe(true);
    expect((await call<{ schools: { id: string }[] }>("GET", "/me")).data.schools.map((s) => s.id)).toContain(created.data.id);

    type Account = { id: string; principal: boolean; roles: { role: string; editable: boolean }[] };
    const accounts = (await call<{ items: Account[] }>("GET", "/accounts?size=100", undefined, a.id)).data.items;
    const target = accounts.find((x) => !x.principal && x.roles.some((r) => r.role === "TEACHER"))!;
    const vice = (groups: string[]) => call("PUT", `/accounts/${target.id}/roles`, { roles: [{ role: "VICE_PRINCIPAL", schoolId: a.id, functionGroups: groups }] }, a.id);
    expect((await vice([])).status).toBe(400);
    expect((await vice(["HR"])).status).toBe(200);
    const me = accounts.find((x) => x.principal)!;
    expect((await call("PUT", `/accounts/${me.id}/roles`, { roles: [{ role: "TEACHER", schoolId: a.id }] }, a.id)).status).toBe(403);

    setSessionRole("vice");
    expect((await call("GET", "/accounts", undefined, a.id)).status).toBe(403);
    expect((await call("POST", "/schools", { code: "X", name: "Y" })).status).toBe(403);
  });
});


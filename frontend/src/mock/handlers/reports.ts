import * as XLSX from "xlsx";
import type { components } from "@/api/schema";
import { db, type MeasurementRec } from "../db";
import { addDays, monthOf, shiftMonthStr } from "../dates";
import { balanceOf, isOpen } from "../finance";
import { type Ctx, FileBody, MockError, on } from "../router";
import { schoolStaff, today } from "./common";

type S = components["schemas"];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

function requireReports(ctx: Ctx) {
  if (!ctx.user.isBgh) throw new MockError(403, "Bạn không có quyền xem báo cáo.");
}

function latestMeasurements(schoolId: string, day: string) {
  const since = addDays(day, -183);
  const latest = new Map<string, MeasurementRec>();
  for (const m of db().measurements) {
    if (m.schoolId !== schoolId || m.measuredOn < since || m.measuredOn > day) continue;
    const prev = latest.get(m.childId);
    if (!prev || prev.measuredOn < m.measuredOn) latest.set(m.childId, m);
  }
  return [...latest.values()];
}

const abnormal = (m: S["MeasurementDto"]) => [m.weightStatus, m.heightStatus, m.bmiStatus].some((s) => s && s !== "NORMAL");

on("GET", "/reports/dashboard", (ctx) => {
  requireReports(ctx);
  const d = db();
  const day = today();
  const month = monthOf(day);
  const inScope = (schoolId: string) => ctx.schoolIds.includes(schoolId);
  const cash = (schoolIds: string[], from: string, to: string, direction: "IN" | "OUT") =>
    sum(d.cashEntries.filter((e) => schoolIds.includes(e.schoolId) && e.direction === direction && e.entryDate >= from && e.entryDate <= to).map((e) => e.amount));

  /** Chỉ số một trường (gộp nhiều trường thì cộng ở dòng tổng). */
  const metricsFor = (schoolId: string): S["SchoolMetrics"] => {
    const children = d.children.filter((c) => c.schoolId === schoolId);
    const ids = new Set(children.map((c) => c.id));
    const marks = Object.entries(d.childAttendance[day] ?? {}).filter(([id]) => ids.has(id));
    const present = marks.filter(([, m]) => m === "P").length;
    const open = d.invoices.filter((i) => i.schoolId === schoolId && isOpen(i) && balanceOf(i) > 0);
    return {
      schoolId,
      schoolName: d.schools.find((s) => s.id === schoolId)?.name ?? "",
      children: children.length,
      capacity: sum(d.classes.filter((c) => c.schoolId === schoolId).map((c) => c.capacity)),
      presentToday: present,
      absentToday: marks.length - present,
      attendanceRate: pct(present, children.length),
      staff: schoolStaff(schoolId).length,
      overdueTasks: d.tasks.filter((t) => t.schoolId === schoolId && t.status !== "DONE" && t.dueDate < day).length,
      growthAlerts: latestMeasurements(schoolId, day).filter(abnormal).length,
      receivable: sum(open.map(balanceOf)),
      overdueInvoices: open.filter((i) => i.dueDate && i.dueDate < day).length,
      income: cash([schoolId], `${month}-01`, `${month}-31`, "IN"),
      expense: cash([schoolId], `${month}-01`, `${month}-31`, "OUT"),
    };
  };
  const schools = ctx.schoolIds.map(metricsFor);
  const total = (key: keyof S["SchoolMetrics"]) => sum(schools.map((m) => Number(m[key] ?? 0)));
  const totals: S["SchoolMetrics"] = {
    schoolName: "Toàn bộ",
    children: total("children"),
    capacity: total("capacity"),
    presentToday: total("presentToday"),
    absentToday: total("absentToday"),
    attendanceRate: pct(total("presentToday"), total("children")),
    staff: total("staff"),
    overdueTasks: total("overdueTasks"),
    growthAlerts: total("growthAlerts"),
    receivable: total("receivable"),
    overdueInvoices: total("overdueInvoices"),
    income: total("income"),
    expense: total("expense"),
  };

  const childIds = new Set(d.children.filter((c) => inScope(c.schoolId)).map((c) => c.id));
  const attendanceTrend = Object.keys(d.childAttendance)
    .filter((date) => date <= day)
    .sort()
    .map((date) => {
      const values = Object.entries(d.childAttendance[date]).filter(([id]) => childIds.has(id));
      return { date, rate: pct(values.filter(([, m]) => m === "P").length, values.length), marked: values.length };
    })
    .filter((x) => x.marked > 0)
    .slice(-14)
    .map(({ date, rate }) => ({ date, rate }));

  const cashTrend = [-5, -4, -3, -2, -1, 0].map((k) => {
    const m = shiftMonthStr(month, k);
    return { month: `${m}-01`, income: cash(ctx.schoolIds, `${m}-01`, `${m}-31`, "IN"), expense: cash(ctx.schoolIds, `${m}-01`, `${m}-31`, "OUT") };
  });

  const latest = ctx.schoolIds.flatMap((id) => latestMeasurements(id, day));
  const count = (pred: (m: S["MeasurementDto"]) => boolean) => latest.filter(pred).length;
  const nutrition = [
    { status: "NORMAL", count: count((m) => !abnormal(m)) },
    { status: "UNDERWEIGHT", count: count((m) => m.weightStatus === "UNDERWEIGHT" || m.weightStatus === "SEVERE_UNDERWEIGHT") },
    { status: "STUNTED", count: count((m) => m.heightStatus === "STUNTED" || m.heightStatus === "SEVERE_STUNTED") },
    { status: "WASTED", count: count((m) => m.bmiStatus === "WASTED" || m.bmiStatus === "SEVERE_WASTED") },
    { status: "OVERWEIGHT", count: count((m) => m.bmiStatus === "OVERWEIGHT" || m.bmiStatus === "OBESE") },
  ];
  const tasks = d.tasks.filter((t) => inScope(t.schoolId));

  const result: S["Dashboard"] = {
    date: day,
    month: `${month}-01`,
    chainView: schools.length > 1,
    showOperations: true,
    showFinance: true,
    totals,
    schools,
    attendanceTrend,
    cashTrend,
    nutrition,
    tasks: (["NEW", "IN_PROGRESS", "WAITING_APPROVAL", "DONE"] as const).map((status) => ({ status, count: tasks.filter((t) => t.status === status).length })),
  };
  return result;
});

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sheetFile(title: string, sheetName: string, header: string[], rows: (string | number)[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[title], [], header, ...rows]), sheetName);
  return new FileBody(XLSX.write(book, { type: "array", bookType: "xlsx" }), XLSX_TYPE);
}

on("GET", "/reports/{name}/export", (ctx) => {
  requireReports(ctx);
  const month = ctx.query.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) throw new MockError(400, "Tháng không hợp lệ (định dạng yyyy-MM).");
  const d = db();
  const className = (id: string) => d.classes.find((c) => c.id === id)?.name ?? "";
  switch (ctx.params.name) {
    case "children":
      return sheetFile(
        "Danh sách trẻ đang học",
        "Danh sách trẻ",
        ["Lớp", "Mã trẻ", "Họ tên", "Ngày sinh", "Giới tính", "Dị ứng"],
        d.children
          .filter((c) => c.schoolId === ctx.schoolId)
          .sort((a, b) => className(a.classId).localeCompare(className(b.classId), "vi") || a.fullName.localeCompare(b.fullName, "vi"))
          .map((c) => [className(c.classId), c.code, c.fullName, c.dob, c.gender === "MALE" ? "Nam" : "Nữ", c.allergies ?? ""]),
      );
    case "receivables":
      return sheetFile(
        "Công nợ học phí",
        "Công nợ",
        ["Trẻ", "Lớp", "Số phiếu", "Còn nợ"],
        Object.values(
          d.invoices
            .filter((i) => i.schoolId === ctx.schoolId && isOpen(i) && balanceOf(i) > 0)
            .reduce<Record<string, (string | number)[]>>((acc, i) => {
              const child = d.children.find((c) => c.id === i.childId);
              const row = (acc[i.childId] ??= [child?.fullName ?? "", child ? className(child.classId) : "", 0, 0]);
              row[2] = Number(row[2]) + 1;
              row[3] = Number(row[3]) + balanceOf(i);
              return acc;
            }, {}),
        ),
      );
    case "staff-attendance":
    case "payroll":
      return sheetFile(
        ctx.params.name === "payroll" ? `Bảng lương tháng ${month}` : `Bảng công tháng ${month}`,
        ctx.params.name === "payroll" ? "Bảng lương" : "Bảng công",
        ["Họ tên", "Chức vụ"],
        schoolStaff(ctx.schoolId).map((s) => [s.fullName, s.position]),
      );
    default:
      throw new MockError(404, "Không có báo cáo này.");
  }
});

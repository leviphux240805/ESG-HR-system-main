import type { AgeGroup, Dashboard, TaskStatus } from "@/api/contracts";
import { db } from "../db";
import { addDays, ageMonths, isWorkDay, monthOf, range, shiftMonthStr } from "../dates";
import { nutritionStatus } from "../growth";
import { on, requireBgh } from "../router";
import { schoolStaff, today } from "./common";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

on("GET", "/reports/dashboard", (ctx) => {
  requireBgh(ctx);
  const d = db();
  const children = d.children.filter((c) => c.schoolId === ctx.schoolId);
  const classes = d.classes.filter((c) => c.schoolId === ctx.schoolId);
  const ids = new Set(children.map((c) => c.id));
  const from30 = addDays(today(), -30);

  const attendanceByDay = Object.entries(d.childAttendance)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, marks]) => {
      const values = Object.entries(marks).filter(([id]) => ids.has(id));
      return { date, rate: pct(values.filter(([, m]) => m === "P").length, values.length) };
    })
    .filter((x) => x.rate > 0);

  const attendanceByClass = classes.map((cls) => {
    const kids = new Set(children.filter((c) => c.classId === cls.id).map((c) => c.id));
    let total = 0;
    let present = 0;
    for (const [date, marks] of Object.entries(d.childAttendance)) {
      if (date < from30) continue;
      for (const [id, m] of Object.entries(marks)) {
        if (!kids.has(id)) continue;
        total += 1;
        if (m === "P") present += 1;
      }
    }
    return { className: cls.name, rate: pct(present, total) };
  });

  const month = monthOf(today());
  const months = [shiftMonthStr(month, -2), shiftMonthStr(month, -1), month];
  const feesByMonth = months.map((m) => {
    const invoices = d.invoices.filter((i) => i.schoolId === ctx.schoolId && i.month === m);
    const total = invoices.reduce((s, i) => s + i.lines.reduce((x, l) => x + l.amount, 0), 0);
    const collected = invoices.reduce((s, i) => s + i.payments.reduce((x, p) => x + p.amount, 0), 0);
    return { month: m, collected, outstanding: total - collected };
  });

  const enrollmentByAge = (["NHA_TRE", "MAM", "CHOI", "LA"] as AgeGroup[]).map((ageGroup) => {
    const classIds = new Set(classes.filter((c) => c.ageGroup === ageGroup).map((c) => c.id));
    return { ageGroup, count: children.filter((c) => classIds.has(c.classId)).length };
  });

  const nutritionCounts = new Map<string, number>();
  for (const child of children) {
    const latest = d.growth.filter((g) => g.childId === child.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) continue;
    const status = nutritionStatus(child.gender, ageMonths(child.dob, latest.date), latest.heightCm, latest.weightKg)[0];
    nutritionCounts.set(status, (nutritionCounts.get(status) ?? 0) + 1);
  }

  const staffIds = new Set(schoolStaff(ctx.schoolId).map((s) => s.id));
  const staffLeaveByMonth = months.map((m) => ({
    month: m,
    days: d.leaves
      .filter((l) => l.status === "APPROVED" && staffIds.has(l.staffId))
      .reduce((s, l) => s + (l.halfDay ? (monthOf(l.fromDate) === m ? 0.5 : 0) : range(l.fromDate, l.toDate).filter((x) => monthOf(x) === m && isWorkDay(x)).length), 0),
  }));

  const tasks = (["NEW", "IN_PROGRESS", "WAITING_APPROVAL", "DONE"] as TaskStatus[]).map((status) => ({
    status,
    count: d.tasks.filter((t) => t.schoolId === ctx.schoolId && t.status === status).length,
  }));

  const recent = attendanceByDay.filter((x) => x.date >= from30);
  const current = feesByMonth[feesByMonth.length - 1];
  const result: Dashboard = {
    attendanceByDay,
    attendanceByClass,
    feesByMonth,
    enrollmentByAge,
    nutrition: [...nutritionCounts.entries()].map(([label, count]) => ({ label, count })),
    staffLeaveByMonth,
    tasks,
    kpis: {
      children: children.length,
      staff: staffIds.size,
      attendanceRate: recent.length ? Math.round((recent.reduce((s, x) => s + x.rate, 0) / recent.length) * 10) / 10 : 0,
      collectionRate: pct(current.collected, current.collected + current.outstanding),
    },
  };
  return result;
});

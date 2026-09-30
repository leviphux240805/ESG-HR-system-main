import type { GrowthChart, GrowthRow, WeekMenu } from "../types";
import { db, type MenuRec } from "../db";
import { addDays, ageMonths, weekStart } from "../dates";
import { nutritionStatus, referenceSeries } from "../growth";
import { MockError, newId, notFound, on, requireBgh } from "../router";
import { today } from "./common";
import { visibleClasses } from "./school";

const toWeek = (m: MenuRec): WeekMenu => ({ id: m.id, weekStart: m.weekStart, days: m.days });

on("GET", "/menus", (ctx) => {
  const ws = weekStart(ctx.query.get("week") ?? today());
  let menu = db().menus.find((m) => m.schoolId === ctx.schoolId && m.weekStart === ws);
  if (!menu) {
    // Tuần chưa lên thực đơn: trả khung trống để BGH nhập
    menu = { id: newId(), schoolId: ctx.schoolId, weekStart: ws, days: [0, 1, 2, 3, 4].map((k) => ({ date: addDays(ws, k), breakfast: "", lunch: [], snack: "" })) };
    db().menus.push(menu);
  }
  return toWeek(menu);
});

on("PUT", "/menus/{id}/days/{date}", (ctx) => {
  requireBgh(ctx);
  const menu = db().menus.find((m) => m.id === ctx.params.id && m.schoolId === ctx.schoolId);
  if (!menu) notFound("thực đơn");
  const day = menu.days.find((d) => d.date === ctx.params.date);
  if (!day) notFound("ngày");
  const { breakfast, lunch, snack } = ctx.body ?? {};
  day.breakfast = String(breakfast ?? "").trim();
  day.lunch = ((lunch ?? []) as string[]).map((x) => x.trim()).filter(Boolean);
  day.snack = String(snack ?? "").trim();
  return toWeek(menu);
});

function childFor(ctxClasses: Set<string>, childId: string) {
  const child = db().children.find((c) => c.id === childId);
  if (!child || !ctxClasses.has(child.classId)) notFound("hồ sơ trẻ");
  return child;
}

on("GET", "/growth", (ctx) => {
  const classes = visibleClasses(ctx);
  const classId = ctx.query.get("classId") ?? classes[0]?.id;
  if (!classes.some((c) => c.id === classId)) notFound("lớp");
  return db()
    .children.filter((c) => c.classId === classId)
    .map<GrowthRow>((c) => {
      const latest = db().growth.filter((g) => g.childId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        childId: c.id,
        fullName: c.fullName,
        gender: c.gender,
        ageMonths: ageMonths(c.dob, today()),
        latest,
        status: latest ? nutritionStatus(c.gender, ageMonths(c.dob, latest.date), latest.heightCm, latest.weightKg) : [],
      };
    });
});

on("GET", "/growth/{childId}", (ctx) => {
  const child = childFor(new Set(visibleClasses(ctx).map((c) => c.id)), ctx.params.childId);
  const measurements = db()
    .growth.filter((g) => g.childId === child.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ ...m, ageMonths: ageMonths(child.dob, m.date) }));
  const now = ageMonths(child.dob, today());
  const from = Math.max(24, now - 12);
  const to = Math.min(72, now + 6);
  const last = measurements[measurements.length - 1];
  const chart: GrowthChart = {
    child: { id: child.id, fullName: child.fullName, gender: child.gender, dob: child.dob, className: db().classes.find((c) => c.id === child.classId)?.name ?? "" },
    measurements,
    weightRef: referenceSeries("weight", child.gender, from, to),
    heightRef: referenceSeries("height", child.gender, from, to),
    status: last ? nutritionStatus(child.gender, last.ageMonths, last.heightCm, last.weightKg) : [],
  };
  return chart;
});

on("POST", "/growth", (ctx) => {
  const { childId, date, heightCm, weightKg } = ctx.body ?? {};
  const child = childFor(new Set(visibleClasses(ctx).map((c) => c.id)), childId);
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!(h >= 60 && h <= 140)) throw new MockError(400, "Chiều cao phải trong khoảng 60–140 cm.");
  if (!(w >= 6 && w <= 45)) throw new MockError(400, "Cân nặng phải trong khoảng 6–45 kg.");
  if (!date || date > today()) throw new MockError(400, "Ngày cân đo không hợp lệ.");
  db().growth = db().growth.filter((g) => !(g.childId === child.id && g.date === date));
  const m = { id: newId(), childId: child.id, date, heightCm: +h.toFixed(1), weightKg: +w.toFixed(1) };
  db().growth.push(m);
  return m;
});

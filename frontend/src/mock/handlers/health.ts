import type { components } from "@/api/schema";
import { fileUrl } from "../files";
import { db, type DishRec, type HealthLogRec, type MeasurementRec, type MenuItemRec, type MenuRec } from "../db";
import { addDays, weekday } from "../dates";
import { ageInMonths, classify, curve } from "../growth";
import { type Ctx, MockError, matches, newId, notFound, nowIso, on, paginate } from "../router";
import { today } from "./common";
import { visibleClasses } from "./school";

type S = components["schemas"];
type Meal = S["MenuItemDto"]["meal"];

const MEAL_ORDER: Meal[] = ["BREAKFAST", "LUNCH", "AFTERNOON", "SNACK"];

// ------------------------------------------------------------ quyền (khớp HealthAccess của backend, theo vai trò demo)

const canEditMenu = (ctx: Ctx) => ctx.user.isBgh;

function requireEditMenu(ctx: Ctx) {
  if (!canEditMenu(ctx)) throw new MockError(403, "Bạn không có quyền sửa thực đơn ở cơ sở này.");
}

const classIds = (ctx: Ctx) => new Set(visibleClasses(ctx).map((c) => c.id));

function requireClass(ctx: Ctx, classId: string) {
  const cls = visibleClasses(ctx).find((c) => c.id === classId);
  if (!cls) notFound("lớp");
  return cls;
}

function requireChild(ctx: Ctx, childId: string) {
  const child = db().children.find((c) => c.id === childId && c.schoolId === ctx.schoolId);
  if (!child || !classIds(ctx).has(child.classId)) notFound("hồ sơ trẻ");
  return child;
}

// ------------------------------------------------------------ món ăn

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
const visibleDishes = (ctx: Ctx) => db().dishes.filter((d) => d.shared || d.schoolId === ctx.schoolId);
const toDish = (ctx: Ctx, d: DishRec): S["DishDto"] => ({ ...d, canEdit: !d.shared && canEditMenu(ctx) });

on("GET", "/dishes", (ctx) => {
  const q = ctx.query.get("q");
  const shared = ctx.query.get("shared");
  const active = ctx.query.get("active");
  const list = visibleDishes(ctx)
    .filter((d) => (shared ? String(d.shared) === shared : true) && (active ? String(d.active) === active : true))
    .filter((d) => matches(q, d.name, ...d.ingredients.map((i) => i.name)))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((d) => toDish(ctx, d));
  return paginate(list, ctx.query);
});

function applyDish(dish: DishRec, body: S["DishRequest"]) {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new MockError(400, "Vui lòng nhập tên món.");
  if (db().dishes.some((d) => d.id !== dish.id && d.schoolId === dish.schoolId && fold(d.name) === fold(name)))
    throw new MockError(409, "Đã có món cùng tên.");
  Object.assign(dish, {
    name,
    ingredients: (body.ingredients ?? []).map((i) => ({ name: i.name.trim(), grams: i.grams })),
    kcal: body.kcal,
    proteinG: body.proteinG,
    fatG: body.fatG,
    carbG: body.carbG,
    active: body.active ?? true,
  });
}

on("POST", "/dishes", (ctx) => {
  if (ctx.body?.shared) throw new MockError(403, "Chỉ hiệu trưởng sửa được món dùng chung trong tổ chức.");
  requireEditMenu(ctx);
  const dish: DishRec = { id: newId(), schoolId: ctx.schoolId, shared: false, name: "", ingredients: [], active: true };
  applyDish(dish, ctx.body);
  db().dishes.push(dish);
  return toDish(ctx, dish);
});

function editableDish(ctx: Ctx, id: string) {
  const dish = visibleDishes(ctx).find((d) => d.id === id);
  if (!dish) notFound("món ăn");
  if (dish.shared) throw new MockError(403, "Chỉ hiệu trưởng sửa được món dùng chung trong tổ chức.");
  requireEditMenu(ctx);
  return dish;
}

on("PUT", "/dishes/{id}", (ctx) => {
  const dish = editableDish(ctx, ctx.params.id);
  applyDish(dish, ctx.body);
  return toDish(ctx, dish);
});

on("DELETE", "/dishes/{id}", (ctx) => {
  const dish = editableDish(ctx, ctx.params.id);
  if (db().menuItems.some((i) => i.dishId === dish.id)) throw new MockError(409, "Món đã có trong thực đơn, hãy chuyển sang ngừng dùng thay vì xóa.");
  db().dishes = db().dishes.filter((d) => d.id !== dish.id);
});

// ------------------------------------------------------------ thực đơn tuần

function requireMonday(week: string | null | undefined): string {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week) || weekday(week) !== 1) throw new MockError(400, "Tuần phải bắt đầu từ thứ Hai.");
  return week;
}

const findMenu = (schoolId: string, ageGroupId: string | undefined, weekStart: string) =>
  db().menus.find((m) => m.schoolId === schoolId && (m.ageGroupId ?? undefined) === ageGroupId && m.weekStart === weekStart);

const itemsOf = (menuId: string) =>
  db()
    .menuItems.filter((i) => i.menuId === menuId)
    .sort((a, b) => a.date.localeCompare(b.date) || MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal) || a.orderNo - b.orderNo);

/** Từ khóa ghi chú dị ứng (bản demo của AllergyMatcher). */
function keywords(note: string | undefined): string[] {
  if (!note?.trim()) return [];
  return fold(note)
    .split(/[,;/.\n()]+|\s+va\s+|\s+hoac\s+/)
    .map((k) => k.trim().replace(/^(di ung voi|di ung|khong an duoc|khong an|kieng an|kieng)\s+/, "").replace(/[^a-z0-9 ]+/g, " ").trim())
    .filter((k) => k.length >= 2);
}

const hit = (words: string[], name: string) => {
  const padded = ` ${fold(name).replace(/[^a-z0-9]+/g, " ").trim()} `;
  return words.some((k) => padded.includes(` ${k} `));
};

function warnings(ctx: Ctx, ageGroupId: string | undefined, items: MenuItemRec[]): S["AllergyWarning"][] {
  const ageCode = db().ageGroups.find((a) => a.id === ageGroupId)?.code;
  return db()
    .children.filter((c) => c.schoolId === ctx.schoolId && c.allergies?.trim())
    .filter((c) => !ageCode || db().classes.find((k) => k.id === c.classId)?.ageGroup === ageCode)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))
    .map((c) => {
      const words = keywords(c.allergies);
      const found: S["AllergyMatch"][] = [];
      for (const i of items) {
        const dish = db().dishes.find((d) => d.id === i.dishId);
        if (!dish) continue;
        const ingredient = dish.ingredients.find((x) => hit(words, x.name))?.name ?? (hit(words, dish.name) ? dish.name : undefined);
        if (ingredient) found.push({ date: i.date, meal: i.meal, dishName: dish.name, ingredient });
      }
      return { childId: c.id, childName: c.fullName, className: db().classes.find((k) => k.id === c.classId)?.name, allergyNote: c.allergies!, matches: found };
    });
}

function weekDto(ctx: Ctx, weekStart: string, ageGroupId: string | undefined, menu: MenuRec | undefined): S["MenuWeekDto"] {
  const items = menu ? itemsOf(menu.id) : [];
  const dishOf = (id: string) => db().dishes.find((d) => d.id === id);
  // Số suất: trẻ có mặt theo điểm danh; chưa điểm danh thì theo sĩ số (khối của thực đơn nếu có)
  const kids = db().children.filter((c) => {
    const cls = db().classes.find((k) => k.id === c.classId);
    return cls?.schoolId === ctx.schoolId && (!ageGroupId || `ag-${cls.ageGroup}` === ageGroupId);
  });
  const portions = (date: string) => {
    const marks = db().childAttendance[date] ?? {};
    const marked = kids.filter((k) => marks[k.id]);
    return marked.length
      ? { portions: marked.filter((k) => marks[k.id] === "P").length, portionsFinal: date < today(), portionsEstimated: false }
      : { portions: kids.length, portionsFinal: false, portionsEstimated: true };
  };
  const totals = new Map<string, S["DayNutrition"]>();
  for (const i of items) {
    const d = dishOf(i.dishId);
    const t = totals.get(i.date) ?? { date: i.date, kcal: 0, proteinG: 0, fatG: 0, carbG: 0, ...portions(i.date) };
    totals.set(i.date, { ...t, kcal: t.kcal + (d?.kcal ?? 0), proteinG: t.proteinG + (d?.proteinG ?? 0), fatG: t.fatG + (d?.fatG ?? 0), carbG: t.carbG + (d?.carbG ?? 0) });
  }
  return {
    id: menu?.id,
    schoolId: ctx.schoolId,
    ageGroupId,
    weekStart,
    status: menu?.status ?? "DRAFT",
    note: menu?.note,
    publishedAt: menu?.publishedAt,
    items: items.map((i) => ({ id: i.id, date: i.date, meal: i.meal, dishId: i.dishId, dishName: dishOf(i.dishId)?.name ?? "", orderNo: i.orderNo, note: i.note, kcal: dishOf(i.dishId)?.kcal })),
    days: [...totals.values()].sort((a, b) => a.date.localeCompare(b.date)),
    allergyAlerts: warnings(ctx, ageGroupId, items).filter((w) => w.matches.length > 0).length,
    canEdit: canEditMenu(ctx),
  };
}

on("GET", "/menus/week", (ctx) => {
  const week = requireMonday(ctx.query.get("weekStart"));
  const ageGroupId = ctx.query.get("ageGroupId") ?? undefined;
  return weekDto(ctx, week, ageGroupId, findMenu(ctx.schoolId, ageGroupId, week));
});

function ensureMenu(ctx: Ctx, ageGroupId: string | undefined, week: string): MenuRec {
  let menu = findMenu(ctx.schoolId, ageGroupId, week);
  if (!menu) {
    menu = { id: newId(), schoolId: ctx.schoolId, ageGroupId, weekStart: week, status: "DRAFT" };
    db().menus.push(menu);
  }
  return menu;
}

on("PUT", "/menus/week", (ctx) => {
  requireEditMenu(ctx);
  const body = ctx.body as S["SaveMenuRequest"];
  const week = requireMonday(body?.weekStart);
  const end = addDays(week, 6);
  for (const i of body.items ?? []) {
    if (i.date < week || i.date > end) throw new MockError(400, "Ngày của món nằm ngoài tuần đang sửa.");
    if (!visibleDishes(ctx).some((d) => d.id === i.dishId)) throw new MockError(400, "Món ăn không hợp lệ hoặc đã ngừng dùng.");
  }
  const menu = ensureMenu(ctx, body.ageGroupId ?? undefined, week);
  menu.note = body.note ?? undefined;
  db().menuItems = db().menuItems.filter((i) => i.menuId !== menu.id);
  const order = new Map<string, number>();
  const seen = new Set<string>();
  for (const i of body.items ?? []) {
    const key = `${i.date}|${i.meal}|${i.dishId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const no = (order.get(`${i.date}|${i.meal}`) ?? 0) + 1;
    order.set(`${i.date}|${i.meal}`, no);
    db().menuItems.push({ id: newId(), menuId: menu.id, date: i.date, meal: i.meal, dishId: i.dishId, orderNo: no, note: i.note });
  }
  return weekDto(ctx, week, menu.ageGroupId, menu);
});

on("POST", "/menus/copy", (ctx) => {
  requireEditMenu(ctx);
  const body = ctx.body as S["CopyMenuRequest"];
  const from = requireMonday(body?.fromWeekStart);
  const to = requireMonday(body?.toWeekStart);
  if (from === to) throw new MockError(400, "Tuần nguồn và tuần đích phải khác nhau.");
  const ageGroupId = body.ageGroupId ?? undefined;
  const source = findMenu(ctx.schoolId, ageGroupId, from);
  const items = source ? itemsOf(source.id) : [];
  if (!items.length) throw new MockError(400, "Tuần nguồn chưa có thực đơn để sao chép.");
  const target = ensureMenu(ctx, ageGroupId, to);
  if (itemsOf(target.id).length && !body.overwrite) throw new MockError(409, "Tuần đích đã có thực đơn. Chọn ghi đè nếu muốn thay thế.", "MENU_NOT_EMPTY");
  const shift = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  db().menuItems = db().menuItems.filter((i) => i.menuId !== target.id);
  for (const i of items) db().menuItems.push({ ...i, id: newId(), menuId: target.id, date: addDays(i.date, shift) });
  Object.assign(target, { status: "DRAFT", publishedAt: undefined, note: source!.note });
  return weekDto(ctx, to, ageGroupId, target);
});

function publish(ctx: Ctx, value: boolean) {
  const menu = db().menus.find((m) => m.id === ctx.params.id && m.schoolId === ctx.schoolId);
  if (!menu) notFound("thực đơn");
  requireEditMenu(ctx);
  if (value && !itemsOf(menu.id).length) throw new MockError(400, "Thực đơn chưa có món nào.");
  Object.assign(menu, value ? { status: "PUBLISHED", publishedAt: nowIso() } : { status: "DRAFT", publishedAt: undefined });
  return weekDto(ctx, menu.weekStart, menu.ageGroupId, menu);
}

on("POST", "/menus/{id}/publish", (ctx) => publish(ctx, true));
on("POST", "/menus/{id}/unpublish", (ctx) => publish(ctx, false));

on("GET", "/menus/allergy-warnings", (ctx) => {
  const week = requireMonday(ctx.query.get("weekStart"));
  const ageGroupId = ctx.query.get("ageGroupId") ?? undefined;
  const menu = findMenu(ctx.schoolId, ageGroupId, week);
  return warnings(ctx, ageGroupId, menu ? itemsOf(menu.id) : []);
});

// ------------------------------------------------------------ cân đo

const measurementDto = ({ schoolId: _s, classId: _c, ...m }: MeasurementRec): S["MeasurementDto"] => m;

function sheet(ctx: Ctx, classId: string, date: string): S["ClassMeasurementSheet"] {
  const cls = requireClass(ctx, classId);
  const rows = db()
    .children.filter((c) => c.classId === cls.id && c.enrolledOn <= date)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))
    .map<S["MeasurementRow"]>((c) => {
      const list = db().measurements.filter((m) => m.childId === c.id).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
      const current = list.find((m) => m.measuredOn === date);
      const previous = list.filter((m) => m.measuredOn < date).pop();
      return { childId: c.id, childCode: c.code, fullName: c.fullName, gender: c.gender, dob: c.dob, current: current && measurementDto(current), previous: previous && measurementDto(previous) };
    });
  return { classId: cls.id, className: cls.name, date, canEdit: true, rows };
}

on("GET", "/classes/{classId}/measurements", (ctx) => sheet(ctx, ctx.params.classId, ctx.query.get("date") ?? today()));

on("PUT", "/classes/{classId}/measurements", (ctx) => {
  const body = ctx.body as S["SaveMeasurementsRequest"];
  const cls = requireClass(ctx, ctx.params.classId);
  if (body.date > today()) throw new MockError(400, "Không nhập cân đo cho ngày trong tương lai.");
  for (const r of body.rows ?? []) {
    const child = db().children.find((c) => c.id === r.childId && c.classId === cls.id);
    if (!child) throw new MockError(400, "Có trẻ không thuộc lớp vào ngày cân đo.");
    if (!(r.weightKg >= 1 && r.weightKg <= 99) || !(r.heightCm >= 40 && r.heightCm <= 199)) throw new MockError(400, "Cân nặng hoặc chiều cao không hợp lệ.");
    const existing = db().measurements.find((m) => m.childId === child.id && m.measuredOn === body.date);
    const record: MeasurementRec = {
      id: existing?.id ?? newId(),
      schoolId: child.schoolId,
      classId: cls.id,
      childId: child.id,
      measuredOn: body.date,
      weightKg: r.weightKg,
      heightCm: r.heightCm,
      source: body.source,
      note: r.note,
      recordedByName: ctx.user.staff.fullName,
      ...classify(child.gender, child.dob, body.date, r.weightKg, r.heightCm),
    };
    db().measurements = [...db().measurements.filter((m) => m.id !== record.id), record];
  }
  return sheet(ctx, cls.id, body.date);
});

on("DELETE", "/measurements/{id}", (ctx) => {
  const m = db().measurements.find((x) => x.id === ctx.params.id && classIds(ctx).has(x.classId));
  if (!m) notFound("lần cân đo");
  db().measurements = db().measurements.filter((x) => x.id !== m.id);
});

// ------------------------------------------------------------ hồ sơ sức khỏe một trẻ

const logDto = (ctx: Ctx, { schoolId: _s, ...l }: HealthLogRec): S["HealthLogDto"] => ({ ...l, canEdit: !!l.classId && classIds(ctx).has(l.classId) });

on("GET", "/children/{childId}/health", (ctx) => {
  const child = requireChild(ctx, ctx.params.childId);
  const measurements = db()
    .measurements.filter((m) => m.childId === child.id)
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn))
    .map(measurementDto);
  const maxMonth = Math.min(96, Math.max(24, Math.ceil(ageInMonths(child.dob, today())) + 6));
  return {
    growth: {
      childId: child.id,
      fullName: child.fullName,
      gender: child.gender,
      dob: child.dob,
      measurements,
      weightCurve: curve("WFA", child.gender, maxMonth),
      heightCurve: curve("HFA", child.gender, maxMonth),
      bmiCurve: curve("BFA", child.gender, maxMonth),
      canEdit: true,
    },
    checkups: db()
      .checkups.filter((c) => c.childId === child.id)
      .sort((a, b) => b.checkupDate.localeCompare(a.checkupDate))
      .map(({ schoolId: _s, ...c }) => c),
    recentLogs: db()
      .healthLogs.filter((l) => l.childId === child.id)
      .sort((a, b) => b.logDate.localeCompare(a.logDate))
      .slice(0, 20)
      .map((l) => logDto(ctx, l)),
    allergyNote: child.allergies,
    healthNote: child.healthNote,
    canEditCheckups: ctx.user.isBgh,
  } satisfies S["ChildHealth"];
});

on("POST", "/children/{childId}/checkups", (ctx) => {
  const child = requireChild(ctx, ctx.params.childId);
  if (!ctx.user.isBgh) throw new MockError(403, "Chỉ y tế, hiệu trưởng ghi được kết quả khám.");
  const body = ctx.body as S["CheckupRequest"];
  if (!body?.summary?.trim()) throw new MockError(400, "Vui lòng nhập kết luận.");
  const checkup = { id: newId(), schoolId: child.schoolId, childId: child.id, checkupDate: body.checkupDate, provider: body.provider, summary: body.summary.trim(), fileId: body.fileId };
  db().checkups.push(checkup);
  return checkup;
});

on("GET", "/checkups/{id}/file-url", (ctx) => {
  const checkup = db().checkups.find((c) => c.id === ctx.params.id && ctx.schoolIds.includes(c.schoolId));
  if (!checkup?.fileId) notFound("biên bản khám");
  return { url: fileUrl(checkup.fileId), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
});

on("DELETE", "/checkups/{id}", (ctx) => {
  if (!ctx.user.isBgh) throw new MockError(403, "Chỉ y tế, hiệu trưởng xóa được kết quả khám.");
  db().checkups = db().checkups.filter((c) => !(c.id === ctx.params.id && c.schoolId === ctx.schoolId));
});

// ------------------------------------------------------------ sổ theo dõi

on("GET", "/health-logs", (ctx) => {
  const visible = classIds(ctx);
  const [from, to, classId, childId, type, q] = ["from", "to", "classId", "childId", "type", "q"].map((k) => ctx.query.get(k));
  const list = db()
    .healthLogs.filter((l) => l.schoolId === ctx.schoolId && !!l.classId && visible.has(l.classId))
    .filter((l) => (!from || l.logDate >= from) && (!to || l.logDate <= to) && (!classId || l.classId === classId) && (!childId || l.childId === childId) && (!type || l.type === type))
    .filter((l) => matches(q, l.childName, l.content))
    .sort((a, b) => b.logDate.localeCompare(a.logDate))
    .map((l) => logDto(ctx, l));
  return paginate(list, ctx.query);
});

function applyLog(ctx: Ctx, log: HealthLogRec, body: S["HealthLogRequest"]) {
  if (!body?.content?.trim()) throw new MockError(400, "Vui lòng nhập nội dung.");
  if (body.logDate > today()) throw new MockError(400, "Không ghi sổ cho ngày trong tương lai.");
  Object.assign(log, { logDate: body.logDate, type: body.type, content: body.content.trim(), temperatureC: body.temperatureC });
  if (body.parentNotified && !log.parentNotifiedAt) Object.assign(log, { parentNotifiedAt: nowIso(), parentNotifiedByName: ctx.user.staff.fullName });
  if (body.parentNotified === false) Object.assign(log, { parentNotifiedAt: undefined, parentNotifiedByName: undefined });
}

on("POST", "/health-logs", (ctx) => {
  const body = ctx.body as S["HealthLogRequest"];
  const child = requireChild(ctx, body?.childId);
  const log: HealthLogRec = {
    id: newId(),
    schoolId: child.schoolId,
    childId: child.id,
    childName: child.fullName,
    classId: child.classId,
    className: db().classes.find((c) => c.id === child.classId)?.name,
    logDate: today(),
    type: "OTHER",
    content: "",
    recordedByName: ctx.user.staff.fullName,
  };
  applyLog(ctx, log, body);
  db().healthLogs.push(log);
  return logDto(ctx, log);
});

function editableLog(ctx: Ctx, id: string) {
  const log = db().healthLogs.find((l) => l.id === id && l.schoolId === ctx.schoolId && !!l.classId && classIds(ctx).has(l.classId));
  if (!log) notFound("ghi chép");
  return log;
}

on("PUT", "/health-logs/{id}", (ctx) => {
  const log = editableLog(ctx, ctx.params.id);
  applyLog(ctx, log, ctx.body);
  return logDto(ctx, log);
});

on("POST", "/health-logs/{id}/notify-parent", (ctx) => {
  const log = editableLog(ctx, ctx.params.id);
  if (!log.parentNotifiedAt) Object.assign(log, { parentNotifiedAt: nowIso(), parentNotifiedByName: ctx.user.staff.fullName });
  return logDto(ctx, log);
});

on("DELETE", "/health-logs/{id}", (ctx) => {
  const log = editableLog(ctx, ctx.params.id);
  db().healthLogs = db().healthLogs.filter((l) => l.id !== log.id);
});

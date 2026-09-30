import * as XLSX from "xlsx";
import type { components } from "@/api/schema";
import { POSITION_LABELS } from "@/features/staff/labels";
import { db, type DemoDB, type StaffRec } from "../db";
import { addDays } from "../dates";
import { type Ctx, FileBody, MockError, matches, newId, notFound, on, paginate, requireBgh } from "../router";
import { today } from "./common";

type S = components["schemas"];

const isPrincipal = (ctx: Ctx) => ctx.user.role === "principal";

function toDetail(s: StaffRec, ctx: Ctx): S["StaffDetail"] {
  const self = s.id === ctx.user.staff.id;
  return {
    ...s,
    permissions: {
      canEdit: isPrincipal(ctx) || self,
      canTerminate: isPrincipal(ctx) && !self,
      canTransfer: false,
      // Hiệu trưởng xem lương là cấu hình, mặc định tắt
      canViewSalary: false,
      canManageSalary: false,
      isSelf: self,
    },
  };
}

function contractEnd(staffId: string): string | undefined {
  return db()
    .contracts[staffId]?.map((c) => c.endDate)
    .filter(Boolean)
    .sort()
    .pop();
}

function toItem(s: StaffRec): S["StaffListItem"] {
  return {
    id: s.id,
    staffCode: s.staffCode,
    fullName: s.fullName,
    phone: s.phone,
    position: s.position,
    schoolId: s.schoolId,
    schoolName: s.schoolName,
    startDate: s.startDate,
    status: s.status,
    contractEndDate: contractEnd(s.id),
  };
}

/** Nhân viên xem được: BGH thấy cơ sở đang chọn; ai cũng xem được hồ sơ của mình. */
function requireStaff(ctx: Ctx, id: string): StaffRec {
  const s = db().staff.find((x) => x.id === id);
  if (!s || (s.id !== ctx.user.staff.id && (!ctx.user.isBgh || s.schoolId !== ctx.schoolId))) notFound("hồ sơ");
  return s;
}

function requireEdit(ctx: Ctx, id: string): StaffRec {
  const s = requireStaff(ctx, id);
  if (!toDetail(s, ctx).permissions.canEdit) throw new MockError(403, "Bạn không có quyền sửa hồ sơ này.");
  if (s.status !== "ACTIVE") throw new MockError(409, "Nhân viên đã nghỉ việc, không sửa được hồ sơ.");
  return s;
}

function filtered(ctx: Ctx): StaffRec[] {
  requireBgh(ctx);
  const q = ctx.query.get("q");
  const position = ctx.query.get("position");
  const status = ctx.query.get("status");
  const expiring = ctx.query.get("contractExpiring") === "true";
  const ids = ctx.query.getAll("ids");
  const limit = addDays(today(), 30);
  return db().staff.filter(
    (s) =>
      s.schoolId === ctx.schoolId &&
      (!ids.length || ids.includes(s.id)) &&
      (!position || s.position === position) &&
      (!status || s.status === status) &&
      (!expiring || (contractEnd(s.id) ?? "9999") <= limit) &&
      matches(q, s.fullName, s.staffCode, s.phone),
  );
}

on("GET", "/staff", (ctx) =>
  paginate(filtered(ctx).map(toItem), ctx.query, {
    staffCode: (s) => s.staffCode,
    fullName: (s) => s.fullName.split(" ").pop() + s.fullName,
    position: (s) => POSITION_LABELS[s.position],
    startDate: (s) => s.startDate,
  }),
);

function expiringItems(ctx: Ctx, within: number): S["ExpiringItem"][] {
  const limit = addDays(today(), within);
  const out: S["ExpiringItem"][] = [];
  const days = (d: string) => Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86_400_000);
  for (const s of db().staff.filter((x) => x.schoolId === ctx.schoolId && x.status === "ACTIVE")) {
    const base = { staffId: s.id, staffName: s.fullName, staffCode: s.staffCode, schoolId: s.schoolId, schoolName: s.schoolName };
    for (const c of db().contracts[s.id] ?? []) {
      if (c.endDate && c.endDate <= limit) out.push({ ...base, kind: "CONTRACT", recordId: c.id, title: `Hợp đồng ${c.contractNo ?? ""}`.trim(), expiryDate: c.endDate, daysLeft: days(c.endDate), tab: "contracts" });
    }
    for (const c of db().certificates[s.id] ?? []) {
      if (c.expiryDate && c.expiryDate <= limit) out.push({ ...base, kind: "CERTIFICATE", recordId: c.id, title: c.name, expiryDate: c.expiryDate, daysLeft: days(c.expiryDate), tab: "qualifications" });
    }
  }
  return out.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

on("GET", "/staff/summary", (ctx) => {
  const active = filtered(ctx).filter((s) => s.status === "ACTIVE");
  const byPosition: Record<string, number> = {};
  for (const s of active) byPosition[s.position] = (byPosition[s.position] ?? 0) + 1;
  return { total: active.length, byPosition, expiringDocuments: expiringItems(ctx, 30).length };
});

on("GET", "/staff/expiring-documents", (ctx) => {
  requireBgh(ctx);
  const kind = ctx.query.get("kind");
  return paginate(expiringItems(ctx, Number(ctx.query.get("within") ?? 30)).filter((i) => !kind || i.kind === kind), ctx.query);
});

on("GET", "/staff/change-requests", (ctx) => {
  requireBgh(ctx);
  return paginate([], ctx.query);
});

on("GET", "/staff/export", (ctx) => {
  const rows = filtered(ctx).map((s) => ({
    "Mã NV": s.staffCode,
    "Họ tên": s.fullName,
    "Vị trí": POSITION_LABELS[s.position],
    "Ngày sinh": s.dob,
    "Điện thoại": s.phone,
    Email: s.email,
    "Ngày vào làm": s.startDate,
    "Hạn hợp đồng": contractEnd(s.id) ?? "",
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Nhân sự");
  return new FileBody(XLSX.write(book, { type: "array", bookType: "xlsx" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

on("GET", "/staff/{id}", (ctx) => toDetail(requireStaff(ctx, ctx.params.id), ctx));

on("GET", "/me/staff", (ctx) => toDetail(ctx.user.staff, ctx));

on("PUT", "/staff/{id}", (ctx) => {
  const s = requireEdit(ctx, ctx.params.id);
  if (!ctx.body?.fullName?.trim()) throw new MockError(400, "Vui lòng nhập họ tên.");
  const { photoFileId: _photo, ...fields } = ctx.body as S["StaffFields"];
  Object.assign(s, fields);
  return toDetail(s, ctx);
});

on("POST", "/staff/check-duplicates", (ctx) => {
  const { phone, citizenId, email } = ctx.body ?? {};
  const duplicates: S["FieldIssue"][] = [];
  const others = db().staff;
  if (phone && others.some((s) => s.phone === phone)) duplicates.push({ field: "phone", message: "Số điện thoại đã có trong hệ thống." });
  if (citizenId && others.some((s) => s.citizenId === citizenId)) duplicates.push({ field: "citizenId", message: "Số CCCD đã có trong hệ thống." });
  if (email && others.some((s) => s.email === email)) duplicates.push({ field: "email", message: "Email đã có trong hệ thống." });
  return { duplicates };
});

on("POST", "/staff", (ctx) => {
  if (!isPrincipal(ctx)) throw new MockError(403, "Chỉ hiệu trưởng được thêm nhân viên.");
  const { schoolId, fields } = ctx.body as S["CreateStaffRequest"];
  if (!ctx.user.schoolIds.includes(schoolId)) throw new MockError(403, "Bạn không có quyền với cơ sở này.");
  const school = db().schools.find((x) => x.id === schoolId)!;
  const no = db().staff.length + 1;
  const { photoFileId: _photo, ...rest } = fields;
  const rec: StaffRec = { ...rest, id: newId(), staffCode: `NV${String(no).padStart(3, "0")}`, schoolId, schoolName: school.name, status: "ACTIVE" };
  db().staff.push(rec);
  for (const key of ["contracts", "certificates", "trainings", "dependents"] as const) db()[key][rec.id] = [];
  return toDetail(rec, ctx);
});

on("POST", "/staff/{staffId}/terminate", (ctx) => {
  const s = requireStaff(ctx, ctx.params.staffId);
  if (!toDetail(s, ctx).permissions.canTerminate) throw new MockError(403, "Bạn không có quyền cho nghỉ việc.");
  s.status = "TERMINATED";
  s.endDate = ctx.body?.endDate;
  s.terminationReason = ctx.body?.reason;
  return toDetail(s, ctx);
});

on("GET", "/staff/{staffId}/history", (ctx) => {
  const s = requireStaff(ctx, ctx.params.staffId);
  return {
    assignments: [{ id: `${s.id}-a`, schoolId: s.schoolId, schoolName: s.schoolName, fromDate: s.startDate, toDate: s.endDate, pending: false }],
    events: [],
    salaryConfigs: [],
  };
});

on("GET", "/staff/{staffId}/salary-configs", () => []);
on("GET", "/staff/{staffId}/documents", (ctx) => (requireStaff(ctx, ctx.params.staffId), []));
on("GET", "/staff/{staffId}/files/{fileId}/download-url", () => {
  throw new MockError(404, "Bản demo không lưu file thật.");
});

on("GET", "/document-types", () => [
  { id: "dt-cccd", code: "CCCD", name: "Căn cước công dân", category: "IDENTITY", hasExpiry: true },
  { id: "dt-sk", code: "GKSK", name: "Giấy khám sức khỏe", category: "HEALTH", hasExpiry: true },
  { id: "dt-bang", code: "BANG", name: "Bằng tốt nghiệp", category: "EDUCATION", hasExpiry: false },
  { id: "dt-qd", code: "QD", name: "Quyết định tuyển dụng", category: "DECISION", hasExpiry: false },
]);

// Hợp đồng, chứng chỉ, đào tạo, người phụ thuộc: cùng một kiểu CRUD
type Collection = "contracts" | "certificates" | "trainings" | "dependents";
const COLLECTIONS: [Collection, string][] = [
  ["contracts", "contractId"],
  ["certificates", "id"],
  ["trainings", "id"],
  ["dependents", "id"],
];

for (const [name, idKey] of COLLECTIONS) {
  type Item = DemoDB[typeof name][string][number];
  const list = (staffId: string) => (db()[name][staffId] ??= []) as Item[];
  const clean = (body: Record<string, unknown>) => {
    const { fileId: _file, ...rest } = body ?? {};
    return rest;
  };
  on("GET", `/staff/{staffId}/${name}`, (ctx) => list(requireStaff(ctx, ctx.params.staffId).id));
  on("POST", `/staff/{staffId}/${name}`, (ctx) => {
    const s = requireEdit(ctx, ctx.params.staffId);
    const item = { ...clean(ctx.body), id: newId() } as Item;
    list(s.id).push(item);
    return item;
  });
  on("PUT", `/staff/{staffId}/${name}/{${idKey}}`, (ctx) => {
    const s = requireEdit(ctx, ctx.params.staffId);
    const item = list(s.id).find((x) => x.id === ctx.params[idKey]);
    if (!item) notFound();
    Object.assign(item, clean(ctx.body));
    return item;
  });
  on("DELETE", `/staff/{staffId}/${name}/{${idKey}}`, (ctx) => {
    const s = requireEdit(ctx, ctx.params.staffId);
    (db()[name] as Record<string, Item[]>)[s.id] = list(s.id).filter((x) => x.id !== ctx.params[idKey]);
  });
}

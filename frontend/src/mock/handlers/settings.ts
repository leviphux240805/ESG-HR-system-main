import type { components } from "@/api/schema";
import { type DemoRole, db } from "../db";
import { type Ctx, MockError, matches, newId, notFound, on, paginate } from "../router";

type S = components["schemas"];
type Grant = { role: string; schoolId: string; functionGroups?: string[] };

// Bản demo của SchoolService + AccountAdminService: hiệu trưởng quản lý trường và tài khoản ở các trường mình.

const principalSchools = (ctx: Ctx) =>
  db().users[ctx.user.role].grants.filter((g) => g.role === "PRINCIPAL").map((g) => g.schoolId);

function requirePrincipal(ctx: Ctx) {
  if (principalSchools(ctx).length === 0) throw new MockError(403, "Chỉ hiệu trưởng được thực hiện thao tác này.");
}

// ------------------------------------------------------------ trường

const schoolDto = (ctx: Ctx, s: ReturnType<typeof db>["schools"][number]): S["SchoolDto"] => ({
  id: s.id,
  code: s.code,
  name: s.name,
  addressDetail: s.address,
  phone: s.phone,
  active: s.active !== false,
  canEdit: principalSchools(ctx).includes(s.id),
});

on("GET", "/schools", (ctx) => {
  const mine = new Set(db().users[ctx.user.role].grants.map((g) => g.schoolId));
  return db()
    .schools.filter((s) => mine.has(s.id))
    .map((s) => schoolDto(ctx, s));
});

function applySchool(ctx: Ctx, id: string | null, body: S["SchoolRequest"]) {
  const code = String(body?.code ?? "").trim();
  const name = String(body?.name ?? "").trim();
  if (!code || !name) throw new MockError(400, "Vui lòng nhập mã và tên trường.");
  if (db().schools.some((s) => s.id !== id && s.code.toLowerCase() === code.toLowerCase()))
    throw new MockError(409, "Mã trường đã được dùng.", "SCHOOL_CODE_EXISTS");
  return { code, name, address: body.addressDetail ?? "", phone: body.phone };
}

on("POST", "/schools", (ctx) => {
  requirePrincipal(ctx);
  const school = { id: newId(), ...applySchool(ctx, null, ctx.body), active: true };
  db().schools.push(school);
  db().users[ctx.user.role].grants.push({ role: "PRINCIPAL", schoolId: school.id });
  return schoolDto(ctx, school);
});

function editable(ctx: Ctx, id: string) {
  const school = db().schools.find((s) => s.id === id && db().users[ctx.user.role].grants.some((g) => g.schoolId === id));
  if (!school) notFound("trường");
  if (!principalSchools(ctx).includes(id)) throw new MockError(403, "Chỉ hiệu trưởng của trường được sửa trường này.");
  return school;
}

on("PUT", "/schools/{id}", (ctx) => {
  const school = editable(ctx, ctx.params.id);
  Object.assign(school, applySchool(ctx, school.id, ctx.body));
  return schoolDto(ctx, school);
});

function setActive(ctx: Ctx, active: boolean) {
  const school = editable(ctx, ctx.params.id);
  const activeMine = principalSchools(ctx).filter((id) => db().schools.find((s) => s.id === id)?.active !== false);
  if (!active && activeMine.length === 1 && activeMine[0] === school.id)
    throw new MockError(409, "Không ngừng được trường cuối cùng bạn đang quản lý.", "LAST_SCHOOL");
  school.active = active;
  return schoolDto(ctx, school);
}

on("POST", "/schools/{id}/deactivate", (ctx) => setActive(ctx, false));
on("POST", "/schools/{id}/activate", (ctx) => setActive(ctx, true));

// ------------------------------------------------------------ tài khoản

/** Vai trò của tài khoản: tài khoản demo lấy từ phiên đăng nhập giả, còn lại từ danh sách tài khoản. */
function grantsOf(staffId: string): { owner: DemoRole | null; grants: Grant[] } {
  const owner = (Object.keys(db().users) as DemoRole[]).find((r) => db().users[r].staffId === staffId) ?? null;
  if (owner) return { owner, grants: db().users[owner].grants };
  return { owner: null, grants: db().accounts.find((a) => a.staffId === staffId)?.roles ?? [] };
}

function accountItem(ctx: Ctx, account: ReturnType<typeof db>["accounts"][number]): S["AccountItem"] {
  const managed = principalSchools(ctx);
  const { grants } = grantsOf(account.staffId);
  const staff = db().staff.find((s) => s.id === account.staffId);
  const principal = grants.some((g) => g.role === "PRINCIPAL");
  return {
    id: account.id,
    email: account.email,
    phone: staff?.phone,
    fullName: staff?.fullName ?? account.email,
    active: account.active,
    mustChangePassword: account.mustChangePassword ?? false,
    roles: grants.map((g) => ({
      role: g.role as S["AccountRoleView"]["role"],
      schoolId: g.schoolId,
      schoolName: db().schools.find((s) => s.id === g.schoolId)?.name,
      functionGroups: (g.functionGroups ?? []) as S["AccountRoleView"]["functionGroups"],
      editable: !principal && managed.includes(g.schoolId),
    })),
    staffId: account.staffId,
    staffCode: staff?.staffCode,
    staffName: staff?.fullName,
    self: account.staffId === ctx.user.staff.id,
    principal,
  };
}

function managedAccount(ctx: Ctx, id: string) {
  const managed = principalSchools(ctx);
  const account = db().accounts.find((a) => a.id === id && grantsOf(a.staffId).grants.some((g) => managed.includes(g.schoolId)));
  if (!account) notFound("tài khoản");
  return account;
}

on("GET", "/accounts", (ctx) => {
  requirePrincipal(ctx);
  const managed = principalSchools(ctx);
  const role = ctx.query.get("role");
  const schoolId = ctx.query.get("schoolId");
  const active = ctx.query.get("active");
  const list = db()
    .accounts.map((a) => accountItem(ctx, a))
    .filter((a) => a.roles.some((r) => (schoolId ? r.schoolId === schoolId : managed.includes(r.schoolId)) && (!role || r.role === role)))
    .filter((a) => active === null || String(a.active) === active)
    .filter((a) => matches(ctx.query.get("q"), a.fullName, a.email, a.phone))
    .sort((x, y) => x.fullName.localeCompare(y.fullName, "vi"));
  return paginate(list, ctx.query);
});

function validateRoles(ctx: Ctx, roles: S["AccountRole"][]): Grant[] {
  const managed = principalSchools(ctx);
  if (!roles?.length) throw new MockError(400, "Cần gán ít nhất một vai trò.");
  return roles.map((r) => {
    if (r.role === "PRINCIPAL") throw new MockError(403, "Vai trò hiệu trưởng do bên vận hành gán.");
    if (!managed.includes(r.schoolId)) throw new MockError(403, "Bạn chỉ gán được vai trò ở trường mình làm hiệu trưởng.");
    if (r.role === "VICE_PRINCIPAL" && !r.functionGroups?.length) throw new MockError(400, "Phó hiệu trưởng cần ít nhất một nhóm chức năng.");
    return { role: r.role, schoolId: r.schoolId, ...(r.role === "VICE_PRINCIPAL" ? { functionGroups: [...r.functionGroups!] } : {}) };
  });
}

on("POST", "/accounts", (ctx) => {
  requirePrincipal(ctx);
  const body = ctx.body as S["CreateAccountRequest"];
  if (!body.staffId) throw new MockError(400, "Bản demo chỉ tạo tài khoản gắn với hồ sơ nhân viên.");
  if (!body.email && !body.phone) throw new MockError(400, "Cần email hoặc số điện thoại để đăng nhập.");
  if (db().accounts.some((a) => a.staffId === body.staffId)) throw new MockError(409, "Hồ sơ nhân viên đã có tài khoản đăng nhập.");
  const account = {
    id: newId(),
    staffId: body.staffId,
    email: body.email,
    active: true,
    mustChangePassword: true,
    roles: validateRoles(ctx, body.roles),
  };
  db().accounts.push(account);
  return accountItem(ctx, account);
});

on("PUT", "/accounts/{id}/roles", (ctx) => {
  const account = managedAccount(ctx, ctx.params.id);
  const { owner, grants } = grantsOf(account.staffId);
  if (grants.some((g) => g.role === "PRINCIPAL")) throw new MockError(403, "Vai trò của tài khoản hiệu trưởng do bên vận hành quản lý.");
  const managed = principalSchools(ctx);
  const next = [...grants.filter((g) => !managed.includes(g.schoolId)), ...validateRoles(ctx, ctx.body?.roles)];
  if (owner) db().users[owner].grants = next;
  else account.roles = next;
  return accountItem(ctx, account);
});

function setLocked(ctx: Ctx, active: boolean) {
  const account = managedAccount(ctx, ctx.params.id);
  if (!active && account.staffId === ctx.user.staff.id) throw new MockError(409, "Không tự khóa tài khoản của chính mình.", "SELF_LOCK");
  if (grantsOf(account.staffId).grants.some((g) => g.role === "PRINCIPAL")) throw new MockError(403, "Tài khoản hiệu trưởng do bên vận hành quản lý.");
  account.active = active;
  return accountItem(ctx, account);
}

on("POST", "/accounts/{id}/lock", (ctx) => setLocked(ctx, false));
on("POST", "/accounts/{id}/unlock", (ctx) => setLocked(ctx, true));
on("POST", "/accounts/{id}/password", (ctx) => {
  const account = managedAccount(ctx, ctx.params.id);
  if (grantsOf(account.staffId).grants.some((g) => g.role === "PRINCIPAL")) throw new MockError(403, "Mật khẩu tài khoản hiệu trưởng do bên vận hành quản lý.");
  account.mustChangePassword = true;
});

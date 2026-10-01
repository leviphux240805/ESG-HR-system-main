import { db, saveDb, type DemoRole, type StaffRec } from "./db";

/** Lỗi nghiệp vụ của API giả, trả về dạng RFC 7807 như backend thật. */
export class MockError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Trường trên header X-School-Id (đã kiểm tra thuộc phạm vi người dùng); không chọn thì là trường đầu tiên. */
  schoolId: string;
  /** Các trường đang xem: trường trên header, hoặc mọi trường được gán khi chọn "Tất cả trường". */
  schoolIds: string[];
  user: DemoUser;
}

export interface DemoUser {
  role: DemoRole;
  staff: StaffRec;
  schoolIds: string[];
  /** Hiệu trưởng hoặc phó hiệu trưởng */
  isBgh: boolean;
}

type Handler = (ctx: Ctx) => unknown;

const routes: { method: string; regex: RegExp; keys: string[]; handler: Handler }[] = [];

/** Khai báo route: `on("GET", "/staff/{id}", handler)` (tiền tố /api/v1 tự thêm). */
export function on(method: string, pattern: string, handler: Handler) {
  const keys: string[] = [];
  const source = pattern.replace(/\{(\w+)\}/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  routes.push({ method, regex: new RegExp(`^/api/v1${source}$`), keys, handler });
}

/** Trả file (Excel xuất ra) thay vì JSON. */
export class FileBody {
  constructor(
    readonly data: ArrayBuffer,
    readonly type: string,
  ) {}
}

// ---- Phiên đăng nhập giả ----

const SESSION_KEY = "mnv.demo.role";
let sessionRole: DemoRole | null = null;

export function getSessionRole(): DemoRole | null {
  if (sessionRole) return sessionRole;
  try {
    const stored = localStorage.getItem(SESSION_KEY) as DemoRole | null;
    if (stored === "principal" || stored === "vice" || stored === "teacher") sessionRole = stored;
  } catch {
    // bỏ qua
  }
  return sessionRole;
}

export function setSessionRole(role: DemoRole | null) {
  sessionRole = role;
  try {
    if (role) localStorage.setItem(SESSION_KEY, role);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // bỏ qua
  }
}

export function currentUser(): DemoUser | null {
  const role = getSessionRole();
  if (!role) return null;
  const user = db().users[role];
  const staff = db().staff.find((s) => s.id === user.staffId)!;
  return { role, staff, schoolIds: [...new Set(user.grants.map((g) => g.schoolId))], isBgh: role !== "teacher" };
}

export const DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(status: number, body: unknown): Response {
  if (body === undefined || status === 204) return new Response(null, { status: status === 200 ? 204 : status });
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function problem(status: number, detail: string, code?: string): Response {
  return new Response(JSON.stringify({ title: detail, detail, status, code }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

/**
 * `fetch` giả: định tuyến request tới handler trong bộ nhớ, trễ 300 ms như mạng thật. Thay bằng `fetch` thật khi
 * có backend (xem api/client.ts).
 */
export async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  await sleep(DELAY_MS);
  const url = new URL(request.url, window.location.origin);
  const route = routes.find((r) => r.method === request.method && r.regex.test(url.pathname));
  if (!route) return problem(501, "Bản demo chưa hỗ trợ chức năng này.");

  const user = currentUser();
  if (!user) return problem(401, "Vui lòng đăng nhập để tiếp tục.");
  const header = request.headers.get("X-School-Id");
  if (header && !user.schoolIds.includes(header)) return problem(403, "Bạn không có quyền với cơ sở này.");

  const match = url.pathname.match(route.regex)!;
  const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
  const text = request.method === "GET" ? "" : await request.text();
  try {
    const result = await route.handler({
      params,
      query: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
      schoolId: header ?? user.schoolIds[0],
      schoolIds: header ? [header] : user.schoolIds,
      user,
    });
    if (request.method !== "GET") saveDb();
    if (result instanceof FileBody) return new Response(result.data, { status: 200, headers: { "Content-Type": result.type } });
    return json(result === undefined && request.method === "POST" ? 204 : 200, result);
  } catch (error) {
    if (error instanceof MockError) return problem(error.status, error.message, error.code);
    console.error(error);
    return problem(500, "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.");
  }
}

// ---- Tiện ích cho handler ----

export function paginate<T>(items: T[], query: URLSearchParams, sortable: Record<string, (item: T) => string | number> = {}) {
  const page = Math.max(0, Number(query.get("page") ?? 0));
  const size = Math.min(100, Math.max(1, Number(query.get("size") ?? 20)));
  const [field, dir] = (query.get("sort") ?? "").split(",");
  let list = items;
  if (field && sortable[field]) {
    const key = sortable[field];
    const sign = dir === "desc" ? -1 : 1;
    list = [...items].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi")) * sign;
    });
  }
  return {
    items: list.slice(page * size, page * size + size),
    page,
    size,
    totalElements: list.length,
    totalPages: Math.max(1, Math.ceil(list.length / size)),
  };
}

/** Tìm không dấu, không phân biệt hoa thường. */
export function matches(q: string | null, ...values: (string | undefined)[]): boolean {
  if (!q) return true;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  const needle = norm(q.trim());
  return values.some((v) => v && norm(v).includes(needle));
}

export function requireBgh(ctx: Ctx) {
  if (!ctx.user.isBgh) throw new MockError(403, "Chỉ ban giám hiệu được thực hiện thao tác này.");
}

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function notFound(what = "dữ liệu"): never {
  throw new MockError(404, `Không tìm thấy ${what}.`);
}

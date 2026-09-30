import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";
import { ApiError, type Problem } from "./errors";

export type TokenResponse = components["schemas"]["TokenResponse"];

/** Bản demo: mọi request đi qua API giả trong trình duyệt (src/mock), không cần backend. Tắt bằng VITE_DEMO=false. */
export const DEMO = import.meta.env.VITE_DEMO !== "false";

const demoFetch: typeof fetch = async (input, init) => (await import("@/mock")).mockFetch(input, init);

/** Tên header chứa cơ sở đang chọn (khớp backend SchoolScope.HEADER). */
export const SCHOOL_HEADER = "X-School-Id";

const AUTH_PATH = "/api/v1/auth/";

// Access token chỉ nằm trong bộ nhớ; refresh token nằm trong cookie httpOnly do backend quản lý.
let accessToken: string | null = null;
let selectedSchoolId: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function hasAccessToken() {
  return accessToken !== null;
}

/** Cơ sở đang chọn trên header; null = "Tất cả cơ sở". */
export function setSelectedSchoolId(schoolId: string | null) {
  selectedSchoolId = schoolId;
}

/** Gọi khi refresh thất bại (phiên hết hạn) để AuthContext đưa người dùng về trang đăng nhập. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

/**
 * Đổi refresh token (cookie) lấy access token mới. Nhiều request cùng gặp 401 chỉ tạo MỘT lần refresh;
 * backend xoay vòng refresh token nên gọi song song sẽ bị coi là dùng lại token.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (DEMO) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${AUTH_PATH}refresh`, { method: "POST", credentials: "same-origin" });
        if (!res.ok) {
          accessToken = null;
          return false;
        }
        const body = (await res.json()) as TokenResponse;
        accessToken = body.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

const isAuthRequest = (url: string) => new URL(url, window.location.origin).pathname.startsWith(AUTH_PATH);

function withHeaders(request: Request): Request {
  if (isAuthRequest(request.url)) {
    // Không gửi access token cũ tới endpoint xác thực (token hết hạn làm backend trả 401)
    request.headers.delete("Authorization");
    return request;
  }
  if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
  if (selectedSchoolId && !request.headers.has(SCHOOL_HEADER)) {
    request.headers.set(SCHOOL_HEADER, selectedSchoolId);
  }
  return request;
}

// Bản sao request gốc để gửi lại sau khi refresh (body của request đã gửi không đọc lại được)
const retryCopies = new WeakMap<Request, Request>();

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const prepared = withHeaders(request);
    retryCopies.set(prepared, prepared.clone());
    return prepared;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || isAuthRequest(request.url)) return response;
    const copy = retryCopies.get(request);
    if (!copy || !(await refreshAccessToken())) {
      onSessionExpired?.();
      return response;
    }
    const retried = await fetch(withHeaders(copy));
    if (retried.status === 401) onSessionExpired?.();
    return retried;
  },
};

/** Client có type sinh từ OpenAPI (src/api/schema.d.ts, chạy `npm run gen:api` khi backend đổi API). */
export const api = createClient<paths>({ baseUrl: "", credentials: "same-origin", fetch: DEMO ? demoFetch : undefined });
api.use(authMiddleware);

type QueryValue = string | number | boolean | null | undefined;

/**
 * Gọi endpoint chưa có trong OpenAPI (module mới của bản demo), cùng header và xử lý lỗi như `api`.
 * Khi backend có endpoint thật: chạy `npm run gen:api` rồi chuyển sang `api.GET/POST…`.
 */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: { query?: Record<string, QueryValue>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const request = withHeaders(
    new Request(url, {
      method,
      credentials: "same-origin",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
  const response = await (DEMO ? demoFetch : fetch)(request);
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new ApiError(response.status, data as Problem | undefined);
  return data as T;
}

/**
 * Lấy `data` từ kết quả openapi-fetch, ném ApiError (thông điệp tiếng Việt) nếu lỗi.
 * Dùng trong queryFn/mutationFn của TanStack Query.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok) return result.data as T;
  throw new ApiError(result.response.status, result.error as Problem | undefined);
}

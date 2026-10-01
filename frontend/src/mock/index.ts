/**
 * API giả của bản demo (nạp lười, tách chunk). Mỗi handler giả lập một endpoint REST dưới /api/v1; khi có backend
 * thật, bỏ `fetch: demoFetch` trong api/client.ts là xong.
 */
import { configureDb } from "./db";
import { iso } from "./dates";
import { generateDb } from "./seed";
import "./handlers/core";
import "./handlers/school";
import "./handlers/leave";
import "./handlers/finance";
import "./handlers/staff";
import "./handlers/attendance";
import "./handlers/tasks";
import "./handlers/health";
import "./handlers/reports";
import "./handlers/settings";

configureDb(() => generateDb(new Date()), () => iso(new Date()));

export { getSessionRole, mockFetch, setSessionRole } from "./router";
export { resetDb } from "./db";

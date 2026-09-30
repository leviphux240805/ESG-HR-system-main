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

configureDb(() => generateDb(new Date()), () => iso(new Date()));

export { mockFetch } from "./router";
export { resetDb } from "./db";

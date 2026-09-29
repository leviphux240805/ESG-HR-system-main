# Frontend – Preschool Management

React 18 + Vite + TypeScript + shadcn/ui + TanStack Query. Cách chạy toàn bộ dự án: xem [README ở gốc repo](../README.md).

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server http://localhost:8080, proxy `/api` → backend (mặc định `http://localhost:8081`, đổi bằng `VITE_API_PROXY_TARGET`) |
| `npm run lint` | ESLint |
| `npm run build` | Kiểm tra kiểu (tsc) rồi build |
| `npm run gen:api` | Sinh `src/api/schema.d.ts` từ `openapi.json` (backend test ghi file này) |
| `npm test` | Vitest (hook, tiện ích, component) |
| `npm run e2e` | Playwright (luồng chính; cần compose + backend) |

## Khung giao diện

Quy ước bắt buộc: mục "Quy ước giao diện" trong `CLAUDE.md`. Tóm tắt:

- Menu, route, breadcrumb: `src/lib/navigation.ts` (một cấu hình duy nhất, lọc theo quyền và giai đoạn).
- Quyền giao diện: `src/lib/permissions.ts` + `useCan`; cơ sở đang chọn: `useCurrentSchool` (query key có cơ sở).
- Component dùng chung: `src/components/common/` (PageHeader, DataTable, FilterBar, FormSheet, ConfirmDialog,
  StatusBadge, EmptyState/ErrorState, FileUpload, ExportButton). Xem mẫu tại `/dev/ui` khi chạy dev.
- Định dạng: `src/lib/format.ts`; lỗi form từ API: `applyApiErrors` (`src/api/formErrors.ts`).

## Gọi API

- `src/api/client.ts`: client có type (`openapi-fetch`). Tự gắn access token và header `X-School-Id` (cơ sở đang
  chọn), gặp 401 thì refresh một lần rồi gửi lại. Không tự viết type trùng với DTO backend: dùng
  `components["schemas"][...]` trong `src/api/schema.d.ts`.
- Dùng `unwrap(await api.GET(...))` trong `queryFn`/`mutationFn`; lỗi là `ApiError` với thông điệp tiếng Việt
  (`errorMessage(error)` để hiện toast).
- `useAuth()`: người dùng hiện tại, vai trò, cơ sở đang chọn. `hasRole` chỉ để ẩn/hiện giao diện; quyền thật
  kiểm tra ở backend.

## Trang cũ từ ESG HR

Các trang Nhân viên, Chấm công, Bảng lương, Phiếu lương, Cài đặt, Dashboard vẫn còn trong `src/` nhưng chưa được
nối vào router vì còn gọi Supabase. Mỗi trang được chuyển sang API mới ở giai đoạn tương ứng (xem
`docs/tien-do.md`). Các file này tạm được nới quy tắc `no-explicit-any` trong `eslint.config.js`.

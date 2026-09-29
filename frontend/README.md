# Frontend – Preschool Management

React 18 + Vite + TypeScript + shadcn/ui + TanStack Query. Cách chạy toàn bộ dự án: xem [README ở gốc repo](../README.md).

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server http://localhost:8080, proxy `/api` → backend (mặc định `http://localhost:8081`, đổi bằng `VITE_API_PROXY_TARGET`) |
| `npm run lint` | ESLint |
| `npm run build` | Kiểm tra kiểu (tsc) rồi build |
| `npm run gen:api` | Sinh `src/api/schema.d.ts` từ `openapi.json` (backend test ghi file này) |

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

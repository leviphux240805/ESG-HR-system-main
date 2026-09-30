# Tiến độ

## Giai đoạn hiện tại: 2 – Nhân sự + Tài liệu (đang làm)

Kế hoạch 15 bước (S1–S15) duyệt ngày 2026-09-29; quyết định chốt ghi trong `thiet-ke.md` (commit `95df613`).

| # | Bước | Commit |
|---|---|---|
| S1 | Schema nhân sự (V3), danh mục giấy tờ, audit log, seed 12 nhân viên | `6ad552f` |
| S2 | API hồ sơ nhân viên, kiểm trùng CCCD/SĐT/email, tạo tài khoản kèm | `fea37a0` |
| S3 | Hợp đồng, người phụ thuộc, chứng chỉ, đào tạo, giấy tờ (phiên bản), link file theo hồ sơ | `d9749d0` |
| S4 | Lương (insert-only), ngân hàng, điều chuyển (cả ngày tương lai + job), nghỉ việc, lịch sử, xuất Excel | `0a88b84` |
| S5 | Giấy tờ sắp hết hạn, thông báo trong app, job 07:00 | `110bc88` |
| S6 | `/nhan-su` danh sách | `1312ccf` |
| S7 | `/nhan-su/moi` + quét QR CCCD | `5ff88d5` |
| S8 | `/nhan-su/:id` phần 1: thông tin (sửa trong tab), hợp đồng & quyết định, giấy tờ (phiên bản, xem trước), lịch sử | `0458c1f` |
| S9 | `/nhan-su/:id` phần 2: lương & phụ cấp, bảo hiểm & thuế, trình độ, phân công lớp (chờ GĐ5), điều chuyển, nghỉ việc | `9ed701f` |
| S10 | `/nhan-su/giay-to-het-han`, chuông thông báo trên header | `95bc028` |

Kiểm tra sau S10: frontend 57 test Vitest, 25 test Playwright (gồm luồng "xong" phần nhân sự: quét CCCD → hợp
đồng → điều chuyển → lịch sử), lint 0 lỗi, build xanh; backend không đổi từ S5 (78 test xanh).

Thử tay phần nhân sự (tài khoản trong README, mật khẩu `Matkhau@123`):

1. `admin@preschool.local`, chọn Cơ sở A → Nhân sự → Thêm nhân viên → Quét CCCD (ảnh mặt trước có mã QR) → chọn
   vị trí, ngày vào làm → Thêm. Trang chuyển tới hồ sơ; tab Giấy tờ có ảnh CCCD.
2. Tab Hợp đồng & quyết định → Thêm hợp đồng kèm PDF → bấm tên tệp để xem trước.
3. Nút Điều chuyển → Cơ sở B, hôm nay → header tự đổi sang Cơ sở B; tab Lịch sử có 2 giai đoạn công tác.
4. `0900000004` (hiệu trưởng A): không mở được hồ sơ vừa chuyển; hồ sơ khác không có tab Lương, không có nút
   Điều chuyển, có nút Cho nghỉ việc.
5. Thẻ "Giấy tờ hết hạn" ở /nhan-su → Nguyễn Thị Lan (hợp đồng còn 20 ngày) → bấm mở tab hợp đồng.

Việc tiếp theo: S11 (backend thư viện văn bản) → S12 → S13 → S14 → S15.

## Giai đoạn 1 – Nền tảng (xong, chờ nghiệm thu)

Kế hoạch duyệt ngày 2026-09-29. Quyết định đi kèm ghi ở mục "Nhật ký thay đổi thiết kế" trong `thiet-ke.md`.

### Đã xong

| # | Bước | Commit |
|---|---|---|
| 0 | Repo git, commit mốc mã ESG, `.gitignore`/`.gitattributes`, docs | `faa5ed7`, `50dce28` |
| B1 | Spring Boot 4.0.8 + docker-compose (postgres:18-alpine, chainguard/minio) + `.env.example` | `a123667` |
| B2 | Flyway V1 (9 bảng nền tảng) + entity JPA + seed dev (2 cơ sở, 8 tài khoản) | `42a13a3` |
| B3 | Lỗi RFC 7807 tiếng Việt + OpenAPI | `2931013` |
| B4+B5 | Auth (login email/SĐT, refresh xoay vòng, logout, `/me`) + SchoolScope, `X-School-Id`, Hibernate filter, `@perm` | `a5d3eb3` |
| B6 | Files: upload-url, complete (kiểm tra dung lượng + magic bytes), download-url qua MinIO | `bac134b` |
| B7 | Snapshot OpenAPI `frontend/openapi.json` + schema `Problem` | `d591147` |
| F1 | Gỡ lovable-tagger, proxy `/api`, lint xanh | `34a453d` |
| F2 | API client có type (openapi-typescript + openapi-fetch), tự refresh, build có typecheck | `1d47d79` |
| F3 | AuthContext + Login mới, route guard, ẩn trang cũ | `c7ba28c` |
| F4 | Header chọn cơ sở, Sidebar theo vai trò, đổi tên, menu điện thoại, trang "Tệp (thử nghiệm)" | `09afc30` |
| F5 | README, CI GitHub Actions, CLAUDE.md, tiến độ | `cedfb2d` |
| B8 | Quên mật khẩu qua email (V2 `password_reset_tokens`, Mailpit cho dev) | `419ef20` |
| F6 | Trang Quên mật khẩu / Đặt lại mật khẩu, khung `AuthLayout` dùng chung | commit cuối |

Kiểm tra cuối (2026-09-29): `./mvnw test` 44/44 xanh; `npm run lint` 0 lỗi; `npm run build` xanh. Đã chạy tay qua
proxy Vite: đăng nhập seed (email và SĐT), refresh bằng cookie, `/me`, upload → complete → tải file qua MinIO
(kể cả preflight CORS từ `localhost:8080`), user Cơ sở B tải file Cơ sở A bị 404.

### Khung giao diện dùng chung (làm sau giai đoạn 1, trước giai đoạn 2)

| # | Bước | Commit |
|---|---|---|
| U1 | Backend: `PageResponse` + quy ước phân trang (size ≤ 100), `/me.staffId` | `fe510c6` |
| U2 | Vitest + Testing Library | `7bce75a` |
| U3 | `format.ts`, ma trận quyền `permissions.ts` + `useCan`, `useCurrentSchool`/`schoolQueryKey`, `applyApiErrors` | `a8e128c` |
| U4 | Menu theo nhóm từ `navigation.ts`, route guard, trang 403, xem trước bằng `VITE_PREVIEW_MODULES` | `9e7cd75` |
| U5 | PageHeader, EmptyState/ErrorState/Skeleton, StatusBadge, ConfirmDialog, FormSheet | `674090b` |
| U6 | useListParams, FilterBar, DataTable, ExportButton | `4711979` (+ sửa `865d4ac`) |
| U7 | FileUpload/MultiFileUpload trên presigned URL | `3f036c8` |
| U8 | Trang mẫu `/dev/ui` (chỉ dev) | `80bb2a8` |
| U9 | Playwright 10 test luồng chính + job e2e trên CI | `abd216f` |
| U10 | "Quy ước giao diện" trong CLAUDE.md, README | commit cuối |

Kiểm tra: backend 51 test, frontend 44 test Vitest, 10 test Playwright (chạy trên máy với backend + MinIO + Mailpit
thật) đều xanh. Các đường dẫn module (/nhan-su, /luong, /cua-toi/…) đã có trong cấu hình menu, ẩn cho tới giai
đoạn tương ứng. `TODO(assumption)`: /cai-dat và /tai-khoan tạm xếp giai đoạn 2.

### Đang dở / chưa làm của giai đoạn 1

- Chủ dự án đã chạy thử giao diện (đăng nhập, bộ chọn cơ sở, trang Tệp) ngày 2026-09-29.
- Quên mật khẩu: backend đã thử với Mailpit thật (email tới đúng người, có link); trang đặt lại mật khẩu chưa
  được bấm thử trên trình duyệt.

### Giả định đang dùng (cần chủ dự án xác nhận)

- `TODO(assumption)` trong `FileService`: link tải file chung = người upload hoặc OWNER/CHAIN_ADMIN/PRINCIPAL. Từ
  giai đoạn 2 mỗi module (hồ sơ nhân viên, thư viện văn bản) tự kiểm tra quyền trên bản ghi gắn file.

### Ghi chú kỹ thuật cần nhớ

- Hibernate filter bật cho **mọi EntityManager** qua `SchoolFilterInitializer` (không phải lúc mở transaction):
  query method tự khai báo của Spring Data không mở transaction nên cách cũ bị lọt. Entity nghiệp vụ mới chỉ cần
  gắn `@Filter(name = SchoolFilter.NAME)`.
- Test chặn truy cập chéo cơ sở: kế thừa `ApiTestSupport`, dùng `TestData` tạo cơ sở/tài khoản riêng từng test.
- Jackson 3 (Boot 4) từ chối `null` cho kiểu nguyên thủy: DTO nhận JSON dùng `Boolean`/`Integer` cho trường tùy chọn.
- springdoc dọn schema chưa dùng trước khi chạy customizer: schema thêm bằng tay phải thêm trong customizer.
- Frontend không gửi `Authorization` tới `/api/v1/auth/*`; backend bỏ qua `X-School-Id` trên `/auth/*` và `/me`.
- Dòng `JWT_SECRET=` để trống trong `.env` ghi đè khóa mặc định dev bằng chuỗi rỗng; chỉ bỏ comment khi có giá trị.
- Git Bash tự đổi đường dẫn kiểu `/data` khi gọi `docker`; đặt `MSYS_NO_PATHCONV=1`.
- `chainguard/minio` chỉ có tag `latest` (không ghim được phiên bản); chỉ dùng cho dev/test.
- ESLint: các file cũ còn gọi Supabase được nới `no-explicit-any` (danh sách trong `eslint.config.js`); chuyển
  đổi xong file nào thì xóa khỏi danh sách.

### Phụ thuộc Supabase còn lại theo giai đoạn

| Giai đoạn | File |
|---|---|
| 2 | `hooks/useEmployee.ts`, `lib/fileUploader.ts`, `components/employees/shared/MultiDocumentUploadField.tsx` (+ dùng gián tiếp: `CCCDUploadModal`, `DocumentUploadField`, các tab nhân viên, `pages/Employees`) |
| 3 | `hooks/useAttendanceData.ts`, `lib/attendanceReconciliation.ts`, `components/attendance/AttendanceUploadModal.tsx`, `AttendanceConfigModal.tsx`, `pages/Attendance.tsx` |
| 4 | `hooks/usePayrollData.ts`, `pages/Payroll.tsx`, `pages/Payslips.tsx`, `api/send-salary-emails.ts`, `api/_lib/emailService.ts` |
| 7 | `pages/Dashboard.tsx`, `pages/Index.tsx` |

`lib/supabase.ts` và `@supabase/supabase-js` chỉ gỡ được khi các file trên đã chuyển xong.

### Việc tiếp theo

1. Chủ dự án chạy thử theo README (mục "Thử nhanh") và nghiệm thu giai đoạn 1 + khung giao diện.
2. Giai đoạn 2: xem bảng ở đầu tệp.

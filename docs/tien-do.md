# Tiến độ

## Giai đoạn hiện tại: 1 – Nền tảng

Kế hoạch đã duyệt ngày 2026-09-29. Quyết định đi kèm ghi ở mục "Nhật ký thay đổi thiết kế" trong `thiet-ke.md`.

### Đã xong

- Khảo sát frontend: 74 lời gọi Supabase trong 14 file, đã nhóm theo giai đoạn chuyển đổi (xem bảng dưới).
- Chốt quyết định: Spring Boot 4.0; đăng nhập bằng email hoặc SĐT; `files` có `school_id` + `status` + bước `complete`; quên mật khẩu làm sau cùng; `git init` mới, chưa có remote.
- Chuyển `thiet-ke.md` vào `docs/` và cập nhật theo các quyết định trên.

### Đang chặn

- Máy chưa có Java 21 và Git; Docker Desktop chưa chạy được vì WSL2 lỗi (`REGDB_E_CLASSNOTREG`). Cần cài trước khi làm Bước 0 và backend.

### Các bước giai đoạn 1

| # | Bước | Trạng thái |
|---|---|---|
| 0 | `git init`, commit mốc mã ESG, `.gitignore` gốc, docs | Chờ Git |
| B1 | Skeleton Spring Boot 4 + docker-compose (postgres, minio) + `.env.example` | Chờ Java, Docker |
| B2 | Flyway V1 (9 bảng nền tảng) + seed dev | |
| B3 | Lỗi RFC 7807 tiếng Việt + OpenAPI | |
| B4 | Auth: login (email/SĐT), refresh, logout, `/me` | |
| B5 | SchoolScope + `X-School-Id` + Hibernate `@Filter` + `@perm` | |
| B6 | Files: upload-url, complete, download-url (MinIO) | |
| B7 | Snapshot OpenAPI cho frontend | |
| F1 | Gỡ lovable-tagger, proxy `/api` | |
| F2 | API client có type (openapi-typescript + openapi-fetch) | |
| F3 | AuthContext + Login mới | |
| F4 | Header chọn cơ sở, Sidebar theo vai trò, đổi tên, ẩn trang cũ | |
| F5 | README, CI, cập nhật tiến độ | |

### Phụ thuộc Supabase còn lại theo giai đoạn

| Giai đoạn | File |
|---|---|
| 1 | `lib/supabase.ts`, `contexts/AuthContext.tsx`, `service/authService.ts`, `lib/authHelpers.ts`, `pages/Login.tsx` |
| 2 | `hooks/useEmployee.ts`, `lib/fileUploader.ts`, `components/employees/shared/MultiDocumentUploadField.tsx` (+ dùng gián tiếp: `CCCDUploadModal`, `DocumentUploadField`, các tab nhân viên, `pages/Employees`) |
| 3 | `hooks/useAttendanceData.ts`, `lib/attendanceReconciliation.ts`, `components/attendance/AttendanceUploadModal.tsx`, `AttendanceConfigModal.tsx`, `pages/Attendance.tsx` |
| 4 | `hooks/usePayrollData.ts`, `pages/Payroll.tsx`, `pages/Payslips.tsx`, `api/send-salary-emails.ts`, `api/_lib/emailService.ts` |
| 7 | `pages/Dashboard.tsx` |

`@supabase/supabase-js` chỉ gỡ được khi các file trên đã chuyển xong.

### Việc tiếp theo

Cài Java 21, Git, sửa WSL2/Docker → làm Bước 0 rồi B1.

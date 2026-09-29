# Tiến độ

## Giai đoạn hiện tại: 1 – Nền tảng

Kế hoạch đã duyệt ngày 2026-09-29. Quyết định đi kèm ghi ở mục "Nhật ký thay đổi thiết kế" trong `thiet-ke.md`.

### Đã xong

- Khảo sát frontend: 74 lời gọi Supabase trong 14 file, đã nhóm theo giai đoạn chuyển đổi (xem bảng dưới).
- Chốt quyết định: Spring Boot 4.0 (dùng 4.0.8); đăng nhập bằng email hoặc SĐT; `files` có `school_id` + `status` + bước `complete`; quên mật khẩu làm sau cùng; `git init` mới, chưa có remote.
- Môi trường: JDK Temurin 21, Git, Docker Desktop (WSL2) đã chạy.
- **Bước 0** (commit `faa5ed7`, `50dce28`): repo git, commit mốc mã ESG, `.gitignore`/`.gitattributes`, docs.
- **B1** (commit `a123667`): Spring Boot 4.0.8 + docker-compose (postgres:18-alpine, chainguard/minio) + `.env.example`.
- **B2** (commit `42a13a3`): Flyway V1 (9 bảng) + entity JPA + seed dev (2 cơ sở, 8 tài khoản).
- **B3** (commit `2931013`): lỗi RFC 7807 tiếng Việt + OpenAPI (bearer, header X-School-Id).

### Đang dở

- **B4 – Auth** (chưa commit): code + 15 test đã xong, `./mvnw test` xanh 27/27. Chưa chạy thử tay trên server dev và chưa commit vì shell tạm thời bị chặn.
- **B5 – SchoolScope** (chưa commit, **chưa chạy test**): `SchoolScopeFilter`, `SchoolScope`, `@perm`, Hibernate filter bật qua `SchoolScopedTransactionManager` (dùng `applyToLoadByKey` để lọc cả `findById`), test `SchoolScopeTests`. Cần chạy `./mvnw test`, sửa nếu đỏ, rồi commit B4 và B5 thành hai commit riêng.

### Các bước giai đoạn 1

| # | Bước | Trạng thái |
|---|---|---|
| 0 | `git init`, commit mốc mã ESG, `.gitignore` gốc, docs | Xong |
| B1 | Skeleton Spring Boot 4 + docker-compose (postgres, minio) + `.env.example` | Xong |
| B2 | Flyway V1 (9 bảng nền tảng) + seed dev | Xong |
| B3 | Lỗi RFC 7807 tiếng Việt + OpenAPI | Xong |
| B4 | Auth: login (email/SĐT), refresh, logout, `/me` | Code + test xanh, chờ commit |
| B5 | SchoolScope + `X-School-Id` + Hibernate `@Filter` + `@perm` | Code xong, chưa chạy test |
| B6 | Files: upload-url, complete, download-url (MinIO) | |
| B7 | Snapshot OpenAPI cho frontend | |
| F1 | Gỡ lovable-tagger, proxy `/api` | |
| F2 | API client có type (openapi-typescript + openapi-fetch) | |
| F3 | AuthContext + Login mới | |
| F4 | Header chọn cơ sở, Sidebar theo vai trò, đổi tên, ẩn trang cũ | |
| F5 | README, CI, cập nhật tiến độ | |

### Ghi chú kỹ thuật cần nhớ

- Git Bash tự đổi đường dẫn kiểu `/data` khi gọi `docker`; đặt `MSYS_NO_PATHCONV=1`.
- Jackson 3 (Boot 4) từ chối `null` cho kiểu nguyên thủy: DTO nhận JSON dùng `Boolean`/`Integer` cho trường tùy chọn.
- Frontend (F2): không gửi `Authorization` tới `/api/v1/auth/*` (token hết hạn làm endpoint công khai trả 401); backend đã bỏ qua `X-School-Id` trên `/auth/*` và `/me`.
- Dòng `JWT_SECRET=` để trống trong `.env` sẽ ghi đè khóa mặc định dev bằng chuỗi rỗng; chỉ bỏ comment khi có giá trị.

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

1. Chạy `./mvnw test` cho B5, sửa nếu đỏ.
2. Chạy thử tay đăng nhập seed + `/me`; commit B4, rồi commit B5.
3. B6 (files + MinIO), B7, rồi phần frontend F1–F5.

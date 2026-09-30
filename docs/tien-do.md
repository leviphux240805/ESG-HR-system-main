# Tiến độ

## Nhánh `demo` – bản giới thiệu khách hàng "Mầm Non Việt" (2026-09-30)

Chỉ frontend, API giả trong trình duyệt (`frontend/src/mock`); người dùng chính là ban giám hiệu. Không merge vào
`main`. Đã xong (mỗi trang một commit, `npm test`/lint/build xanh): lớp API giả + đăng nhập theo vai trò + Hôm nay +
Hộp duyệt; lớp học, hồ sơ trẻ, điểm danh (điện thoại); nhân sự; chấm công tháng, nghỉ phép; công việc (Kanban);
học phí; thực đơn tuần, cân đo; báo cáo. Đã gỡ Supabase và các trang ESG cũ trên nhánh này.

Chưa làm: e2e Playwright chưa chạy lại cho chế độ demo (các test cũ cần backend); cấu hình chấm công và import máy
chấm công bị ẩn; upload file trả "Bản demo chưa hỗ trợ". Việc dở trên `main`: W1 (backend công việc, chưa commit).

## Giai đoạn hiện tại: 3 – Chấm công, nghỉ phép, công việc (đang làm)

Kế hoạch 17 bước (C1–C11 chấm công/nghỉ phép, W1–W4 công việc, Z1 dọn legacy) duyệt ngày 2026-09-30; quyết định chốt
ghi trong `thiet-ke.md` (commit `ae38a2a`).

| # | Bước | Commit |
|---|---|---|
| C1 | Schema V5 (cấu hình theo cơ sở, import, bảng công ngày/tháng, khóa công, phép năm, đơn nghỉ), `staff.machine_code` | `fd86f49` |
| C2 | Bộ đối soát Java + test đối chiếu với bản TS cũ (golden JSON từ file Excel mẫu) | `9349137` |
| C3 | API cấu hình chấm công + ngày lễ | `1550e0f` |
| C4 | Import máy chấm công, đối soát, bảng công tháng, sửa ô, xử lý sai lệch | `7b23822` |
| C5 | Khóa/mở khóa công tháng, xuất Excel | `4a1d0ab` |
| C6+C7 | Đơn nghỉ (xin, duyệt, lịch nghỉ, phép năm), bảng công của tôi | `d8ffcc0` |
| C8 | `/cham-cong` lưới (ảo hóa hàng, sửa ô, sai lệch, tổng) | `a944010` |
| C9 | Import máy chấm công, xử lý sai lệch hàng loạt, khóa/mở khóa, xuất Excel | `9c8b4e7` |
| C10 | `/cham-cong/cau-hinh` (giờ ca theo ngày hiệu lực, ngày lễ) | `a14b824` |
| C11 | `/nghi-phep` (đơn của tôi, chờ duyệt, lịch nghỉ), `/cua-toi/cham-cong` | `05a4ba0` |

Kiểm tra sau C7: backend 119 test (gồm đối chiếu bản TS cũ trên file mẫu, duyệt đơn ghi đúng mã, tháng khóa không
sửa được, giáo viên không xem bảng công người khác); frontend 66 test Vitest, lint 0 lỗi, build xanh.

Đang chờ chủ dự án: file máy chấm công thật (đã ẩn tên) và mẫu bảng công muốn xuất, đặt vào `docs/mau/`. Hiện dùng
file giả lập `docs/mau/may-cham-cong-gia-lap-2026-09.xlsx` (sinh bằng `frontend/scripts/make-attendance-sample.cjs`).
Khi có file thật: sửa đường dẫn trong `frontend/src/lib/legacy/attendanceGolden.test.ts`, chạy
`GEN_GOLDEN=1 npx vitest run src/lib/legacy` rồi `./mvnw test`.

Ghi nhận khi đối chiếu (giữ đúng bản cũ theo quyết định): ngày HR chấm P/NL/NB/NN mà máy không có dữ liệu bị báo sai
lệch "Máy: Vắng mặt"; đi làm ngày lễ về trưa bị gợi ý 1/2K (bản cũ không biết ngày lễ). Có thể sửa ở giai đoạn sau.

Kiểm tra sau C11: backend 119 test; frontend 70 test Vitest, 40 test Playwright (gồm luồng "xong" (1) import file
mẫu → đối soát → khóa tháng và (2) giáo viên xin nghỉ trên điện thoại → hiệu trưởng duyệt → bảng công thành P).

Thử tay phần chấm công (tài khoản trong README):

1. `0900000004` (hiệu trưởng A) → Chấm công → tháng 9/2026 → "Import máy chấm công" → chọn
   `docs/mau/may-cham-cong-gia-lap-2026-09.xlsx` → xem mã 999 bị bỏ qua → "Import và đối soát" → "Xử lý sai lệch" →
   "Xác nhận tất cả" → "Khóa công"; ô chỉ xem được. `admin@preschool.local` (chọn Cơ sở A) → "Mở khóa công" + lý do.
2. `0900000005` (giáo viên A, trên điện thoại) → Nghỉ phép → "Xin nghỉ" → hiệu trưởng → Nghỉ phép › Chờ duyệt →
   "Duyệt" → ô bảng công thành P; giáo viên xem ở Của tôi › Chấm công của tôi.

Việc tiếp theo: W1 (backend công việc) → W2 (việc lặp lại, nhắc hạn) → W3 (/cong-viec) → W4 (/cua-toi/viec) → Z1.

## Giai đoạn 2 – Nhân sự + Tài liệu (xong, chờ nghiệm thu)

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
| S11 | Backend thư viện văn bản (V4: thư mục, văn bản, phiên bản, xác nhận đã đọc; nhắc 1 lần/ngày) | `a7315ca` |
| S12 | `/tai-lieu` (cây thư mục, ban hành, tỷ lệ đã đọc) và `/tai-lieu/:id` (xem trước, phiên bản, "Tôi đã đọc", nhắc) | `c1f9053` |
| S13 | `/cua-toi/ho-so`, `/cua-toi/van-ban`, đề xuất cập nhật hồ sơ + `/nhan-su/de-xuat` (duyệt theo loại) | `a50f707`, `d090151` |
| S14 | `/tai-khoan`: tạo, vai trò theo cơ sở, khóa/mở khóa, gửi đặt lại mật khẩu | `08ca6ae`, `4a1a1eb` |
| S15 | Dọn trang/hook nhân viên cũ (Supabase), bỏ quy tắc tải file tạm, README, nghiệm thu | commit cuối |

Kiểm tra cuối (2026-09-30): backend 94 test; frontend 64 test Vitest, 33 test Playwright; `npm run lint` 0 lỗi
(30 cảnh báo, đều ở file cũ chờ giai đoạn 3–4); `npm run build` xanh. Hai luồng "xong" có e2e:
`staff-lifecycle.spec.ts` (quét CCCD → hợp đồng → điều chuyển → lịch sử) và `library.spec.ts` (ban hành cần xác
nhận → giáo viên "Tôi đã đọc" → tỷ lệ tăng). Test bắt buộc: hiệu trưởng A không thấy nhân viên B
(`StaffApiTests`), hiệu trưởng không đọc lương kể cả trong lịch sử (`StaffLifecycleTests`), giáo viên chỉ xem hồ sơ
mình (`StaffApiTests`), điều chuyển giữ lịch sử (`StaffLifecycleTests`).

Thử tay: mục "Thử nhanh" trong README (bước 3–5). Backend đang chạy bằng mã cũ cần khởi động lại để chạy
migration V4 (thư viện văn bản).

### Giả định giai đoạn 2 (cần chủ dự án xác nhận)

- `TODO(assumption)` trong `AccountAdminService`: chỉ chủ chuỗi được gán/gỡ vai trò chủ chuỗi và khóa tài khoản
  chủ chuỗi (văn phòng điều hành không tự nâng quyền được).
- Đề xuất cập nhật: mỗi đề xuất chỉ một nhóm (liên hệ hoặc ngân hàng); còn đề xuất cùng nhóm đang chờ thì không gửi
  thêm. Người duyệt đúng theo quyết định chốt (chủ chuỗi không nằm trong danh sách duyệt).
- API file chung `/files/{id}/download-url` chỉ cho người upload; file đã gắn vào hồ sơ/văn bản tải qua endpoint
  của module (quyền theo bản ghi). Đã bỏ quy tắc tạm của giai đoạn 1.
- Trang "Hồ sơ của tôi" ẩn tab Lịch sử (nhật ký chỉnh sửa) và Phân công lớp.

### Việc tiếp theo

1. Chủ dự án nghiệm thu giai đoạn 2 theo README (Thử nhanh 3–5) và xác nhận các giả định trên.
2. Giai đoạn 3 – Chấm công, nghỉ phép, công việc: đọc thiết kế, lập kế hoạch, chờ duyệt.

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

- (Đã xử lý ở giai đoạn 2) quy tắc tạm tải file chung trong `FileService`.

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
| 3 | `hooks/useAttendanceData.ts`, `lib/attendanceReconciliation.ts`, `components/attendance/AttendanceUploadModal.tsx`, `AttendanceConfigModal.tsx`, `pages/Attendance.tsx` |
| 4 | `hooks/usePayrollData.ts`, `pages/Payroll.tsx`, `pages/Payslips.tsx`, `api/send-salary-emails.ts`, `api/_lib/emailService.ts` |

`lib/supabase.ts` và `@supabase/supabase-js` chỉ gỡ được khi các file trên đã chuyển xong. Giai đoạn 2 đã xóa
trang/hook nhân viên cũ và Dashboard cũ; `components/legacy/` giữ `DatePickerCustom`, `EditableCell` cho trang chấm
công, lương cũ.

### Việc tiếp theo

1. Chủ dự án chạy thử theo README (mục "Thử nhanh") và nghiệm thu giai đoạn 1 + khung giao diện.

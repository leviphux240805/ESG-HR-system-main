# Preschool Management — hướng dẫn cho Claude Code

## Dự án

- Web app quản lý **chuỗi trường mầm non cùng một chủ** (nhiều cơ sở), dựng lại từ app ESG HR cũ.
- Thiết kế đầy đủ nằm ở `docs/thiet-ke.md` (vai trò, module, 60 bảng, API, lộ trình). Đọc phần liên quan trước khi làm bất kỳ module nào.
- Không tự ý đổi quyết định thiết kế. Nếu thấy cần đổi: đề xuất, chờ đồng ý, rồi cập nhật `docs/thiet-ke.md` trước khi code.
- Tiến độ theo giai đoạn ghi ở `docs/tien-do.md` (tạo nếu chưa có).

## Quy tắc làm việc

- Trả lời tối thiểu: file đã đổi + bước tiếp theo. Không giải thích nếu không được hỏi.
- Chỉ đọc mục hoặc file được chỉ định, không đọc lại toàn bộ `docs/`.
- Code: tái sử dụng `components/ui` và component chung (`components/common`, `hooks`, `lib`), không lặp, không
  comment thừa, không thêm thư viện khi chưa hỏi.
- Mỗi trang: loading/empty/error, lọc và phân trang ở server, form zod, ẩn nút theo quyền (`useCan`), dữ liệu theo
  cơ sở đang chọn (`useCurrentSchool`), dùng được ở 360px.
- Mỗi API: test tích hợp chặn chéo cơ sở và test theo vai trò.
- Trang mới phải chạy được cả hai chế độ: dữ liệu thật (`VITE_DATA_SOURCE=api`) và demo (`mock`).
- Giao diện chỉ import từ `src/api`, không import thẳng `src/api/client` hay `src/mock`.
- Xong mỗi bước: `./mvnw test`, `npm run lint`, `npm run build` và `npm run build:demo` phải qua; commit.

## Cấu trúc repo

```
frontend/            React 18 + Vite + TypeScript + shadcn/ui + Tailwind + TanStack Query (fork từ ESG HR)
backend/             Java 21, Spring Boot 4.0, Maven, Spring Data JPA, Spring Security, Flyway
docker-compose.yml   postgres + minio cho môi trường dev
docs/                thiet-ke.md, tien-do.md
```

## Lệnh thường dùng

Cập nhật mục này khi lệnh thay đổi.

- Hạ tầng dev: `docker compose up -d` (PostgreSQL 5432, MinIO 9000/console 9001, Mailpit SMTP 1025/web 8025)
- Backend: `cd backend && ./mvnw spring-boot:run` (cổng 8081, profile `dev` có seed) · test: `./mvnw test` (cần Docker; đồng thời ghi `frontend/openapi.json`)
- Frontend: `cd frontend && npm install && npm run dev` (cổng 8080, proxy `/api` → 8081) · kiểm tra: `npm test && npm run lint && npm run build && npm run build:demo`
- Bản demo (dữ liệu giả, không cần backend): `npm run dev:demo`, hoặc `npm run demo` để build và xem thử (`dist-demo/`)
- E2E: compose + backend đang chạy, rồi `cd frontend && npm run e2e` (Playwright; lần đầu `npx playwright install chromium`)
- Xem trước menu các giai đoạn chưa làm (dev): `VITE_PREVIEW_MODULES=true npm run dev`; thư viện component: `/dev/ui`
- Đổi API: chạy `./mvnw test` rồi `cd frontend && npm run gen:api`, commit cả `openapi.json` và `src/api/schema.d.ts`
- Tài khoản dev: xem README (mật khẩu `Matkhau@123`)

## Quy tắc kiến trúc (bắt buộc)

1. **Phân tách theo cơ sở:** mọi bảng nghiệp vụ có `school_id` (rỗng = dùng chung toàn chuỗi). Frontend gửi cơ sở đang chọn qua header `X-School-Id`; backend nạp `SchoolScope` từ JWT + `user_roles`, từ chối cơ sở ngoài scope và bật Hibernate `@Filter` theo `school_id` cho mọi truy vấn.
2. **Mỗi endpoint mới phải có test tích hợp** chứng minh user cơ sở A không đọc/sửa được dữ liệu cơ sở B (403/404). Dùng Testcontainers PostgreSQL.
3. **Quyền kiểm tra ở backend** (`@PreAuthorize`, service). Frontend chỉ ẩn/hiện menu, không phải lớp bảo vệ.
4. **Tính toán nghiệp vụ ở backend:** đối soát chấm công, tính lương, sinh phiếu thu, xếp kênh tăng trưởng. Frontend chỉ hiển thị và gửi dữ liệu thô (kể cả file Excel máy chấm công đã parse).
5. **Không viết cứng tham số quy định** (tỷ lệ bảo hiểm, giảm trừ gia cảnh, sĩ số tối đa, định mức): lưu trong bảng cấu hình có `effective_from`.
6. **Database:** khóa chính UUID; mọi bảng có `created_at`, `updated_at`, `created_by`; `deleted_at` (xóa mềm) cho `staff`, `children`, `invoices`; tiền `numeric(14,0)`; trạng thái `varchar` + CHECK. Mọi thay đổi schema là một migration Flyway mới, không sửa migration đã chạy.
7. **File:** upload/tải qua presigned URL (S3/MinIO); DB chỉ lưu metadata trong bảng `files`.
8. **API:** REST dưới `/api/v1`; lỗi theo RFC 7807 (`application/problem+json`) với thông điệp tiếng Việt; phân trang `page`, `size`, `sort`. Frontend sinh type từ OpenAPI (`openapi-typescript`), không viết tay type trùng với DTO.
9. **Xác thực:** JWT access 15 phút; refresh token 7 ngày trong cookie httpOnly, lưu hash ở `refresh_tokens`; mật khẩu BCrypt.
10. **Địa chỉ:** tỉnh + phường/xã (34 tỉnh), không có quận/huyện.
11. **Bí mật:** không commit `.env`; luôn cập nhật `.env.example`.

## Frontend

- Giữ `components/ui/*` (shadcn). Thay dần mọi lời gọi `supabase.*` bằng API client + TanStack Query theo từng giai đoạn; gỡ `@supabase/supabase-js` và `lovable-tagger` khi không còn chỗ dùng.
- Giao diện tiếng Việt. Màn hình điểm danh trẻ phải dùng tốt trên điện thoại.
- Trang cũ chưa tới giai đoạn chuyển đổi thì ẩn khỏi menu, nhưng `npm run build` luôn phải xanh.

## Quy ước giao diện (bắt buộc cho mọi trang)

- **Trạng thái:** mỗi trang có loading skeleton, empty state, error state; không bao giờ có màn hình trắng.
  Dùng `TableSkeleton`/`PageSkeleton`, `EmptyState`, `ErrorState` (có nút "Thử lại" gọi `refetch`).
- **Danh sách:** phân trang và lọc ở server (`PageResponse` backend, `page` từ 0, `size` ≤ 100); bộ lọc nằm trên URL
  để chia sẻ link được. Dùng `useListParams` + `FilterBar` (tìm kiếm debounce 300 ms) + `DataTable`; khai báo
  `columns` bằng `useMemo`.
- **Form:** react-hook-form + zod; nút Lưu vô hiệu khi đang gửi; toast khi thành công; hỏi xác nhận trước khi xóa,
  khóa hoặc duyệt. Dùng `FormSheet` (form panel phải), `ConfirmDialog`; lỗi từ API qua `applyApiErrors`
  (lỗi theo trường hiện dưới ô nhập, lỗi chung là toast).
- **Quyền và cơ sở:** nút, cột, menu hiển thị theo quyền (`useCan(action, resource)`, cột có `meta.permission`,
  mục menu có `permission` trong `lib/navigation.ts`); đây chỉ là ẩn/hiện, backend vẫn kiểm tra. Dữ liệu luôn theo
  cơ sở đang chọn: query key tạo bằng `useCurrentSchool().queryKey(...)` để đổi cơ sở thì tải lại.
- **Trang mới:** thêm vào `NAV_GROUPS` (`lib/navigation.ts`) với `phase`, `permission`, `page`; đầu trang dùng
  `PageHeader`. Ma trận quyền giao diện ở `lib/permissions.ts` phải khớp `docs/thiet-ke.md` và backend.
- **Màn hình:** dùng tốt từ độ rộng 360px (bảng cuộn ngang, nút xuống dòng); trang giáo viên dùng trên điện thoại
  phải bấm được bằng ngón tay: vùng chạm ≥ 44px (`min-h-11`, `h-11 w-11`).
- **Chữ:** tiếng Việt có dấu, xưng hô trung tính ("bạn"); không để lộ mã lỗi kỹ thuật (`code`, stack trace) cho người
  dùng. Định dạng qua `lib/format.ts`: tiền `formatMoney` ("1.500.000 ₫"), ngày `formatDate` (dd/MM/yyyy), giờ
  `formatTime` (HH:mm), tháng `formatMonth` ("Tháng 9/2026"). Trạng thái hiển thị bằng `StatusBadge`.
- **File:** dùng `FileUpload`/`MultiFileUpload` (presigned URL), không gọi storage trực tiếp.
- **Kiểm thử bắt buộc cho mỗi trang mới:** endpoint backend + test tích hợp (gồm test chặn chéo cơ sở và test theo
  vai trò); ít nhất một test Playwright cho luồng chính (`frontend/e2e/`); hook/tiện ích mới có test Vitest.
- Xem mẫu mọi component ở `/dev/ui` (chỉ có khi chạy dev).

## Cách làm việc

- Làm đúng một giai đoạn tại một thời điểm, theo mục "Lộ trình" trong `docs/thiet-ke.md`.
- Mỗi giai đoạn: đọc thiết kế → lập kế hoạch từng bước nhỏ → **chờ duyệt** → làm từng bước → chạy kiểm tra → tóm tắt những gì đã làm và cách chạy thử.
- Một bước chỉ được coi là xong khi: `./mvnw test` xanh, `npm test`, `npm run lint` và `npm run build` không lỗi (luồng chính đổi thì cả `npm run e2e`), và có hướng dẫn chạy thử bằng tay. Chỉ commit khi các lệnh trên đều xanh.
- Commit nhỏ theo từng bước, message theo Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Gặp câu hỏi nghiệp vụ chưa chốt: dùng giả định mặc định dưới đây, đánh dấu `TODO(assumption): ...` trong code và nhắc lại trong phần tóm tắt.
- Cuối mỗi phiên, cập nhật `docs/tien-do.md`: giai đoạn hiện tại, đã xong, đang dở, việc tiếp theo.

## Giả định mặc định (cho đến khi chủ dự án chốt)

- Hiệu trưởng là vai trò cao nhất, toàn quyền (kể cả lương) ở các trường được gán; tổ chức và hiệu trưởng mới do bên vận hành tạo.
- Biểu phí khác nhau theo từng cơ sở; kế toán có thể gán cho một hoặc nhiều cơ sở.
- Tiền ăn hoàn theo ngày vắng có phép được báo trước giờ báo ăn (quy tắc cấu hình được).
- Máy chấm công các cơ sở xuất cùng định dạng Excel mà ESG HR đang đọc.
- Lương hỗ trợ cả lương cứng và lương hệ số như ESG HR.
- Chưa có cổng phụ huynh; chưa chốt nơi triển khai production.

# Preschool Management — hướng dẫn cho Claude Code

## Dự án

- Web app quản lý **chuỗi trường mầm non cùng một chủ** (nhiều cơ sở), dựng lại từ app ESG HR cũ.
- Thiết kế đầy đủ nằm ở `docs/thiet-ke.md` (vai trò, module, 60 bảng, API, lộ trình). Đọc phần liên quan trước khi làm bất kỳ module nào.
- Không tự ý đổi quyết định thiết kế. Nếu thấy cần đổi: đề xuất, chờ đồng ý, rồi cập nhật `docs/thiet-ke.md` trước khi code.
- Tiến độ theo giai đoạn ghi ở `docs/tien-do.md` (tạo nếu chưa có).

## Cấu trúc repo

```
frontend/            React 18 + Vite + TypeScript + shadcn/ui + Tailwind + TanStack Query (fork từ ESG HR)
backend/             Java 21, Spring Boot 4.0, Maven, Spring Data JPA, Spring Security, Flyway
docker-compose.yml   postgres + minio cho môi trường dev
docs/                thiet-ke.md, tien-do.md
```

## Lệnh thường dùng

Cập nhật mục này khi lệnh thay đổi.

- Hạ tầng dev: `docker compose up -d`
- Backend: `cd backend && ./mvnw spring-boot:run` · test: `./mvnw test`
- Frontend: `cd frontend && npm install && npm run dev` · kiểm tra: `npm run lint && npm run build`

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

## Cách làm việc

- Làm đúng một giai đoạn tại một thời điểm, theo mục "Lộ trình" trong `docs/thiet-ke.md`.
- Mỗi giai đoạn: đọc thiết kế → lập kế hoạch từng bước nhỏ → **chờ duyệt** → làm từng bước → chạy kiểm tra → tóm tắt những gì đã làm và cách chạy thử.
- Một bước chỉ được coi là xong khi: `./mvnw test` xanh, `npm run lint` và `npm run build` không lỗi, và có hướng dẫn chạy thử bằng tay.
- Commit nhỏ theo từng bước, message theo Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Gặp câu hỏi nghiệp vụ chưa chốt: dùng giả định mặc định dưới đây, đánh dấu `TODO(assumption): ...` trong code và nhắc lại trong phần tóm tắt.
- Cuối mỗi phiên, cập nhật `docs/tien-do.md`: giai đoạn hiện tại, đã xong, đang dở, việc tiếp theo.

## Giả định mặc định (cho đến khi chủ dự án chốt)

- Hiệu trưởng không xem được lương người khác.
- Biểu phí khác nhau theo từng cơ sở; kế toán có thể gán cho một hoặc nhiều cơ sở.
- Tiền ăn hoàn theo ngày vắng có phép được báo trước giờ báo ăn (quy tắc cấu hình được).
- Máy chấm công các cơ sở xuất cùng định dạng Excel mà ESG HR đang đọc.
- Lương hỗ trợ cả lương cứng và lương hệ số như ESG HR.
- Chưa có cổng phụ huynh; chưa chốt nơi triển khai production.

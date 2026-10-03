# Preschool Management

Web app quản lý chuỗi trường mầm non nhiều cơ sở (dựng lại từ ESG HR).

- Thiết kế: [docs/thiet-ke.md](docs/thiet-ke.md)
- Tiến độ: [docs/tien-do.md](docs/tien-do.md)

| Thư mục | Nội dung |
|---|---|
| `backend/` | Java 21, Spring Boot 4, PostgreSQL, Flyway, S3/MinIO |
| `frontend/` | React 18, Vite, TypeScript, shadcn/ui, TanStack Query |
| `docker-compose.yml` | PostgreSQL + MinIO + Mailpit (SMTP giả) cho môi trường dev |

## Bản demo "Mầm Non Việt" (nhánh `demo`)

Bản giới thiệu khách hàng, **không cần backend**: mọi request đi qua API giả trong trình duyệt
(`frontend/src/mock`, trễ 300 ms), dữ liệu mẫu tiếng Việt sinh bằng faker với seed cố định (2 trường, 8 lớp,
~200 trẻ, 30 nhân viên, 3 tháng gần nhất). Thay đổi lưu ở localStorage; menu tài khoản có
"Khôi phục dữ liệu demo".

```bash
cd frontend && npm install && npm run dev:demo   # http://localhost:8080, chọn vai trò để vào
npm run demo                                      # build rồi xem thử bản tĩnh (frontend/dist-demo)
```

- Vai trò: Hiệu trưởng (2 cơ sở), Phó hiệu trưởng, Giáo viên (trang mặc định: Điểm danh trên điện thoại).
- Vercel: Root Directory = `frontend`, framework Vite (đã có `frontend/vercel.json` rewrite SPA).
- Cùng một codebase chạy hai chế độ, chọn bằng `VITE_DATA_SOURCE`: `npm run dev` / `npm run build` dùng backend
  thật, `npm run dev:demo` / `npm run build:demo` dùng dữ liệu giả. Giao diện chỉ import từ `src/api`; đổi chế độ
  chỉ thay lớp transport (`src/api/transport/`), không đụng vào code màn hình.
- Module backend chưa có (Hôm nay, Hộp duyệt, trẻ, học phí, thực đơn, cân đo, báo cáo) khai kiểu tạm ở
  `src/api/contracts.ts`; thay bằng type sinh từ OpenAPI khi backend có.

## Cần cài

- JDK 21 (ví dụ `winget install EclipseAdoptium.Temurin.21.JDK`), **mở terminal mới sau khi cài**
- Node.js 20 trở lên
- Docker Desktop (Windows cần WSL2)

## Chạy toàn bộ dự án

```bash
# 1. Hạ tầng: PostgreSQL (5432) + MinIO (9000, console 9001) + Mailpit (SMTP 1025, web 8025)
docker compose up -d

# 2. Backend: http://localhost:8081 (dev: migration + seed dev, tự tạo bucket)
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev  # Windows: .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"

# 3. Frontend: http://localhost:8080 (proxy /api sang backend)
cd frontend
npm install
npm run dev
```

Muốn đổi cổng, mật khẩu DB, khóa MinIO: sao chép `.env.example` thành `.env` rồi sửa. Docker compose và
backend (chạy trong `backend/`) đều đọc file này.

## Tài khoản dev

Mọi tài khoản dùng mật khẩu **`Matkhau@123`**; đăng nhập bằng email hoặc số điện thoại.

| Vai trò | Email | SĐT | Phạm vi |
|---|---|---|---|
| Hiệu trưởng | owner@preschool.local | 0900000001 | Trường A, B, C (tổ chức "Chuỗi Mầm non Hoa") |
| Hiệu trưởng | admin@preschool.local | 0900000002 | Trường D (tổ chức "Mầm non Sao Mai") |
| Kế toán | ketoan.a@preschool.local | 0900000003 | Trường A |
| Phó hiệu trưởng | hieutruong.a@preschool.local | 0900000004 | Trường A: Lớp & trẻ, Thực đơn & sức khỏe, Nhân sự, Báo cáo |
| Giáo viên | giaovien.a@preschool.local | 0900000005 | Trường A |
| Nhân viên y tế | yte.a@preschool.local | 0900000006 | Trường A |
| Cấp dưỡng | capduong.b@preschool.local | 0900000007 | Trường B |
| Nhân viên | nhanvien.b@preschool.local | 0900000008 | Trường B |

Seed chỉ nạp ở profile `dev` hoặc `test`; profile mặc định là `prod`. Chạy lệnh trên để có 12 hồ sơ nhân viên giả ở trường A, B; các
tài khoản từ `0900000003` tới `0900000008` gắn với một hồ sơ, hai hiệu trưởng không gắn hồ sơ. Nguyễn Thị Lan
(trường A) có hợp đồng hết hạn sau 20 ngày để thử cảnh báo. Hai tổ chức tách biệt: hiệu trưởng trường D không thấy
trường, tài khoản, dữ liệu dùng chung của tổ chức kia.

Tổ chức và hiệu trưởng mới do bên vận hành tạo bằng SQL: `SELECT provision_organization('<uuid>', 'Tên');` (chép
danh mục mặc định), tạo trường đầu tiên, thêm tài khoản rồi gán `PRINCIPAL` ở `user_roles`. Mật khẩu ban đầu băm
bằng pgcrypto; `must_change_password = true` để hiệu trưởng đổi ở lần đăng nhập đầu:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO users (organization_id, phone, full_name, password_hash, must_change_password)
VALUES ('<uuid tổ chức>', '0912345678', 'Họ tên', crypt('Matkhau2026', gen_salt('bf', 10)), true);
```

Sau đó hiệu trưởng tự thêm trường ở **Quản trị › Trường** và tạo tài khoản ở **Quản trị › Tài khoản**: nhập số điện
thoại hoặc email cùng mật khẩu ban đầu, rồi báo cho người dùng. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu. Quên
mật khẩu thì hiệu trưởng đặt lại ở cùng trang; tạm thời chưa gửi email.

## Thử nhanh

1. Đăng nhập `owner@preschool.local` → bộ chọn trường trên header có "Tất cả trường", Trường A, B, C; **Hôm nay**,
   **Hộp duyệt**, **Báo cáo** gộp số liệu các trường đang chọn. `0900000002` chỉ thấy Trường D.
2. Đăng nhập `0900000005` (giáo viên) → bộ chọn bị khóa ở Trường A.
3. Nhân sự (`owner@preschool.local`, chọn Trường A): **Nhân sự › Thêm nhân viên** → **Quét CCCD** (ảnh mặt trước có
   mã QR) → lưu → hồ sơ mở ra; tab **Hợp đồng & quyết định** tải hợp đồng PDF; nút **Điều chuyển** sang Trường B;
   tab **Lịch sử** có 2 giai đoạn công tác. File nằm trên MinIO console http://localhost:9001
   (`preschool` / `preschool-secret`).
4. Tài liệu (`0900000004`, phó hiệu trưởng A): **Tài liệu › Ban hành văn bản**, bật "Yêu cầu xác nhận đã đọc" →
   giáo viên `0900000005` thấy chuông thông báo và mục **Của tôi › Văn bản cần đọc** → **Tôi đã đọc** → hiệu
   trưởng tải lại trang văn bản thấy tỷ lệ đã đọc tăng.
5. Tự phục vụ: giáo viên vào **Hồ sơ của tôi › Đổi SĐT, địa chỉ** → hiệu trưởng duyệt ở **Nhân sự › Đề xuất cập
   nhật**. Tài khoản đăng nhập quản lý ở **Quản trị › Tài khoản** (hiệu trưởng; phó hiệu trưởng được giao nhóm
   chức năng theo từng trường).
6. Bấm **Quên mật khẩu?** ở trang đăng nhập, nhập `0900000008` → mở Mailpit http://localhost:8025 xem email,
   bấm link để đặt mật khẩu mới (tài khoản này sẽ đổi mật khẩu; seed không tự đặt lại).
7. Thư viện component (chỉ dev): http://localhost:8080/dev/ui. Xem trước menu các giai đoạn chưa làm:
   `VITE_PREVIEW_MODULES=true npm run dev`.
8. API docs: http://localhost:8081/swagger-ui.html

## Kiểm tra

```bash
cd backend && ./mvnw test                 # cần Docker (Testcontainers PostgreSQL + MinIO)
cd frontend && npm test && npm run lint && npm run build

# E2E (Playwright): cần compose + backend đang chạy; lần đầu cài trình duyệt
cd frontend && npx playwright install chromium && npm run e2e
```

E2E tự chạy Vite ở cổng 8080 và bật xem trước menu để kiểm tra trang 403. Nếu `npm run dev` đang chạy ở 8080,
Playwright sẽ dùng lại server đó (không bật xem trước) và test 403 sẽ đỏ: tắt nó, hoặc chạy `E2E_WEB_PORT=8083 npm run e2e`.
Đổi cổng/backend bằng `E2E_WEB_PORT`, `E2E_API_TARGET`, `E2E_MAILPIT_URL`. Test quên mật khẩu chỉ nhận email mới
nếu cách lần chạy trước hơn 1 phút (backend giới hạn 1 yêu cầu/phút mỗi tài khoản).

`./mvnw test` cũng ghi lại `frontend/openapi.json`. Khi API đổi: chạy test backend, rồi `npm run gen:api` trong
`frontend/` để sinh lại type (`src/api/schema.d.ts`), commit cả hai file.

## Triển khai thử (Vercel + Render + Neon)

Tạm thời, chưa phải nơi chạy chính thức. Frontend ở Vercel chuyển tiếp `/api/*` sang backend ở Render (`frontend/vercel.json`),
nên trình duyệt chỉ thấy một origin và cookie refresh vẫn hoạt động. Database ở Neon. Render chạy profile `prod`, chỉ nạp migration dữ liệu ba trường PBC và tạo hiệu trưởng bootstrap từ biến môi trường.

> **Production:** đặt `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` trong secret manager. Hiệu trưởng được gán ở ba trường PBC và phải đổi mật khẩu lần đầu. Seed tài khoản/trường/nhân sự/trẻ giả chỉ có trong `dev`/`test`. Swagger/OpenAPI tắt ngoài dev, test; cần xem tạm thì đặt `API_DOCS_ENABLED=true`.

1. **Neon:** tạo project ở region Singapore. Lấy host **không có** `-pooler` (Flyway cần kết nối trực tiếp), cùng user
   và mật khẩu.
2. **Render:** New → Blueprint → chọn repo/nhánh (đọc `render.yaml`). Điền `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`
   và `FRONTEND_URL` (địa chỉ Vercel). Đặt `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` thành secret riêng cho hiệu trưởng đầu tiên. `JWT_SECRET` do Render tự sinh. Nếu tên service khác `preschool-api`, sửa
   địa chỉ trong `frontend/vercel.json`.
3. **Vercel:** Root Directory `frontend`, deploy lại. Không đặt `VITE_DATA_SOURCE` (mặc định `api`).

4. **File – Cloudflare R2:** tạo bucket `preschool`. Vào Settings → CORS policy, dán nội dung dưới đây (thay địa chỉ
   Vercel). Vào R2 → Manage API tokens, tạo token quyền *Object Read & Write* cho bucket này. Điền lên Render:
   `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

   ```json
   [{ "AllowedOrigins": ["https://<app>.vercel.app"], "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
   ```

5. **Email – Brevo:** vào Senders, domains & dedicated IPs → Senders, thêm và xác minh địa chỉ gửi. Vào SMTP & API → SMTP,
   lấy login và tạo SMTP key. Điền lên Render: `MAIL_USERNAME` (login), `MAIL_PASSWORD` (SMTP key),
   `MAIL_FROM=Mầm Non Việt <địa-chỉ-đã-xác-minh>`. Host và cổng (`smtp-relay.brevo.com:2525`) đã có sẵn trong
   `render.yaml`, vì gói free của Render chặn các cổng 25/465/587. Chưa có tên miền riêng nên email có thể rơi vào thư rác.

Gói free của Render ngủ sau 15 phút không dùng, lần gọi đầu chờ khoảng 1 phút. Thử nhanh: đăng nhập
email bootstrap sau khi đổi mật khẩu lần đầu, tải một file ở Thư viện (kiểm tra R2), rồi bấm "Quên mật khẩu" với một tài khoản có email thật
(kiểm tra Brevo). Lỗi gửi email chỉ ghi vào log Render, không báo lên giao diện.

### Xóa dữ liệu seed khỏi database hiện tại

Trước tiên đặt `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` cho đúng database rồi tạo backup; lệnh `pg_dump` sẽ hỏi mật khẩu:

```powershell
pg_dump -Fc -f .\backup-before-sample-purge.dump -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER $env:PGDATABASE
.\backend\scripts\purge-sample-data.ps1
```

Script yêu cầu gõ chính xác `XOA DU LIEU MAU`, chạy transaction và chỉ xóa hai tổ chức seed cũ. Script kiểm tra và giữ nguyên ba trường PBC; có thể chạy lại an toàn.

## Sự cố thường gặp

- **`No compiler is provided in this environment`** hoặc **`class file version 61.0 … up to 52.0`**: Maven đang
  chạy bằng Java 8. Terminal trong VS Code thừa hưởng môi trường lúc mở VS Code, nên sau khi cài JDK phải **tắt hẳn
  VS Code rồi mở lại**. Tạm thời trong terminal hiện tại:
  `$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"`
- **`npm.ps1 cannot be loaded because running scripts is disabled`** (PowerShell): dùng `npm.cmd run dev`, hoặc
  cho phép script cho tài khoản của mình: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **Test backend lỗi không kết nối Docker**: mở Docker Desktop trước khi chạy `./mvnw test`.
- **Git Bash + `docker run -v /data`**: Git Bash tự đổi đường dẫn; đặt `MSYS_NO_PATHCONV=1`.

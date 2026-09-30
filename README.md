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

# 2. Backend: http://localhost:8081 (tự chạy migration + seed dev, tự tạo bucket)
cd backend
./mvnw spring-boot:run          # Windows PowerShell: .\mvnw.cmd spring-boot:run

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
| Chủ chuỗi | owner@preschool.local | 0900000001 | Toàn chuỗi |
| Văn phòng điều hành | admin@preschool.local | 0900000002 | Toàn chuỗi |
| Kế toán | ketoan.a@preschool.local | 0900000003 | Cơ sở A |
| Hiệu trưởng | hieutruong.a@preschool.local | 0900000004 | Cơ sở A |
| Giáo viên | giaovien.a@preschool.local | 0900000005 | Cơ sở A |
| Nhân viên y tế | yte.a@preschool.local | 0900000006 | Cơ sở A |
| Cấp dưỡng | capduong.b@preschool.local | 0900000007 | Cơ sở B |
| Nhân viên | nhanvien.b@preschool.local | 0900000008 | Cơ sở B |

Seed chỉ nạp ở profile `dev` (mặc định khi chạy `spring-boot:run`). Seed có 12 hồ sơ nhân viên ở 2 cơ sở; các tài
khoản từ `0900000003` tới `0900000008` gắn với một hồ sơ (xem được ở **Của tôi › Hồ sơ của tôi**), chủ chuỗi và văn
phòng điều hành không gắn hồ sơ. Nguyễn Thị Lan (Cơ sở A) có hợp đồng hết hạn sau 20 ngày để thử cảnh báo.

## Thử nhanh

1. Đăng nhập `owner@preschool.local` → bộ chọn cơ sở trên header có "Tất cả cơ sở", Cơ sở A, Cơ sở B.
2. Đăng nhập `0900000005` (giáo viên) → bộ chọn bị khóa ở Cơ sở A.
3. Nhân sự (`admin@preschool.local`, chọn Cơ sở A): **Nhân sự › Thêm nhân viên** → **Quét CCCD** (ảnh mặt trước có
   mã QR) → lưu → hồ sơ mở ra; tab **Hợp đồng & quyết định** tải hợp đồng PDF; nút **Điều chuyển** sang Cơ sở B;
   tab **Lịch sử** có 2 giai đoạn công tác. File nằm trên MinIO console http://localhost:9001
   (`preschool` / `preschool-secret`).
4. Tài liệu (`0900000004`, hiệu trưởng A): **Tài liệu › Ban hành văn bản**, bật "Yêu cầu xác nhận đã đọc" →
   giáo viên `0900000005` thấy chuông thông báo và mục **Của tôi › Văn bản cần đọc** → **Tôi đã đọc** → hiệu
   trưởng tải lại trang văn bản thấy tỷ lệ đã đọc tăng.
5. Tự phục vụ: giáo viên vào **Hồ sơ của tôi › Đổi SĐT, địa chỉ** → hiệu trưởng duyệt ở **Nhân sự › Đề xuất cập
   nhật**. Tài khoản đăng nhập quản lý ở **Quản trị › Tài khoản** (chủ chuỗi, văn phòng điều hành).
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

## Sự cố thường gặp

- **`No compiler is provided in this environment`** hoặc **`class file version 61.0 … up to 52.0`**: Maven đang
  chạy bằng Java 8. Terminal trong VS Code thừa hưởng môi trường lúc mở VS Code, nên sau khi cài JDK phải **tắt hẳn
  VS Code rồi mở lại**. Tạm thời trong terminal hiện tại:
  `$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"`
- **`npm.ps1 cannot be loaded because running scripts is disabled`** (PowerShell): dùng `npm.cmd run dev`, hoặc
  cho phép script cho tài khoản của mình: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **Test backend lỗi không kết nối Docker**: mở Docker Desktop trước khi chạy `./mvnw test`.
- **Git Bash + `docker run -v /data`**: Git Bash tự đổi đường dẫn; đặt `MSYS_NO_PATHCONV=1`.

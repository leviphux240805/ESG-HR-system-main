# Preschool Management

Web app quản lý chuỗi trường mầm non nhiều cơ sở (dựng lại từ ESG HR).

- Thiết kế: [docs/thiet-ke.md](docs/thiet-ke.md)
- Tiến độ: [docs/tien-do.md](docs/tien-do.md)

| Thư mục | Nội dung |
|---|---|
| `backend/` | Java 21, Spring Boot 4, PostgreSQL, Flyway, S3/MinIO |
| `frontend/` | React 18, Vite, TypeScript, shadcn/ui, TanStack Query |
| `docker-compose.yml` | PostgreSQL + MinIO + Mailpit (SMTP giả) cho môi trường dev |

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

Seed chỉ nạp ở profile `dev` (mặc định khi chạy `spring-boot:run`).

## Thử nhanh

1. Đăng nhập `owner@preschool.local` → bộ chọn cơ sở trên header có "Tất cả cơ sở", Cơ sở A, Cơ sở B.
2. Đăng nhập `0900000005` (giáo viên) → bộ chọn bị khóa ở Cơ sở A.
3. Vào **Tệp (thử nghiệm)** → tải lên một file PDF/ảnh → **Tải về**. Xem file trên MinIO console
   http://localhost:9001 (tài khoản `preschool` / `preschool-secret`).
4. Bấm **Quên mật khẩu?** ở trang đăng nhập, nhập `0900000008` → mở Mailpit http://localhost:8025 xem email,
   bấm link để đặt mật khẩu mới (tài khoản này sẽ đổi mật khẩu; seed không tự đặt lại).
5. Thư viện component (chỉ dev): http://localhost:8080/dev/ui. Xem trước menu các giai đoạn chưa làm:
   `VITE_PREVIEW_MODULES=true npm run dev`.
6. API docs: http://localhost:8081/swagger-ui.html

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

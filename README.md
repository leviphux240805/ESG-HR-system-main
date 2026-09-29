# Preschool Management

Web app quản lý chuỗi trường mầm non nhiều cơ sở (dựng lại từ ESG HR).

- Thiết kế: [docs/thiet-ke.md](docs/thiet-ke.md)
- Tiến độ: [docs/tien-do.md](docs/tien-do.md)

| Thư mục | Nội dung |
|---|---|
| `backend/` | Java 21, Spring Boot 4, PostgreSQL, Flyway, S3/MinIO |
| `frontend/` | React 18, Vite, TypeScript, shadcn/ui, TanStack Query |
| `docker-compose.yml` | PostgreSQL + MinIO cho môi trường dev |

## Cần cài

- JDK 21 (ví dụ `winget install EclipseAdoptium.Temurin.21.JDK`), **mở terminal mới sau khi cài**
- Node.js 20 trở lên
- Docker Desktop (Windows cần WSL2)

## Chạy toàn bộ dự án

```bash
# 1. Hạ tầng: PostgreSQL (5432) + MinIO (9000, console 9001)
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
4. API docs: http://localhost:8081/swagger-ui.html

## Kiểm tra

```bash
cd backend && ./mvnw test                 # cần Docker (Testcontainers PostgreSQL + MinIO)
cd frontend && npm run lint && npm run build
```

`./mvnw test` cũng ghi lại `frontend/openapi.json`. Khi API đổi: chạy test backend, rồi `npm run gen:api` trong
`frontend/` để sinh lại type (`src/api/schema.d.ts`), commit cả hai file.

## Sự cố thường gặp

- **`No compiler is provided in this environment`**: terminal đang dùng Java cũ. Mở terminal mới hoặc đặt
  `JAVA_HOME` trỏ tới JDK 21.
- **Test backend lỗi không kết nối Docker**: mở Docker Desktop trước khi chạy `./mvnw test`.
- **Git Bash + `docker run -v /data`**: Git Bash tự đổi đường dẫn; đặt `MSYS_NO_PATHCONV=1`.

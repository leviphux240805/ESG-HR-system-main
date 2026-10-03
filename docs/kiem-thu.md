# Kiểm thử trước bàn giao

Ngày chạy: 03/10/2026, nhánh `demo`, chế độ API thật (backend Spring Boot + PostgreSQL + MinIO, seed dev).

## Tổng hợp

| Hạng mục | Công cụ | Qua | Lỗi | Bỏ qua |
|---|---|---|---|---|
| Backend: test tích hợp và đơn vị (`./mvnw test`) | JUnit + Testcontainers | 240 | 0 | 0 |
| Frontend: hook, tiện ích, API giả (`npm test`) | Vitest | 107 | 0 | 0 |
| E2E toàn bộ (`npm run e2e`) | Playwright | 53 | 0 | 6 |
| Lint (`npm run lint`), build (`npm run build`, `npm run build:demo`) | ESLint, Vite | xanh | 0 lỗi | 11 cảnh báo cũ |

6 test E2E bỏ qua là của module Tài liệu và Hồ sơ của tôi: các trang này có sẵn nhưng chưa vào menu, chờ khách duyệt giao
diện (xem `docs/hoan-thien.md`). Chúng được đánh dấu `test.skip` kèm lý do và sẽ bật lại khi module vào menu.

## 1. E2E theo vai trò (`frontend/e2e/role-flows.spec.ts`)

| Vai trò | Luồng | Kết quả |
|---|---|---|
| Hiệu trưởng (0900000001) | Tạo trường → thêm nhân viên vào trường mới → duyệt đơn nghỉ của giáo viên Trường A → xem Báo cáo, xuất Excel → ngừng trường vừa tạo | Qua |
| Phó hiệu trưởng (0900000004, nhóm Lớp & trẻ, Thực đơn & sức khỏe, Nhân sự, Báo cáo) | Menu chỉ có nhóm được giao; mở Hồ sơ trẻ, Nhân sự; Báo cáo không có số liệu tài chính; vào Phiếu thu bị chặn (403) | Qua |
| Giáo viên (0900000005), điện thoại 375px | Điểm danh lớp Chồi 1 (có mặt, vắng có phép), không cuộn ngang; mở việc được giao có file PDF đính kèm, chuyển "Đang làm" | Qua |
| Kế toán (0900000003) | Sinh và phát hành phiếu thu tháng → thấy ở Công nợ → thu đủ → hết nợ | Qua |

Các luồng cũ (chấm công, nghỉ phép, lương, học phí, sức khỏe, sổ điểm danh…) vẫn chạy trong cùng bộ E2E.

## 2. Bảng quyền (`backend/.../security/PermissionMatrixTests.java`)

Test gọi **226 endpoint × 8 danh tính = 1.808 lần gọi** trên dữ liệu seed dev: 7 vai trò ở Trường A, cộng hiệu trưởng của
tổ chức khác gửi header Trường A. Kết quả được đối chiếu với ma trận quyền ghi trong test, chép từ `docs/thiet-ke.md`.
Endpoint mới chưa khai báo trong ma trận sẽ làm test đỏ.

Quy tắc chấm:
- **Vai trò được phép:** đọc phải trả 2xx; ghi không được trả 401/403.
- **Vai trò không được phép:** đọc phải trả 403/404; ghi không được trả 2xx.

Bảng chi tiết ghi ra `backend/target/permission-matrix.tsv`.

Sai lệch tìm thấy và đã sửa:
- **Cấp dưỡng xem được toàn bộ hồ sơ trẻ, điểm danh từng trẻ, sổ điểm danh**, trong khi thiết kế chỉ cho "Xem (sĩ số)".
  - Backend: cấp dưỡng chỉ còn xem danh sách lớp và chi tiết lớp (sĩ số, giáo viên).
  - Giao diện: tách quyền `children` khỏi `classes`, nên cấp dưỡng không còn thấy menu Điểm danh, Sổ điểm danh, Hồ sơ trẻ.

Cách hiểu đang dùng (khớp thiết kế, ghi lại để chủ dự án biết):
- **Danh mục tham chiếu mọi vai trò đều đọc được:** khối, năm học, trường của mình, loại giấy tờ, cấu hình ca chấm công,
  tham số lương theo luật.
- **Danh sách tự lọc theo người xem:** Hộp duyệt, đơn nghỉ, công việc, đề xuất cập nhật hồ sơ. Test kiểm tra giáo viên
  không thấy đơn và việc của người khác.
- **Tìm phụ huynh theo SĐT** chỉ dành cho người quản lý lớp, vì chỉ dùng khi thêm trẻ.
- **Gỡ tệp đính kèm của việc** chỉ người giao việc làm được; người nhận vẫn đính kèm được.
- **Chủ dự án đã đồng ý (03/10/2026):** giáo viên xem (chỉ đọc) thực đơn tuần, món ăn và cảnh báo dị ứng; ma trận trong
  `docs/thiet-ke.md` đã ghi thêm "+ xem thực đơn".

## 3. Bảo mật

| Kiểm tra | Cách làm | Kết quả |
|---|---|---|
| Kiểm tra đầu vào | `ApiHardeningTests`: mọi endpoint nhận JSON hỏng, mảng thay object, chuỗi 20.000 ký tự, số âm hoặc quá lớn, ngày sai, id không phải UUID, tham số lọc sai kiểu, `q` chứa chuỗi kiểu SQL injection | Không có lỗi 5xx. Mọi lỗi trả `application/problem+json` tiếng Việt |
| Không lộ chi tiết kỹ thuật | Cùng test: thân lỗi không chứa tên lớp Java, stack trace, `SQL`, `org.springframework`… | **Đã sửa 1 lỗi:** tham số lọc sai kiểu (vd. `/tasks?status=ABC`) trả câu tiếng Anh có `java.lang.String`; nay trả "Giá trị không hợp lệ." |
| File upload | Đọc lại mã và test sẵn có (`FileApiTests`) | Có danh sách loại cho phép (PDF, ảnh, Word, Excel), giới hạn dung lượng (mặc định 20 MB, 413 khi vượt), presigned URL ký kèm `Content-Length`, khi xác nhận thì kiểm tra lại dung lượng và magic bytes (sai thì xóa file) |
| Giới hạn đăng nhập | **Trước đây chưa có, đã thêm** `LoginRateLimiter` (không dùng thư viện mới) | Cùng một tài khoản sai 5 lần trong 15 phút → 429 kèm `Retry-After` và câu "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau N phút.". Một IP sai 30 lần trong 15 phút cũng bị chặn. Quên mật khẩu tính chung giới hạn. Đăng nhập thành công thì xóa bộ đếm. Ngưỡng cấu hình qua `app.auth.login-*`. Test: `LoginRateLimiterTests`, `AuthTests.tooManyWrongPasswordsBlockTheAccountForAWhile` |
| Secret trong repo | Quét file đang theo dõi và toàn bộ lịch sử git (khóa AWS/Brevo/Neon, private key, JWT, chuỗi kết nối có mật khẩu) | Không có. `.env` bị ignore; chỉ có giá trị mẫu dev (`preschool`/`preschool-secret`) trong `.env.example` và khóa test trong `application-test.yml`. Render sinh `JWT_SECRET` |
| Profile mặc định của image Docker | Đọc cấu hình | **Đã sửa:** chạy image mà quên `SPRING_PROFILES_ACTIVE` thì rơi về profile `dev`, nghĩa là dùng khóa JWT công khai và nạp tài khoản mẫu. Nay Dockerfile đặt mặc định `prod`, bắt buộc `JWT_SECRET` và không nạp seed |

Lưu ý khi lên production thật:
- Server demo (Render, profile `seed`) có tài khoản mẫu với mật khẩu `Matkhau@123` công khai. **Đã chốt:** profile `seed`
  chỉ dùng cho server demo; production dùng `prod` (đã ghi trong `application-seed.yml`, README).
- `/swagger-ui.html` và `/v3/api-docs`: **đã tắt** ngoài profile dev và test (bật tạm bằng `API_DOCS_ENABLED=true`).
- Giới hạn đăng nhập lưu trong bộ nhớ nên chỉ đúng khi chạy một instance backend (như Render hiện tại). Chạy nhiều instance
  thì cần chuyển bộ đếm sang DB hoặc Redis.

## 4. Dữ liệu lớn và tốc độ (`backend/.../PerformanceTests.java`)

Dữ liệu `backend/src/test/resources/perf/seed.sql`, nạp thêm vào seed dev, cho một hiệu trưởng quản lý 8 trường:

| Dữ liệu | Số lượng |
|---|---|
| Trường mới | 5 |
| Lớp | 40 |
| Trẻ | 1.000 |
| Nhân viên | 125 |
| Điểm danh trẻ (10/2025–9/2026) | ≈ 261.000 dòng |
| Ngày công nhân viên | ≈ 32.600 |
| Phiếu thu | 12.000, kèm 24.000 dòng phí và ≈ 11.000 lần thu |
| Bảng lương | 60 kỳ, 1.500 phiếu lương |
| Lần cân đo | 12.000 |
| Đơn nghỉ, công việc | dữ liệu kèm theo |

Cách đo:
- 39 trang danh sách và báo cáo, mỗi trang đo cả khi chọn một trường và khi chọn "Tất cả trường" (67 phép đo).
- Mỗi trang gọi một lần làm nóng, rồi đo lần thứ hai.

Ngưỡng:
- Thời gian phản hồi dưới 2 giây.
- Tối đa 15 câu SQL Hibernate mỗi request, để bắt lỗi N+1.

| Kết quả | Giá trị |
|---|---|
| Chậm nhất | Xuất Excel phiếu thu, tất cả trường: **0,32 giây** |
| Còn lại | Đều dưới 0,25 giây |
| Nhiều câu SQL nhất | 11 câu |

Lỗi tìm thấy và đã sửa:
- **N+1 ở Sổ điểm danh tháng** (`RollBookService`): mỗi ngày trong tháng truy vấn lại ngày lễ, lớp được phân công và giờ
  báo ăn, tổng 33 câu SQL cho một lớp. Nay tính một lần cho cả tháng: còn 7 câu.
- **Lỗi 500 ở Công việc, Hộp duyệt, Hôm nay, Sổ theo dõi sức khỏe, Cân đo** khi bản ghi không có người tạo hoặc người ghi.
  - Trường hợp gặp: việc do job lặp lại sinh ra, dữ liệu nhập từ ngoài.
  - Nguyên nhân: tra tên người trong `Map.of()` rỗng bằng khóa `null`.
  - Đã sửa ở `TaskService` và `HealthService`.

Đã xem nhưng chưa sửa:
- Danh sách đơn nghỉ và đề xuất cập nhật hồ sơ đang lọc và phân trang trong bộ nhớ.
- Với 400 đơn/năm của 5 trường vẫn chỉ mất khoảng 10 ms; nên chuyển sang lọc trong SQL khi dữ liệu vượt vài chục nghìn đơn.

## 5. Lỗi đã sửa

1. Cấp dưỡng xem được hồ sơ trẻ, điểm danh, sổ điểm danh (sai ma trận quyền). Đã sửa ở backend và menu giao diện.
2. Tham số lọc sai kiểu làm lộ thông điệp kỹ thuật tiếng Anh (`java.lang.String`).
3. Đăng nhập không giới hạn số lần thử sai; quên mật khẩu có thể bị dùng để gửi thư hàng loạt.
4. Image Docker không đặt profile thì chạy bằng khóa JWT công khai của dev.
5. Lỗi 500 khi bản ghi việc, cân đo, sổ theo dõi không có người tạo hoặc người ghi.
6. N+1 truy vấn ở Sổ điểm danh tháng (33 → 7 câu SQL).
7. Seed dev: giờ báo ăn 08:30 làm mọi E2E giáo viên điểm danh đỏ sau 8 giờ 30.
   - Trường A nay để 23:59; Trường B giữ 08:30 để thử khóa.
   - Backend test giờ báo ăn bằng đồng hồ cố định.
8. E2E cũ sai do giao diện hoặc dữ liệu đã đổi:
   - Trang đích sau đăng nhập trỏ vào trang Tài liệu chưa có route.
   - Locator trùng thẻ mobile và bảng.
   - Số ngày còn lại của hợp đồng cố định.
   - Dữ liệu E2E tích lũy đẩy dòng cần tìm sang trang 2.
   - Tháng chấm công còn khóa từ lần chạy dừng giữa chừng.
   - Đếm cứng số trường.

## 6. Cách chạy lại

```bash
docker compose up -d
cd backend && ./mvnw test                     # gồm bảng quyền, dò đầu vào, hiệu năng (~6 phút, cần Docker)
cd frontend && npm test && npm run lint && npm run build && npm run build:demo
# E2E: backend profile dev đang chạy ở 8081
cd backend && ./mvnw spring-boot:run          # cửa sổ khác
cd frontend && npm run e2e
```

Kết quả chi tiết: `backend/target/permission-matrix.tsv` (bảng quyền), `backend/target/performance.tsv` (thời gian và số câu SQL).

---

## Kịch bản nghiệm thu (UAT) cho khách

Môi trường: bản chạy thử (web Vercel + server Render). Mật khẩu mọi tài khoản mẫu: `Matkhau@123`. Bước có ghi "điện thoại"
nên làm trên điện thoại thật.

| # | Người làm | Thao tác | Kết quả mong đợi |
|---|---|---|---|
| 1 | Hiệu trưởng `0900000001` | Đăng nhập | Vào trang Hôm nay; ô "Chọn trường" có Tất cả trường, Trường A, B, C |
| 2 | Hiệu trưởng | Trường → Thêm trường, nhập mã và tên, Lưu | Báo "Đã lưu."; trường mới hiện trong danh sách và trong ô chọn trường |
| 3 | Hiệu trưởng | Chọn trường mới → Nhân sự → Thêm nhân viên (họ tên, SĐT, vị trí Giáo viên) | Báo "Đã thêm nhân viên … (NVxxxx)", mở hồ sơ vừa tạo |
| 4 | Hiệu trưởng | Chọn Trường A → Hồ sơ trẻ → Thêm trẻ (họ tên, ngày sinh, lớp Chồi 1, phụ huynh, SĐT) | Báo "Đã thêm trẻ."; tìm theo tên thấy trẻ, mở hồ sơ thấy phụ huynh |
| 5 | Giáo viên `0900000005` (điện thoại) | Đăng nhập → Điểm danh → chọn Có mặt/Có phép cho từng bé → Lưu điểm danh | Báo "Đã lưu điểm danh."; nút đủ lớn để bấm; không phải kéo ngang màn hình |
| 6 | Giáo viên (điện thoại) | Nghỉ phép → Xin nghỉ 1 ngày → Gửi đơn | Đơn hiện "Chờ duyệt"; phép còn lại hiển thị |
| 7 | Hiệu trưởng | Hộp duyệt (hoặc Nghỉ phép → Chờ duyệt) → Duyệt đơn của Giáo Viên A | Báo đã duyệt; Chấm công tháng đó ô ngày nghỉ thành **P**; giáo viên thấy đơn "Đã duyệt" |
| 8 | Hiệu trưởng | Công việc → Giao việc cho Giáo Viên A, mở việc, đính kèm 1 file PDF | Báo đã giao và "Đã đính kèm."; giáo viên nhận thông báo |
| 9 | Giáo viên (điện thoại) | Công việc → tab Mới → mở việc → xem file → bấm "Đang làm" | Mở được file; báo `Đã chuyển sang "Đang làm".` |
| 10 | Hiệu trưởng | Chấm công → Import máy chấm công (file Excel máy chấm công mẫu bên phát triển gửi kèm) → Xử lý sai lệch → Xác nhận tất cả → Khóa công | Báo số dòng đã đối soát, mã chưa gán; sau khóa thì ô chỉ xem, không sửa được |
| 11 | Kế toán `0900000003` | Phiếu thu → chọn tháng → Sinh phiếu → Phát hành tất cả nháp | Mỗi trẻ một phiếu, tiền đúng biểu phí; báo "Đã phát hành N phiếu."; trạng thái "Chưa thu" |
| 12 | Kế toán | Mở một phiếu → Ghi nhận thu một phần, rồi thu nốt → Tải PDF | Trạng thái "Thu một phần" rồi "Đã thu đủ"; PDF phiếu thu có dấu tiếng Việt |
| 13 | Kế toán | Công nợ | Chỉ còn các trẻ chưa thu đủ; trẻ ở bước 12 không còn trong danh sách |
| 14 | Hiệu trưởng | Bảng lương → tháng đã khóa công → Tính lương → sửa thưởng 1 người → Duyệt | Bảng lương có từng người, tổng thực lĩnh; sau duyệt không sửa được |
| 15 | Giáo viên | Phiếu lương của tôi → mở tháng vừa duyệt → Tải PDF | Thấy thu nhập, bảo hiểm, thuế, thực lĩnh, khoản thưởng; tải được PDF |
| 16 | Y tế `0900000006` | Thực đơn tuần, Cân đo lớp Chồi 1 (nhập cân nặng, chiều cao), Sổ theo dõi | Thực đơn có dòng "Số suất"; cân đo ra kênh tăng trưởng; ghi sổ được |
| 17 | Hiệu trưởng | Báo cáo → xuất Danh sách trẻ, Bảng công, Bảng lương, Công nợ | Có biểu đồ đi học, thu chi, dinh dưỡng, công việc; 4 file Excel mở được, đúng số liệu |
| 18 | Phó hiệu trưởng `0900000004` | Đăng nhập, xem menu; gõ thẳng địa chỉ `/hoc-phi/phieu-thu` | Không có Phiếu thu, Công nợ, Bảng lương, Trường, Tài khoản; trang học phí báo "Bạn không có quyền truy cập trang này" |
| 19 | Cấp dưỡng `0900000007` | Đăng nhập, mở Lớp học và Thực đơn tuần | Thấy sĩ số các lớp Trường B và sửa được thực đơn; **không** có menu Hồ sơ trẻ, Điểm danh |
| 20 | Nhân viên `0900000008` | Đăng nhập sai mật khẩu 6 lần liên tiếp | Từ lần thứ 6 báo "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút."; sau 15 phút đăng nhập lại được |

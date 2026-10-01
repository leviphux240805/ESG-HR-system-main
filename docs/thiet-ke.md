# Thiết kế hệ thống quản lý chuỗi trường mầm non

> Bản xuất từ tài liệu thiết kế trên Claude (cập nhật 2026-09-29). Đây là nguồn chuẩn cho mọi quyết định thiết kế; khi thay đổi, sửa file này trước.

Hệ thống web cho các hiệu trưởng quản lý một hoặc nhiều trường mầm non, dựng lại từ ESG HR: giữ phần lớn giao diện React, chuyển backend từ Supabase sang Java Spring Boot + PostgreSQL, gồm 10 module và làm theo 7 giai đoạn.

## Phạm vi và giả định

Một lần triển khai phục vụ nhiều tổ chức. Mỗi tổ chức có một hoặc nhiều hiệu trưởng; mỗi hiệu trưởng quản lý các trường được gán, không thấy trường của hiệu trưởng khác. Nhân sự mỗi trường chỉ thấy trường của mình.

- **Mô hình:** `organizations` (tổ chức) → `schools` (trường). Mọi bảng nghiệp vụ mang `school_id`; dữ liệu dùng chung các trường của một tổ chức (năm học, khối, khoản thu, ngày lễ, món ăn chung, văn bản chung, việc chung) để `school_id` rỗng và luôn có `organization_id`. Danh mục hệ thống (chuẩn WHO, loại tài liệu, tham số lương/bảo hiểm theo luật) dùng chung toàn hệ thống. Tổ chức và tài khoản hiệu trưởng do bên vận hành tạo (lệnh SQL `provision_organization`), không có giao diện tự đăng ký.

- **Người dùng bản đầu:** hiệu trưởng (cao nhất), phó hiệu trưởng, kế toán, giáo viên, nhân viên y tế, cấp dưỡng và nhân viên khác.

- **Nền tảng:** web app chạy tốt trên máy tính và điện thoại (giáo viên điểm danh trẻ bằng điện thoại), chưa làm app mobile riêng.

- **Ngoài phạm vi bản đầu:** cổng/app phụ huynh, thanh toán học phí online qua cổng thanh toán, xuất hóa đơn điện tử, kết nối trực tiếp máy chấm công (vẫn import file Excel như ESG HR), sổ kế hoạch giáo dục/đánh giá trẻ. Thiết kế dữ liệu vẫn chừa sẵn chỗ cho phụ huynh (bảng `guardians` có `user_id`).

- **Quy định ngành:** sĩ số tối đa theo độ tuổi, định mức giáo viên/lớp, tỷ lệ đóng bảo hiểm, mức giảm trừ gia cảnh đều lưu trong bảng cấu hình có ngày hiệu lực, không viết cứng trong code. Điều lệ Trường mầm non (Thông tư 52/2020/TT-BGDĐT) đã được sửa đổi nhiều lần, gần nhất năm 2026, nên số liệu mặc định cần đối chiếu văn bản hiện hành trước khi nhập.

- **Địa chỉ:** dùng cấp tỉnh + phường/xã (34 tỉnh, không còn cấp huyện). File `addressData.json` của ESG HR đã theo cấu trúc này, nhưng kiểu `Employee` vẫn còn `perm_district`/`curr_district` — bỏ trong schema mới.

## Vai trò và phân quyền

Có 7 vai trò, vai trò nào cũng gán theo từng trường (`user_roles.school_id` bắt buộc); một người có thể giữ vai trò ở nhiều trường. Hiệu trưởng là vai trò cao nhất (thay chủ chuỗi và văn phòng điều hành cũ).

| Vai trò             | Mã               | Dùng cho                                                                                                   |
|---------------------|------------------|------------------------------------------------------------------------------------------------------------|
| Hiệu trưởng         | `PRINCIPAL`      | Toàn quyền mọi module ở các trường được gán, kể cả lương và tài khoản; tạo/sửa/ngừng trường; dữ liệu chung của tổ chức |
| Phó hiệu trưởng     | `VICE_PRINCIPAL` | Như hiệu trưởng nhưng chỉ ở trường được gán và trong các nhóm chức năng được giao                          |
| Kế toán             | `ACCOUNTANT`     | Học phí, thu chi, lương ở trường được gán                                                                  |
| Giáo viên / bảo mẫu | `TEACHER`        | Điểm danh trẻ, cân đo, sổ theo dõi lớp được phân công                                                     |
| Nhân viên y tế      | `NURSE`          | Sức khỏe trẻ toàn trường                                                                                   |
| Cấp dưỡng           | `KITCHEN`        | Thực đơn, số suất ăn                                                                                       |
| Nhân viên khác      | `STAFF`          | Việc được giao, hồ sơ và công của bản thân                                                                 |

**Nhóm chức năng của phó hiệu trưởng** (`user_roles.function_groups`, gán riêng cho từng trường):

| Nhóm         | Mã          | Module                                                                 |
|--------------|-------------|------------------------------------------------------------------------|
| Lớp & trẻ    | `CLASSROOM` | Lớp học, hồ sơ trẻ, điểm danh                                          |
| Thực đơn & sức khỏe | `NUTRITION` | Thực đơn, cân đo, sổ theo dõi, khám định kỳ                     |
| Nhân sự      | `HR`        | Hồ sơ nhân viên (trừ lương), tài liệu, công việc, chấm công & nghỉ phép |
| Tài chính    | `FINANCE`   | Học phí, thu chi, lương & phiếu lương, thông tin lương trong hồ sơ     |
| Báo cáo      | `REPORTS`   | Dashboard và xuất Excel (chỉ số tài chính cần thêm nhóm Tài chính)      |

Ma trận quyền theo module. **Trường** = đọc/ghi ở các trường được gán · **Nhóm** = như Trường nhưng chỉ khi được giao nhóm chức năng của module đó · **Xem** = chỉ đọc · **Lớp** = lớp được phân công · **Mình** = dữ liệu của bản thân · **—** = không truy cập.

| Module                        | PRINCIPAL           | VICE_PRINCIPAL | ACCOUNTANT             | TEACHER                   | NURSE          | KITCHEN          | STAFF          |
|-------------------------------|---------------------|----------------|------------------------|---------------------------|----------------|------------------|----------------|
| Trường, tài khoản, cấu hình   | Trường (+ tạo trường) | —            | —                      | —                         | —              | —                | —              |
| Nhân sự                       | Trường (cả lương)   | Nhóm (trừ lương) | Xem (lương, ngân hàng) | Mình                    | Mình           | Mình             | Mình           |
| Tài liệu                      | Trường              | Nhóm           | Trường                 | Xem + xác nhận đã đọc     | Xem + xác nhận | Xem + xác nhận   | Xem + xác nhận |
| Công việc                     | Trường              | Nhóm           | Mình                   | Mình                      | Mình           | Mình             | Mình           |
| Chấm công & nghỉ phép         | Trường              | Nhóm           | Xem                    | Mình (xin nghỉ)           | Mình           | Mình             | Mình           |
| Lớp học, hồ sơ trẻ, điểm danh | Trường              | Nhóm           | Xem                    | Lớp                       | Xem            | Xem (sĩ số)      | —              |
| Thực đơn & sức khỏe           | Trường              | Nhóm           | —                      | Lớp (cân đo, sổ theo dõi) | Trường         | Trường (thực đơn) | —             |
| Học phí & thu chi             | Trường              | Nhóm           | Trường                 | —                         | —              | —                | —              |
| Lương & phiếu lương           | Trường              | Nhóm           | Trường                 | Mình                      | Mình           | Mình             | Mình           |
| Báo cáo & dashboard           | Trường              | Nhóm           | Tài chính              | —                         | —              | —                | —              |

- **Dữ liệu chung của tổ chức** (`school_id` rỗng: năm học, khối, khoản thu, ngày lễ chung, cấu hình mặc định, món ăn chung, văn bản chung, việc chung, danh mục thu chi): chỉ hiệu trưởng sửa; vai trò khác xem nếu module cho phép.
- **Tài khoản:** hiệu trưởng tạo tài khoản và gán vai trò (trừ `PRINCIPAL`) ở các trường mình được gán, kèm nhóm chức năng cho phó hiệu trưởng. Vai trò `PRINCIPAL` chỉ do bên vận hành gán, hoặc tự gán khi hiệu trưởng tạo trường mới.
- **Phạm vi:** header chọn "Tất cả trường" (mọi trường được gán) hoặc một trường. Hôm nay, Hộp duyệt, Báo cáo gộp số liệu các trường đang chọn. Hibernate filter luôn bật: `school_id` thuộc các trường đang chọn, dòng dùng chung phải cùng `organization_id`.
- Quyền kiểm tra ở backend, không dựa vào việc ẩn menu trên giao diện.

## Kiến trúc tổng thể

```mermaid
flowchart TD
    U["Người dùng<br/>7 vai trò, máy tính + điện thoại"] --> FE
    M["Máy chấm công tại cơ sở<br/>xuất Excel hằng tháng"] -- file .xlsx --> FE
    FE["Frontend React + Vite + shadcn/ui<br/>(fork ESG HR)"]
    FE -- "REST + JWT, header X-School-Id" --> API
    FE -- "upload/tải file qua presigned URL" --> S3
    subgraph API["API Spring Boot · /api/v1"]
        SEC["Spring Security: JWT, vai trò, SchoolScope"]
        CTL["Controller REST (14 package module)"]
        SVC["Service: đối soát công, tính lương, sinh phiếu thu"]
        JPA["JPA + Hibernate filter theo school_id"]
        JOB["Job nền @Scheduled"]
        SEC --> CTL --> SVC --> JPA
    end
    API --> S3["S3 / MinIO<br/>hồ sơ, văn bản, phiếu lương"]
    API --> DB[("PostgreSQL<br/>60 bảng, Flyway")]
    API --> MAIL["Email SMTP"]
```

Frontend không còn nói chuyện trực tiếp với database như khi dùng Supabase: mọi quyền được kiểm tra ở API, riêng file đi thẳng lên storage bằng link ký do API cấp.

## Các module và nghiệp vụ chính

3 trong 10 module (nhân sự, chấm công, lương) đã có phần lớn nghiệp vụ trong ESG HR; 4 module (công việc, lớp & trẻ, học phí, thực đơn & sức khỏe) phải viết mới.

| \#  | Module                                                     | Nguồn từ ESG HR                                 | Giai đoạn |
|-----|------------------------------------------------------------|-------------------------------------------------|-----------|
| 1   | Nền tảng: đăng nhập, cơ sở, tài khoản, cấu hình, thông báo | Sửa (Login, layout)                             | 1         |
| 2   | Nhân sự                                                    | Tái sử dụng nhiều (hồ sơ 7 tab)                 | 2         |
| 3   | Tài liệu                                                   | Một phần (upload, loại tài liệu)                | 2         |
| 4   | Công việc                                                  | Viết mới                                        | 3         |
| 5   | Chấm công & nghỉ phép                                      | Tái sử dụng nhiều (bảng công, import, đối soát) | 3         |
| 6   | Lương & phiếu lương                                        | Tái sử dụng nhiều (tính lương, gửi email)       | 4         |
| 7   | Lớp học, hồ sơ trẻ, điểm danh                              | Viết mới                                        | 5         |
| 8   | Học phí & thu chi                                          | Viết mới                                        | 6         |
| 9   | Thực đơn & sức khỏe trẻ                                    | Viết mới                                        | 7         |
| 10  | Báo cáo & dashboard                                        | Viết lại (Dashboard)                            | 7         |

### 1. Nền tảng

- Đăng nhập bằng email **hoặc** số điện thoại + mật khẩu (một ô nhập, backend tự nhận dạng); tài khoản cần ít nhất một trong hai. Tài khoản do hiệu trưởng (hoặc bên vận hành) tạo, không tự đăng ký. Tạm thời không dùng email: người tạo nhập mật khẩu ban đầu, hiệu trưởng đặt lại mật khẩu trực tiếp (`POST /accounts/{id}/password`); cả hai trường hợp bắt người dùng đổi mật khẩu ở lần đăng nhập kế tiếp (`users.must_change_password`; backend từ chối mọi API trừ `GET /me` và `/auth/*` cho tới khi đổi qua `POST /auth/change-password`). Trang đăng nhập hướng dẫn liên hệ hiệu trưởng thay cho "Quên mật khẩu"; API quên mật khẩu qua email giữ lại để bật lại sau.

- Bộ chọn trường trên header: "Tất cả trường" (mọi trường được gán) hoặc từng trường; người chỉ có một trường bị khóa vào trường đó.

- Quản lý trường (`/truong`): hiệu trưởng tạo, sửa, ngừng trường; trường mới thuộc tổ chức của người tạo và tự gán vai trò hiệu trưởng cho người tạo.

- Cấu hình dùng chung của tổ chức: năm học, khối, ngày lễ (giữ danh sách ESG). Dùng chung toàn hệ thống: loại tài liệu, tham số lương/bảo hiểm, chuẩn WHO.

- Nhật ký thao tác (ai sửa gì, lúc nào) cho lương, học phí, hồ sơ trẻ.

- Thông báo trong app + email: việc được giao, đơn nghỉ chờ duyệt, tài liệu cần xác nhận, giấy tờ sắp hết hạn.

### 2. Nhân sự

- Giữ các tab hồ sơ ESG: thông tin cá nhân (quét CCCD), hồ sơ lao động, cấu hình lương, bảo hiểm & thuế, trình độ & đào tạo, thời gian làm việc.

- Thêm: vị trí (giáo viên, bảo mẫu, cấp dưỡng, y tế, kế toán, bảo vệ, quản lý), trình độ chuyên môn sư phạm mầm non, chứng chỉ bồi dưỡng, giấy khám sức khỏe định kỳ, tab "Phân công lớp".

- `staff.school_id` là cơ sở hiện tại; mỗi lần điều chuyển thêm một dòng `staff_school_assignments` kèm quyết định, nên bảng công và lương các tháng trước vẫn tính về đúng cơ sở cũ.

- Cấu hình lương tách thành bảng riêng có ngày hiệu lực, thay cho khoảng 15 cột lương/phụ cấp nằm trong bảng `employees` cũ; lịch sử điều chỉnh lương tự có.

- Cảnh báo trước 30 ngày khi hợp đồng, chứng chỉ hoặc giấy khám sức khỏe sắp hết hạn.

- Quyết định chi tiết (chốt 2026-09-30):
  - Thêm nhân viên: quét **mã QR trên CCCD gắn chip** ngay trong trình duyệt để điền số CCCD, họ tên, ngày sinh, giới tính, ngày cấp; địa chỉ trong QR là dạng cũ nên chỉ điền ô chi tiết. Ảnh 2 mặt lưu làm giấy tờ loại `CCCD`. Trùng CCCD/SĐT/email bị chặn trong tổ chức.
  - Hiệu trưởng: toàn quyền với nhân viên các trường được gán (hồ sơ, lương, điều chuyển giữa các trường của mình, cho nghỉ việc, tạo tài khoản). Phó hiệu trưởng nhóm Nhân sự: thêm/sửa hồ sơ, cho nghỉ việc, không xem lương (nhóm Tài chính thì xem được lương). Kế toán xem hồ sơ, lương, ngân hàng nhưng không sửa. Nhân viên khác chỉ xem hồ sơ của mình.
  - Điều chuyển cơ sở được đặt ngày hiệu lực tương lai; job hằng ngày áp dụng khi tới ngày. Không đặt trước lần điều chuyển gần nhất.
  - Cấu hình lương chỉ thêm bản mới có ngày hiệu lực, không sửa đè bản cũ; mọi thay đổi hồ sơ và lương ghi `audit_logs`.
  - Nhân viên tự đề xuất cập nhật SĐT/địa chỉ (hiệu trưởng hoặc phó hiệu trưởng nhóm Nhân sự duyệt) và tài khoản ngân hàng (hiệu trưởng, kế toán hoặc phó hiệu trưởng nhóm Tài chính duyệt).

### 3. Tài liệu

- **Hồ sơ gắn với người** (nhân viên, trẻ): theo danh mục `document_types` như ESG (`HOP_DONG_LAO_DONG`, `GIAY_KHAM_SUC_KHOE`…), thêm loại cho trẻ: giấy khai sinh, sổ tiêm chủng, thẻ BHYT, đơn nhập học.

- **Thư viện văn bản** của tổ chức/trường: thư mục, số hiệu, ngày ban hành, ngày hết hiệu lực, phiên bản, phạm vi xem (cả tổ chức / trường / vai trò).

- Văn bản có thể bật "yêu cầu xác nhận đã đọc"; người ban hành xem ai chưa đọc và nhắc lại.

- Phạm vi xem văn bản = trường (rỗng = cả tổ chức) + danh sách vai trò (rỗng = mọi vai trò). Hiệu trưởng ban hành cho cả tổ chức và từng trường; phó hiệu trưởng nhóm Nhân sự, kế toán ban hành trong trường mình. "Người cần đọc" là tài khoản gắn nhân viên đang làm thuộc phạm vi. Phiên bản mới có thể yêu cầu xác nhận lại. "Nhắc người chưa đọc" gửi thông báo trong app + email, tối đa 1 lần/ngày.

- File lưu trên object storage, tải về qua link ký có hạn (giống signed URL của Supabase đang dùng).

### 4. Công việc

- Giao cho một hoặc nhiều người, có hạn, ưu tiên, checklist, bình luận, đính kèm.

- Trạng thái: Mới → Đang làm → Chờ duyệt → Hoàn thành (hoặc Hủy); người giao duyệt bước cuối.

- Việc lặp lại tự sinh theo lịch (vệ sinh lớp hằng tuần, kiểm tra PCCC hằng tháng).

- Hai giao diện: bảng Kanban cho quản lý, danh sách "Việc của tôi" cho nhân viên.

### 5. Chấm công & nghỉ phép

- Giữ bộ mã công ESG (X, P, 1/2P, K, 1/2K, O, CO, TS, T, NL, NB, NN), import Excel máy chấm công và đối soát đi muộn (số phút ân hạn, số lần muộn cho phép).

- Cấu hình ca theo từng cơ sở (trường mầm non thường có ca đón sớm, ca trả muộn).

- Thêm đơn xin nghỉ có duyệt: hiệu trưởng duyệt xong hệ thống tự ghi mã P/1/2P/K vào bảng công và trừ ngày phép còn lại.

- Khóa công tháng trước khi tính lương; mở khóa cần quyền hiệu trưởng và ghi nhật ký.

- Chuyển logic đối soát (`attendanceReconciliation.ts`) về backend để bảng công và bảng lương dùng cùng một kết quả; frontend chỉ còn đọc file Excel.

- Quyết định chi tiết (chốt 2026-09-30):
  - Mỗi nhân viên có **mã chấm công** (`staff.machine_code`, duy nhất trong cơ sở) để khớp dòng trong file máy chấm công; dòng không khớp được liệt kê để gán mã, không tự tạo nhân viên như ESG.
  - Phần đối soát (phút muộn, tính muộn, sai lệch, lý do, gợi ý mã) giữ đúng kết quả `attendanceReconciliation.ts` (có test đối chiếu trên cùng file Excel mẫu). Sửa 3 lỗi của bản cũ: máy ghi K/V được tính mã K (bản cũ thành X); 1/2P cộng 0,5 ngày phép, 1/2K cộng 0,5 ngày không lương; ngày có giờ vào/ra hợp lệ, không sai lệch và chưa chấm tay thì tự điền X.
  - Cấu hình chấm công theo cơ sở, thêm bản mới theo `effective_from`: giờ ca, nghỉ trưa, phút ân hạn, số lần muộn cho phép, ngày làm việc trong tuần, ngày làm nửa buổi (mặc định thứ Bảy như ESG), số ngày phép năm. Ngày lễ dùng chung tổ chức hoặc riêng trường.
  - Đơn nghỉ theo mã công (P, K, O, CO, TS, T, NB; nửa ngày thành 1/2P, 1/2K). Duyệt xong ghi mã cho các ngày làm việc trong khoảng (bỏ ngày nghỉ tuần, ngày lễ) và trừ phép (P = 1, 1/2P = 0,5). Chặn đơn trùng ngày và đơn rơi vào tháng đã khóa công.
  - Khóa công tháng theo trường: hiệu trưởng hoặc phó hiệu trưởng nhóm Nhân sự khóa; chỉ hiệu trưởng mở khóa, bắt buộc ghi lý do (audit). Đơn nghỉ của hiệu trưởng do một hiệu trưởng của trường đó duyệt (có thể chính mình). Tháng đã khóa không sửa ô, không import, không duyệt đơn.

### 6. Lương & phiếu lương

- Giữ luồng ESG: lương cơ bản × công thực tế / công chuẩn + phụ cấp + thưởng − phạt; trạng thái Nháp → Đã duyệt → Đã trả; gửi phiếu lương qua email.

- Bổ sung phần ESG chưa có: khấu trừ BHXH/BHYT/BHTN phần người lao động, thuế TNCN (giảm trừ bản thân và người phụ thuộc đã có dữ liệu), phụ cấp thâm niên và chức vụ (ESG có trường nhưng công thức chưa cộng vào).

- Tỷ lệ và mức giảm trừ lấy từ bảng `payroll_params` theo ngày hiệu lực.

- Chủ chuỗi duyệt trước khi trả lương, bảng đã duyệt không sửa được; phiếu lương xuất PDF; nhân viên xem phiếu của mình trong app.

### 7. Lớp học, hồ sơ trẻ, điểm danh

- Năm học → khối theo độ tuổi (nhà trẻ, mẫu giáo 3–4, 4–5, 5–6 tuổi) có sĩ số tối đa → lớp → giáo viên phụ trách.

- Hồ sơ trẻ: thông tin cá nhân, mã định danh, BHYT, ghi chú dị ứng/lưu ý, phụ huynh và danh sách người được phép đón.

- Trạng thái trẻ: Đang học, Bảo lưu, Đã nghỉ, Hoàn thành; lịch sử chuyển lớp; lên lớp hàng loạt đầu năm học.

- Điểm danh sáng trên điện thoại: Có mặt / Vắng có phép / Vắng không phép, giờ đến, giờ về, người đón.

- Chốt điểm danh trước giờ báo ăn (cấu hình theo cơ sở) để cấp dưỡng có số suất và học phí có số ngày vắng.

### 8. Học phí & thu chi

- Danh mục khoản thu theo cách tính: cố định theo tháng (học phí), theo ngày (tiền ăn), một lần (đồng phục, cơ sở vật chất), tự chọn (năng khiếu).

- Biểu phí theo cơ sở, năm học và khối; miễn giảm theo trẻ (anh chị em, con nhân viên) có thời hạn.

- Sinh phiếu thu hàng loạt mỗi tháng: tiền ăn tạm tính theo số ngày học dự kiến, hoàn lại ngày vắng có phép tháng trước theo quy tắc cấu hình, cộng nợ cũ.

- Ghi nhận thanh toán nhiều lần (tiền mặt, chuyển khoản), công nợ theo trẻ, in/gửi thông báo học phí, xuất Excel.

- Sổ thu chi khác theo danh mục (thực phẩm, điện nước, sửa chữa) có chứng từ; lương đã trả tự vào sổ chi.

### 9. Thực đơn & sức khỏe trẻ

- Danh mục món ăn kèm nguyên liệu và giá trị dinh dưỡng (kcal, đạm, béo, bột đường) mỗi suất.

- Thực đơn tuần theo cơ sở và khối, sao chép từ tuần trước; số suất = số trẻ có mặt đã chốt.

- Cân đo định kỳ: hệ thống xếp kênh cân nặng/tuổi, chiều cao/tuổi, BMI/tuổi theo chuẩn tăng trưởng WHO và vẽ biểu đồ tăng trưởng của trẻ.

- Khám sức khỏe định kỳ, sổ theo dõi hằng ngày (sốt, dặn thuốc, sự cố nhỏ) có ô "đã báo phụ huynh".

- Trẻ có ghi chú dị ứng hiện cảnh báo ở màn hình điểm danh và thực đơn.

### 10. Báo cáo & dashboard

- Dashboard theo các trường đang chọn ("Tất cả trường" hoặc một trường): sĩ số theo trường, tỷ lệ đi học trong ngày, nhân sự, công nợ học phí, thu chi tháng, việc quá hạn.

- Khi chọn nhiều trường: thêm bảng so sánh giữa các trường; Hôm nay và Hộp duyệt cũng gộp các trường đang chọn.

- **Hôm nay** (`GET /today`, hiệu trưởng và phó hiệu trưởng nhóm Lớp & trẻ): từng lớp có sĩ số, có mặt / vắng có
  phép / vắng không phép, đã điểm danh chưa, giáo viên phụ trách (ai nghỉ, ai thay), lớp thiếu người; danh sách trẻ
  vắng; nhân viên nghỉ hôm nay (đơn đã duyệt) và người có thể dạy thay; số mục chờ duyệt, việc đến hạn hôm nay và quá
  hạn. Ngày học tính như màn hình điểm danh trẻ (trừ Chủ nhật và ngày lễ).

- **Phân công dạy thay** (`POST /substitutions`, hiệu trưởng, phó hiệu trưởng nhóm Lớp & trẻ hoặc Nhân sự): chọn
  người cùng trường thay giáo viên nghỉ ở một lớp trong ngày; người được phân công nhận thông báo. Mỗi lớp + giáo viên
  nghỉ + ngày có một người thay (phân công lại thì thay thế).

- **Hộp duyệt** (`GET /approvals`, `POST /approvals/{type}/{id}/approve|reject`): gộp đơn nghỉ chờ duyệt mà người
  xem có quyền duyệt (không gồm đơn của chính mình) và việc chờ duyệt do người xem quản lý. Duyệt/từ chối gọi lại
  luồng của từng module (đơn nghỉ: ghi bảng công, trừ phép, chặn tháng đã khóa; việc: duyệt = Hoàn thành, từ chối =
  quay lại Đang làm kèm bình luận lý do). Đề xuất sửa hồ sơ vẫn duyệt ở trang riêng.

- Xuất Excel cho bảng công, bảng lương, công nợ, danh sách trẻ.

## Mô hình dữ liệu

60 bảng PostgreSQL, quản lý bằng Flyway migration. Repo ESG HR không có file schema nào, nên đây là schema viết mới, dựa trên các bảng mà code cũ truy vấn.

Quy ước chung: khóa chính `id` kiểu UUID; mọi bảng có `created_at`, `updated_at`, `created_by`; bảng nghiệp vụ có `school_id` (rỗng = dùng chung trong tổ chức, khi đó bảng có `organization_id`); nhân viên, trẻ, phiếu thu xóa mềm bằng `deleted_at`; tiền lưu `numeric(14,0)` (đồng); cột dạng trạng thái dùng `varchar` + CHECK thay vì enum của Postgres để dễ migration.

| Module    | Bảng                        | Cột chính / ghi chú                                                                                                                                                                                          | Thay cho bảng ESG                                |
|-----------|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| Nền tảng  | `organizations`             | name — một khách hàng (một hoặc nhiều hiệu trưởng cùng quản lý); dữ liệu dùng chung của các trường thuộc tổ chức gắn `organization_id` | — |
| Nền tảng  | `schools`                   | organization_id, code (duy nhất trong tổ chức), name, province_code, ward_code (mã theo `addressData.json`), address_detail, phone, license_no, is_active | — |
| Nền tảng  | `users`                     | organization_id, email? (unique), phone? (unique, chỉ chữ số; cần email hoặc phone), full_name, password_hash, must_change_password, staff_id?, guardian_id?, is_active, last_login_at — đăng nhập bằng email hoặc phone | Supabase Auth |
| Nền tảng  | `user_roles`                | user_id, role_code, school_id (bắt buộc), function_groups? (chỉ VICE_PRINCIPAL: CLASSROOM / NUTRITION / HR / FINANCE / REPORTS) | — |
| Nền tảng  | `refresh_tokens`            | user_id, token_hash, family_id (chuỗi token xoay vòng), remember_me, expires_at, revoked_at                                                                                                                  | —                                                |
| Nền tảng  | `password_reset_tokens`     | user_id, token_hash, expires_at (30 phút), used_at — link quên mật khẩu dùng một lần                                                                                                                        | —                                                |
| Nền tảng  | `school_years`              | organization_id, name (2026–2027, duy nhất trong tổ chức), start_date, end_date, is_current (một năm hiện tại mỗi tổ chức) | — |
| Nền tảng  | `holidays`                  | organization_id, school_id? (rỗng = cả tổ chức), holiday_date, name, is_custom | `holidays` |
| Nền tảng  | `notifications`             | user_id, type, title, body, link, read_at, dedupe_key (không tạo trùng thông báo của job)                                                                                                                                                                    | —                                                |
| Nền tảng  | `audit_logs`                | user_id, entity, entity_id, action (CREATE / UPDATE / DELETE), before_data/after_data (jsonb); thời điểm = created_at                                                                                         | —                                                |
| Tài liệu  | `files`                     | organization_id, school_id? (rỗng = dùng chung trong tổ chức), storage_key, original_name, mime_type, size_bytes, status (PENDING / READY), uploaded_by — chỉ file READY mới tải được                                             | Supabase Storage                                 |
| Tài liệu  | `document_types`            | code, name, scope (STAFF / CHILD / LIBRARY), has_expiry                                                                                                                                                      | `document_types`                                 |
| Tài liệu  | `staff_documents`           | staff_id, document_type_id, file_id, issued_date, expiry_date                                                                                                                                                | `employee_documents`                             |
| Tài liệu  | `child_documents`           | child_id, document_type_id, file_id, expiry_date                                                                                                                                                             | —                                                |
| Tài liệu  | `doc_folders`               | school_id?, parent_id, name                                                                                                                                                                                  | —                                                |
| Tài liệu  | `library_documents`         | folder_id, school_id?, title, doc_number, issued_date, effective_to, visible_roles (rỗng = mọi vai trò), require_ack, ack_version_no (phiên bản cần xác nhận lại)                                                                                                                 | —                                                |
| Tài liệu  | `library_document_versions` | document_id, version_no, file_id, note                                                                                                                                                                       | —                                                |
| Tài liệu  | `document_acks`             | document_id, staff_id, version_no, acknowledged_at                                                                                                                                                                       | —                                                |
| Nhân sự   | `staff`                     | school_id, staff_code, full_name, dob, gender, citizen_id, phone, email, địa chỉ thường trú/hiện tại (không cấp huyện), position, qualification, bank\_\*, social_insurance_no, start_date, end_date, status (ACTIVE / TERMINATED), photo_file_id, citizen_id_issued_on, personal_tax_code, health_insurance_no, termination_reason, deleted_at | `employees`                                      |
| Nhân sự   | `staff_school_assignments`  | staff_id, school_id, from_date, to_date, decision_file_id                                                                                                                                                    | —                                                |
| Nhân sự   | `staff_contracts`           | staff_id, contract_type, contract_no, start_date, end_date, file_id                                                                                                                                          | cột trong `employees`                            |
| Nhân sự   | `staff_salary_configs`      | staff_id, effective_from, salary_mode, base_salary, coefficient, region, allowances (jsonb), insurance_salary                                                                                                | cột trong `employees` + `salary_adjustments`     |
| Nhân sự   | `staff_dependents`          | staff_id, full_name, relationship, dob, id_number, from_month, to_month                                                                                                                                      | `dependents`                                     |
| Nhân sự   | `staff_certificates`        | staff_id, name, issued_by, issue_date, expiry_date, file_id                                                                                                                                                  | jsonb trong `employees`                          |
| Nhân sự   | `staff_trainings`           | staff_id, course_name, provider, start_date, end_date, result, file_id                                                                                                                                       | jsonb trong `employees`                          |
| Nhân sự   | `staff_change_requests`      | staff_id, school_id, changes (jsonb: SĐT, địa chỉ, ngân hàng), status (PENDING / APPROVED / REJECTED), reviewed_by, reviewed_at, note — nhân viên tự đề xuất cập nhật | — |
| Công việc | `tasks`                     | school_id?, title, description, priority, status, due_at, created_by, parent_id, recurrence_rule                                                                                                             | —                                                |
| Công việc | `task_assignees`            | task_id, staff_id, status, done_at                                                                                                                                                                           | —                                                |
| Công việc | `task_checklist_items`      | task_id, content, is_done, order_no                                                                                                                                                                          | —                                                |
| Công việc | `task_comments`             | task_id, user_id, body, file_id?                                                                                                                                                                             | —                                                |
| Công việc | `task_attachments`          | task_id, file_id                                                                                                                                                                                             | —                                                |
| Chấm công | `attendance_configs`        | school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end, late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days                                | `attendance_config`                              |
| Chấm công | `attendance_import_batches` | school_id, month, file_id, imported_by, row_count                                                                                                                                                            | —                                                |
| Chấm công | `attendance_punches`        | batch_id, staff_id, work_date, check_in, check_out                                                                                                                                                           | `attendance_raw_machine`                         |
| Chấm công | `staff_attendance_days`     | school_id, staff_id, work_date, status_code, late_minutes, is_counted_late, is_discrepancy, discrepancy_reason, suggested_status, note, leave_time, return_time, confirmed_by                                | `attendance_manual` + `daily_attendance_summary` |
| Chấm công | `staff_attendance_months`   | staff_id, month, total_work, paid_leave, unpaid_leave, holiday_leave, late_count, locked_at                                                                                                                  | `attendance_monthly_summaries`                   |
| Chấm công | `leave_balances`            | staff_id, year, annual_days, used_days                                                                                                                                                                       | cột trong `employees`                            |
| Chấm công | `leave_requests`            | school_id, staff_id, leave_code, from_date, to_date, half_day, reason, file_id?, status, approved_by, approved_at, review_note                                                                               | —                                                |
| Lương     | `payroll_params`            | effective_from, bhxh/bhyt/bhtn employee rate, personal_deduction, dependent_deduction, pit_brackets (jsonb)                                                                                                  | —                                                |
| Lương     | `payroll_periods`           | school_id, month, standard_work_days, status (DRAFT / APPROVED / PAID), approved_by                                                                                                                          | —                                                |
| Lương     | `payroll_records`           | period_id, staff_id, work_days, base_salary, allowances, bonus, fines, insurance_deduction, taxable_income, pit, net_salary, is_paid, paid_at, email_sent_at, payslip_file_id                                | `payroll_records`                                |
| Lớp & trẻ | `age_groups`                | code, name, min_months, max_months, max_class_size                                                                                                                                                           | —                                                |
| Lớp & trẻ | `classes`                   | school_id, school_year_id, age_group_id, name, room, capacity                                                                                                                                                | —                                                |
| Lớp & trẻ | `class_substitutions`       | school_id, sub_date, class_id, absent_staff_id, staff_id — người dạy thay trong ngày; duy nhất theo (class_id, absent_staff_id, sub_date)                                                                   | —                                                |
| Lớp & trẻ | `class_teachers`            | class_id, staff_id, role (MAIN / ASSISTANT), from_date, to_date                                                                                                                                              | —                                                |
| Lớp & trẻ | `children`                  | school_id, child_code, full_name, nickname, dob, gender, personal_id, health_insurance_no, địa chỉ, allergy_note, status, enrolled_at, left_at                                                               | —                                                |
| Lớp & trẻ | `guardians`                 | full_name, phone, email, citizen_id, user_id? (cổng phụ huynh sau này)                                                                                                                                       | —                                                |
| Lớp & trẻ | `child_guardians`           | child_id, guardian_id, relationship, is_primary, can_pick_up                                                                                                                                                 | —                                                |
| Lớp & trẻ | `class_enrollments`         | child_id, class_id, from_date, to_date                                                                                                                                                                       | —                                                |
| Lớp & trẻ | `child_attendance`          | child_id, class_id, attend_date, status, check_in_at, check_out_at, picked_up_by, note, locked_at                                                                                                            | —                                                |
| Sức khỏe | `growth_measurements` | school_id, child_id, class_id?, measured_on, weight_kg, height_cm, age_days, age_months, bmi, weight_z/height_z/bmi_z, weight_status, height_status, bmi_status, standard (WHO_2006 / WHO_2007), source (CLASS / CHECKUP / PARENT), recorded_by | — |
| Sức khỏe | `who_growth_standards` | indicator (WFA / HFA / BFA), gender, age_unit (DAY / MONTH), age, l, m, s, source (WHO_2006 / WHO_2007) | — |
| Sức khỏe | `health_checkups` | school_id, child_id, checkup_date, provider, summary, file_id | — |
| Sức khỏe | `health_logs` | school_id, child_id, class_id?, log_date, type (FEVER / MEDICINE / INCIDENT / OTHER), content, temperature_c, parent_notified_at, parent_notified_by, recorded_by | — |
| Thực đơn | `dishes` | school_id? (rỗng = chung chuỗi), name, ingredients (jsonb [{name, grams}]), kcal, protein_g, fat_g, carb_g, active | — |
| Thực đơn | `menus` | school_id, age_group_id?, week_start (thứ Hai), status (DRAFT / PUBLISHED), note, published_at; duy nhất theo cơ sở + khối + tuần | — |
| Thực đơn | `menu_items` | school_id, menu_id, menu_date, meal (BREAKFAST / LUNCH / AFTERNOON / SNACK), dish_id, order_no, note | — |
| Học phí   | `fee_types`                 | code, name, calc_method (MONTHLY / PER_DAY / ONE_TIME / OPTIONAL), refundable_on_absence                                                                                                                     | —                                                |
| Học phí   | `fee_schedules`             | school_id, school_year_id, age_group_id?, fee_type_id, amount, effective_from                                                                                                                                | —                                                |
| Học phí   | `child_fee_items`           | child_id, fee_type_id, from_month, to_month (khoản tự chọn trẻ đăng ký)                                                                                                                                      | —                                                |
| Học phí   | `child_discounts`           | child_id, fee_type_id?, percent, amount, reason, from_month, to_month                                                                                                                                        | —                                                |
| Học phí   | `invoices`                  | school_id, child_id, period_month, subtotal, discount, carried_balance, amount_due, amount_paid, status (DRAFT / ISSUED / PARTIAL / PAID / CANCELLED), due_date                                              | —                                                |
| Học phí   | `invoice_lines`             | invoice_id, fee_type_id, quantity, unit_price, amount, note                                                                                                                                                  | —                                                |
| Học phí   | `payments`                  | invoice_id, amount, method, paid_at, reference, received_by                                                                                                                                                  | —                                                |
| Thu chi   | `cash_categories`           | direction (IN / OUT), name                                                                                                                                                                                   | —                                                |
| Thu chi   | `cash_entries`              | school_id, category_id, direction, amount, entry_date, description, source (MANUAL / PAYMENT / PAYROLL), source_id, file_id                                                                                  | —                                                |

```mermaid
erDiagram
    schools ||--o{ staff : "có"
    schools ||--o{ classes : "có"
    schools ||--o{ children : "có"
    staff }o--o{ classes : "class_teachers"
    classes }o--o{ children : "class_enrollments"
    staff ||--o{ staff_attendance_days : ""
    staff ||--o{ leave_requests : ""
    staff ||--o{ payroll_records : ""
    staff ||--o{ task_assignees : ""
    task_assignees }o--|| tasks : ""
    classes ||--o{ child_attendance : ""
    children ||--o{ child_attendance : ""
    children }o--o{ guardians : "child_guardians"
    children ||--o{ invoices : ""
    invoices ||--o{ payments : ""
    children ||--o{ growth_measurements : ""
    children ||--o{ health_logs : ""
```

Sơ đồ chỉ vẽ trục chính; tài khoản (`users`) nối với `staff` hoặc `guardians`, còn cấu hình và danh mục nằm trong bảng ở trên.

## Backend Spring Boot

Một ứng dụng Spring Boot duy nhất (modular monolith), chia package theo module; đủ cho một chuỗi vài chục cơ sở và dễ tách service sau nếu cần.

**Công nghệ:** Java 21, Spring Boot 4.0, Spring Web, Spring Data JPA, Spring Security, Flyway, Bean Validation, MapStruct, springdoc-openapi (Swagger), Spring Mail, Apache POI (Excel), OpenPDF (phiếu lương, phiếu thu), AWS SDK S3 (chạy với S3 hoặc MinIO), Testcontainers cho test tích hợp.

**Cấu trúc package** (mỗi module có `controller`, `service`, `repository`, `entity`, `dto`):

    com.preschool
    ├── common      // lỗi chuẩn, phân trang, audit, file storage, email
    ├── security    // JWT, SchoolScope, @PreAuthorize helpers
    ├── school      // cơ sở, năm học, ngày lễ, cấu hình
    ├── account     // users, roles, đăng nhập
    ├── staff       // hồ sơ, hợp đồng, lương cấu hình
    ├── document    // hồ sơ file, thư viện văn bản
    ├── task
    ├── attendance  // chấm công NV, đối soát, nghỉ phép
    ├── payroll
    ├── classroom   // lớp, trẻ, phụ huynh, điểm danh trẻ
    ├── health      // cân đo, sức khỏe, thực đơn
    ├── finance     // khoản thu, phiếu thu, thanh toán, sổ thu chi
    ├── report
    └── notification

**Xác thực:** access token JWT 15 phút gửi qua header `Authorization`; refresh token 7 ngày trong cookie httpOnly, lưu hash ở `refresh_tokens` để thu hồi khi đăng xuất hoặc khóa tài khoản; mật khẩu BCrypt.

**Lọc dữ liệu theo cơ sở** (điểm dễ sai nhất):

1.  Filter đọc JWT, nạp danh sách `(role, school_id)` của người dùng vào `SchoolScope` theo request.

2.  Frontend gửi cơ sở đang chọn qua header `X-School-Id`; backend từ chối nếu cơ sở đó không nằm trong scope.

3.  Mọi query bảng nghiệp vụ đi qua Hibernate `@Filter` theo `school_id` được bật tự động, nên quên thêm điều kiện cũng không lộ dữ liệu cơ sở khác.

4.  Quyền chi tiết (lớp mình, dữ liệu của mình) kiểm tra trong service bằng `@PreAuthorize("@perm.canEditClass(#classId)")`.

5.  Test tích hợp bắt buộc cho mỗi endpoint: user cơ sở A gọi dữ liệu cơ sở B phải nhận 403/404.

**Quy ước API:** REST dưới `/api/v1`, phân trang `?page=&size=&sort=`, lỗi theo chuẩn RFC 7807 (`application/problem+json`) với thông điệp tiếng Việt. Frontend sinh kiểu TypeScript từ OpenAPI (`openapi-typescript`) thay cho việc tự khai báo kiểu như `types/index.ts` hiện nay.

| Nhóm          | Endpoint tiêu biểu                                                                                                                           |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Xác thực      | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password`          |
| File          | `POST /files/upload-url` (kiểm tra kích thước + loại file, tạo bản ghi PENDING, trả presigned URL), `POST /files/{id}/complete` (kiểm tra object trên storage đúng kích thước/loại đã khai báo → READY, sai thì xóa), `GET /files/{id}/download-url` |
| Nhân sự       | `GET/POST /staff`, `GET/PUT /staff/{id}`, `POST /staff/{id}/transfer`, `POST /staff/{id}/terminate`, `GET/POST /staff/{id}/salary-configs`, `GET/POST /staff/{id}/documents`, `GET /staff/expiring-documents`, `GET /staff/export`, `POST /me/change-requests`                                      |
| Tài liệu      | `GET/POST /library/documents`, `POST /library/documents/{id}/versions`, `POST /library/documents/{id}/ack`                                   |
| Công việc     | `GET/POST /tasks`, `PATCH /tasks/{id}/status`, `POST /tasks/{id}/comments`                                                                   |
| Chấm công     | `POST /attendance/imports`, `GET /attendance/staff?month=`, `PUT /attendance/staff/{staffId}/{date}`, `POST /attendance/months/{month}/lock` |
| Nghỉ phép     | `POST /leave-requests`, `POST /leave-requests/{id}/approve`, `.../reject`                                                                    |
| Lương         | `POST /payroll/periods/{month}/calculate`, `POST .../approve`, `POST .../send-payslips`                                                      |
| Lớp & trẻ     | `GET/POST /classes`, `GET/POST /children`, `POST /classes/promote` (lên lớp hàng loạt)                                                       |
| Điểm danh trẻ | `GET /classes/{id}/attendance?date=`, `PUT /classes/{id}/attendance` (cả lớp một lần), `POST .../lock`                                       |
| Sức khỏe      | `GET/PUT /classes/{id}/measurements?date=` (nhập theo lớp), `GET /children/{id}/growth-chart`, `GET/POST /health-logs`, `GET/POST /children/{id}/checkups` |
| Thực đơn      | `GET/POST/PUT /dishes`, `GET/PUT /menus?week=&ageGroupId=`, `POST /menus/copy`, `POST /menus/{id}/publish`, `GET /menus/{id}/allergy-warnings` |
| Học phí       | `POST /invoices/generate?month=`, `POST /invoices/{id}/issue`, `POST /invoices/{id}/payments`, `GET /receivables`                            |
| Báo cáo       | `GET /reports/dashboard`, `GET /reports/{name}/export` (Excel)                                                                               |
| Điều hành     | `GET /today`, `POST /substitutions`, `GET /approvals`, `POST /approvals/{type}/{id}/approve`, `.../reject`                                   |

**Việc chạy nền** (`@Scheduled`, sau này có thể chuyển sang ShedLock nếu chạy nhiều instance): sinh việc lặp lại mỗi sáng, quét giấy tờ sắp hết hạn hằng ngày, nhắc phiếu thu quá hạn hằng tuần.

**Triển khai:** Docker Compose gồm `api`, `postgres`, `minio` cho môi trường dev; production có thể dùng AWS (EC2 hoặc ECS + RDS PostgreSQL + S3) và frontend trên Vercel hoặc S3 + CloudFront.

## Tái sử dụng frontend từ ESG HR

Giữ stack React 18 + Vite + TypeScript + shadcn/ui + Tailwind; việc lớn nhất là thay mọi lời gọi `supabase.from(...)` (khoảng 70 chỗ trong 11 file: phần lớn ở `hooks/` và `lib/`, số còn lại nằm thẳng trong component upload và chấm công) bằng API client gọi Spring Boot, dùng TanStack Query đã có sẵn trong dự án.

| Phần trong ESG HR                                                                               | Xử lý                | Ghi chú                                                                                             |
|-------------------------------------------------------------------------------------------------|----------------------|-----------------------------------------------------------------------------------------------------|
| `components/ui/*`, `NavLink`, `lib/utils`, `hooks/useMobile`, `useToast`                        | Giữ nguyên           | Thư viện giao diện shadcn                                                                           |
| `components/layout/*` (Sidebar, Header)                                                         | Sửa                  | Menu theo vai trò, bộ chọn cơ sở, bỏ chữ "ENSOGO Portal", đổi màu/logo                              |
| `contexts/AuthContext`, `service/authService`, `lib/supabase`, `lib/authHelpers`, `pages/Login` | Viết lại             | Gọi `/auth/*`, access token trong bộ nhớ, tự refresh; `AuthContext` thêm vai trò và cơ sở đang chọn |
| `lib/fileUploader`, `employees/shared/*UploadField`, `FileViewButton`                           | Sửa                  | Giữ UI, đổi Supabase Storage sang presigned URL từ API; dùng chung cho nhân viên và trẻ             |
| `employees/shared/CCCDUploadModal`, `DatePickerCustom`, `ConfirmModal`                          | Giữ                  | Dùng cho cả hồ sơ phụ huynh                                                                         |
| `employees/EmployeeModal` + 7 tab                                                               | Sửa → `StaffModal`   | Gộp tab An toàn vào hồ sơ; thêm tab Phân công lớp, Chứng chỉ sư phạm; bỏ trường quận/huyện          |
| `employees/schemas/employeeFormSchema` (zod)                                                    | Sửa                  | Tách phần lương ra form riêng theo `staff_salary_configs`                                           |
| `pages/Attendance`, `components/attendance/*`                                                   | Giữ UI               | Lấy dữ liệu từ API; thêm tab Đơn nghỉ                                                               |
| `lib/attendanceReconciliation`, `data/attendanceTypes`                                          | Chuyển logic về Java | Giữ bảng mã công ở frontend để hiển thị màu/nhãn                                                    |
| `pages/Payroll`, `pages/Payslips`, `hooks/usePayrollData`                                       | Giữ UI               | Công thức tính lương chuyển về backend                                                              |
| `api/send-salary-emails`, `api/_lib/emailService`, `service/emailService`                       | Chuyển sang Java     | Spring Mail; giữ mẫu HTML email                                                                     |
| `data/addressDataLoader` + `public/addressData.json`, `bankData`, `vietnameseHolidays`          | Giữ                  | Dữ liệu địa chỉ đã theo 34 tỉnh + phường/xã                                                         |
| `pages/Dashboard`                                                                               | Viết lại             | Chỉ số chuỗi/cơ sở, giữ cách dùng Recharts                                                          |
| `pages/Settings`                                                                                | Sửa                  | Cơ sở, năm học, khối, khoản thu, ca làm việc, ngày lễ                                               |
| `lovable-tagger`, README của Lovable, `vercel.json` (API functions), `@supabase/supabase-js`    | Bỏ                   |                                                                                                     |

Trang mới cần viết: Tài liệu, Công việc (Kanban + Việc của tôi), Lớp học, Hồ sơ trẻ, Điểm danh trẻ (tối ưu điện thoại), Thực đơn, Sức khỏe, Học phí, Thu chi, Quản lý tài khoản.

## Lộ trình

| Giai đoạn | Tuần (ước lượng) | Xong khi |
| --- | --- | --- |
| 1. Nền tảng | 1–2 | Đăng nhập, phân quyền theo cơ sở chạy được |
| 2. Nhân sự + Tài liệu | 3–5 | Hồ sơ NV và file chạy trên API mới |
| 3. Chấm công, nghỉ phép, công việc | 6–8 | Bảng công khớp kết quả ESG HR cũ |
| 4. Lương & phiếu lương | 9–10 | Lương 1 tháng thật khớp tính tay |
| 5. Lớp, hồ sơ trẻ, điểm danh | 11–13 | GV điểm danh cả lớp trên điện thoại |
| 6. Học phí & thu chi | 14–16 | Phiếu thu 1 tháng khớp sổ kế toán |
| 7. Thực đơn, sức khỏe, dashboard | 17–19 | Chủ chuỗi xem đủ số liệu mọi cơ sở |

Module có sẵn từ ESG HR đi trước để sớm có bản dùng được; học phí đứng sau điểm danh trẻ vì tiền ăn tính từ số ngày vắng. Số tuần là ước lượng, cần chỉnh theo thời gian thực tế bạn có; có hai người thì giai đoạn 5 chạy song song được với 3–4, rút còn khoảng 16 tuần.

Giai đoạn 1 gồm:

- Backend: dựng project Spring Boot, Flyway với các bảng nền tảng, đăng nhập JWT, `SchoolScope` + Hibernate filter, upload file qua presigned URL, Docker Compose.

- Frontend: fork repo ESG HR, bỏ Supabase và Lovable, thêm API client + TanStack Query, `AuthContext` mới, bộ chọn cơ sở, đổi tên và thương hiệu.

- Test tích hợp chặn truy cập chéo cơ sở chạy trong CI ngay từ đầu.

- Quên mật khẩu qua email làm sau cùng trong giai đoạn 1 (hoặc chuyển sang giai đoạn 2); trong lúc chờ, link "Quên mật khẩu?" hướng dẫn liên hệ văn phòng điều hành.

## Câu hỏi cần chốt trước khi code

- Chuỗi hiện có bao nhiêu cơ sở, khoảng bao nhiêu trẻ và nhân viên? (ảnh hưởng cấu hình server, không đổi thiết kế)

- Hiệu trưởng có được xem lương nhân viên cơ sở mình không?

- Học phí thu tại từng cơ sở hay kế toán chuỗi thu tập trung? Biểu phí giống nhau giữa các cơ sở hay khác?

- Quy tắc hoàn tiền ăn: hoàn theo mọi ngày vắng có phép, hay chỉ khi báo trước giờ báo ăn, hay từ ngày vắng thứ N?

- Máy chấm công ở các cơ sở có xuất cùng định dạng Excel với file ESG HR đang đọc không?

- Công thức lương: chuỗi dùng lương cứng, lương hệ số hay cả hai? Có phụ cấp đặc thù (đứng lớp, trả muộn, ngày thứ Bảy) không?

- Cổng phụ huynh có nằm trong kế hoạch năm nay không? Nếu có, nên làm sau giai đoạn 6.

- Tên sản phẩm, logo, màu thương hiệu của chuỗi.

- Triển khai trên AWS hay máy chủ riêng/VPS?

## Nhật ký thay đổi thiết kế

| Ngày | Thay đổi | Lý do |
| --- | --- | --- |
| 2026-09-29 | Spring Boot 3 → 4.0 | Nhánh 3.x hết hỗ trợ OSS; dự án mới nên chọn luôn bản đang được hỗ trợ |
| 2026-09-29 | `users` thêm `phone`, `full_name`; đăng nhập bằng email hoặc SĐT | ESG HR đang đăng nhập bằng SĐT, giữ thói quen người dùng |
| 2026-09-29 | `files` thêm `school_id`, `status`; thêm `POST /files/{id}/complete` | Cần `school_id` để chặn tải file chéo cơ sở; bước complete chặn file quá lớn/sai loại và file upload dở |
| 2026-09-29 | Package gốc `com.preschool` | Chốt tên package |
| 2026-09-29 | Quên mật khẩu làm sau cùng trong giai đoạn 1 | Ưu tiên luồng đăng nhập + phân quyền cơ sở |
| 2026-09-29 | Chi tiết hóa khi viết V1: `refresh_tokens` thêm `family_id`, `remember_me`; `audit_logs.at` → `created_at`, `before/after` → `before_data/after_data`; `schools` lưu mã tỉnh/phường | Phục vụ xoay vòng refresh token + "Ghi nhớ đăng nhập"; thống nhất quy ước cột chung |
| 2026-09-29 | Dùng Spring Boot 4.0.8 (4.1.x đã có) | Giữ đúng quyết định 4.0; springdoc 3.0.x chỉ build cho 4.0. Nâng 4.1 là bước nhỏ, làm khi cần |
| 2026-09-29 | MinIO dev dùng image `chainguard/minio` | MinIO ngừng phát hành image community trên Docker Hub/Quay |
| 2026-09-29 | Thêm bảng `password_reset_tokens` (V2) và API forgot/reset password; dev dùng Mailpit bắt email | Quên mật khẩu qua email (module Nền tảng); token dùng một lần, chỉ lưu hash |
| 2026-09-30 | Giai đoạn 2: `staff` thêm photo_file_id, citizen_id_issued_on, personal_tax_code, health_insurance_no, termination_reason; bảng mới `staff_change_requests`; `notifications.dedupe_key`; `library_documents.visible_roles`, `ack_version_no`; `document_acks.version_no`; `users.staff_id` thành FK | Quét CCCD, cho nghỉ việc, tự phục vụ, job cảnh báo hết hạn không trùng, phạm vi xem theo vai trò, xác nhận lại khi có phiên bản mới |
| 2026-09-30 | `library_documents` thêm `current_version_no` (số phiên bản mới nhất) và `last_reminded_at` (giới hạn nhắc 1 lần/ngày); `doc_folders` không trùng tên trong cùng thư mục cha; API thư viện: `/library/folders`, `/library/documents` (+ `/versions`, `/ack`, `/readers`, `/remind`, `/versions/{no}/download-url`) | Chi tiết hóa khi viết V4 cho các hành vi đã chốt (phiên bản, xác nhận lại, nhắc người chưa đọc) |
| 2026-09-30 | Giai đoạn 3: `staff.machine_code`; `attendance_configs` thêm `effective_from`, `half_day_weekdays`, `annual_leave_days`; `staff_attendance_days` thêm `school_id`, `discrepancy_reason`, `suggested_status`; `leave_requests` thêm `school_id`, `file_id`, `review_note`; bảng mới `task_attachments`, `attendance_month_locks` (trạng thái khóa công theo cơ sở + tháng); `staff_attendance_days.source` (MANUAL / MACHINE / LEAVE); mọi bảng chấm công/nghỉ phép/công việc có `school_id`; lịch sử trạng thái việc ghi `audit_logs` | Khớp file máy chấm công với nhân viên; tham số quy định lưu theo ngày hiệu lực (quy tắc 5); phân tách theo cơ sở (quy tắc 1); đính kèm việc |
| 2026-09-30 | Đối soát chấm công giữ kết quả ESG nhưng sửa 3 lỗi (K/V thành X, nửa ngày không cộng vào tổng phép/không lương, ngày có giờ máy để trống); thứ Bảy nửa buổi thành cấu hình | Chủ dự án chốt khi lập kế hoạch giai đoạn 3 |
| 2026-09-30 | Quyền nhân sự chi tiết (hiệu trưởng được cho nghỉ việc; điều chuyển/lương/tài khoản chỉ cấp chuỗi), duyệt đề xuất, điều chuyển ngày tương lai | Chủ dự án chốt khi lập kế hoạch giai đoạn 2 |
| 2026-10-01 | Giai đoạn 6 (V10): `fee_types` thêm `active`, `order_no`, `refundable_on_absence` chỉ cho PER_DAY; `fee_schedules` theo cơ sở + năm học + nhóm tuổi (rỗng = mọi nhóm) + `effective_from`; bảng mới `finance_configs` (quy tắc hoàn tiền ăn, cách tính tháng nhập/nghỉ giữa chừng, ngày hạn nộp; có `effective_from`); `invoices` thêm `class_id`, `refund`, `carried_balance`, `carried_to_id`, `issued_by`, `cancelled_at`, `cancel_reason`, trạng thái `CARRIED`, số phiếu cấp khi phát hành, không trùng trẻ + tháng (trừ phiếu hủy); `invoice_lines` có `kind` (CHARGE/REFUND/DISCOUNT/CARRIED), tiền có dấu; `payments.paid_on` (ngày) thay `paid_at`, hủy thay vì xóa (`voided_*`); `cash_categories` thêm `school_id`, `system_code`; `cash_entries.source` (MANUAL/PAYMENT/PAYROLL) + `source_id` duy nhất | Sinh phiếu thu ở backend (quy tắc 4), tham số cấu hình theo ngày hiệu lực (quy tắc 5), chuyển nợ cũ/trả thừa sang tháng sau có dấu vết, thanh toán tự ghi sổ thu |
| 2026-10-01 | API bổ sung giai đoạn 6: `GET /invoices/summary`, `GET /invoices/export` (Excel), `POST /invoices/{id}/payments/{paymentId}/void` (lý do bắt buộc), `GET /receivables/summary`, `GET /cash-entries/summary`, `GET /cash-entries/{id}/file-url`; quyền tài chính của hiệu trưởng là xem + ghi nhận thu tiền | Thẻ tổng trên trang phiếu thu/công nợ/sổ thu chi, xuất Excel, sửa nhầm lần thu có dấu vết, xem chứng từ qua presigned URL |
| 2026-10-01 | Giai đoạn 7 (V11, V12): `who_growth_standards` lưu bảng LMS chính thức của WHO (2006 theo ngày tuổi 0–1826, 2007 theo tháng 60–96) thay cho các mốc SD; `growth_measurements` thêm `school_id`, `class_id`, `recorded_by`, `source` (CLASS/CHECKUP/PARENT), `bmi`, z-score và `standard`; `dishes.school_id` (rỗng = chung chuỗi); `menus` duy nhất theo cơ sở + khối + tuần, có `note`, `published_at`; `menu_items` thêm `order_no`, `note`; `health_logs`, `health_checkups` thêm `school_id`; cảnh báo dị ứng so khớp ghi chú dị ứng (không phân biệt hoa thường, dấu) với tên nguyên liệu, trẻ có ghi chú dị ứng luôn được liệt kê | Xếp kênh đúng thuật toán WHO (z-score hiệu chỉnh, nội suy tháng) và kiểm chứng được với gói anthro/anthroplus; phân tách theo cơ sở (quy tắc 1); ghi nguồn số liệu cân đo |
| 2026-10-01 | Mô hình quyền mới: bỏ `OWNER`, `CHAIN_ADMIN`; `PRINCIPAL` là vai trò cao nhất, quản lý nhiều trường, toàn quyền kể cả lương và tài khoản; thêm `VICE_PRINCIPAL` giới hạn theo trường + nhóm chức năng (`user_roles.function_groups`); mọi vai trò gắn trường. Thêm `organizations`; `organization_id` ở `schools`, `users`, các bảng có `school_id` rỗng (dùng chung trong tổ chức) và danh mục `school_years`, `age_groups`, `fee_types`; ràng buộc duy nhất tính trong tổ chức. API `/schools` (tạo, sửa, ngừng; trường mới tự gán người tạo). Hibernate filter luôn bật (cả "Tất cả trường"). Bỏ giả định "hiệu trưởng không xem lương" | Chủ dự án đổi mô hình: nhiều hiệu trưởng độc lập trên một hệ thống, dữ liệu dùng chung tách theo tổ chức; tạo tổ chức/hiệu trưởng do bên vận hành |
| 2026-10-02 | Tạm bỏ email khỏi luồng tài khoản (V14): `users.email` không bắt buộc (cần email hoặc phone), thêm `must_change_password`; tạo tài khoản kèm mật khẩu ban đầu (bỏ email mời), `POST /accounts/{id}/password` thay `send-reset`, `POST /auth/change-password`; ẩn "Quên mật khẩu" | Chủ dự án chưa dùng email; tài khoản do hiệu trưởng hoặc bên vận hành tạo |
| 2026-10-02 | Thêm API điều hành `GET /today`, `POST /substitutions`, `GET /approvals` + duyệt/từ chối (V15: bảng `class_substitutions`) | Trang Hôm nay, Hộp duyệt và phân công dạy thay của bản demo chạy được với backend thật |

## Nguồn

- Mã nguồn ESG-HR-system (file zip bạn gửi): cấu trúc, bảng Supabase được truy vấn, luồng chấm công và tính lương.

- [Thông tư 52/2020/TT-BGDĐT về Điều lệ Trường mầm non — LuatVietnam](https://luatvietnam.vn/giao-duc/thong-tu-52-2020-tt-bgddt-ve-dieu-le-truong-mam-non-200235-d1.html): còn hiệu lực, đã sửa đổi bởi Thông tư 09/2025, 15/2025 và 51/2026.

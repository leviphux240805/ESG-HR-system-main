# Hoàn thiện: từ bản demo thành sản phẩm thật

Mục tiêu: giữ nguyên giao diện khách đã duyệt (bản demo), mỗi trang chạy được ở cả hai chế độ — dữ liệu thật
(`VITE_DATA_SOURCE=api`, backend Spring Boot) và demo (`mock`) — với cùng dạng dữ liệu (type sinh từ OpenAPI).

Cách làm: mỗi lần một module theo thứ tự bảng; module xong khi `./mvnw test`, `npm run build`, `npm run build:demo`
qua, có test tích hợp (quyền theo vai trò, chặn chéo trường), cập nhật bảng này và commit.

Khảo sát ngày 2026-10-03 (so sánh lời gọi trong `frontend/src/api`, handler trong `frontend/src/mock/handlers`,
endpoint trong `frontend/openapi.json`).

| # | Module | Trang | Mock có | API backend có | Còn thiếu | Trạng thái |
|---|--------|-------|---------|----------------|-----------|------------|
| 1 | Quyền, tài khoản | `/login`, `/doi-mat-khau`, `/tai-khoan` | Có (đăng nhập demo chọn vai trò, không có mật khẩu) | Có | — | Xong |
| 2 | Trường | `/truong` | Có | Có | — | Xong |
| 3 | Nhân sự | `/nhan-su`, `/nhan-su/moi`, `/nhan-su/:id`, `/nhan-su/de-xuat`, `/nhan-su/giay-to-het-han` | Có | Có | — (trang "Hồ sơ của tôi" xem dòng Tài liệu) | Xong |
| 4 | Lớp, trẻ, điểm danh, sổ điểm danh | `/lop-hoc`, `/tre`, `/tre/:id`, `/diem-danh`, `/so-diem-danh` | Có | Có | (Tùy chọn) thống kê đi học 30 ngày ở hồ sơ trẻ | Xong |
| 5 | Chấm công, nghỉ phép | `/cham-cong`, `/cham-cong/cau-hinh`, `/nghi-phep`, `/cua-toi/cham-cong` | Có | Có | — | Xong |
| 6 | Công việc (đính kèm) | `/cong-viec` | Có | Có | — | Xong |
| 7 | Hôm nay, Hộp duyệt | `/hom-nay`, `/hop-duyet` | Có | Có | — | Xong |
| 8 | Học phí, thu chi | `/hoc-phi/phieu-thu`, `/hoc-phi/cong-no`, `/thu-chi`, `/hoc-phi/bieu-phi`, `/hoc-phi/khoan-thu`, tab Học phí ở `/tre/:id` | Có | Có | — | Xong |
| 9 | Lương | (chưa có trang) | Không | Không (chỉ có bảng V8) | API tính lương, duyệt, phiếu lương; trang bảng lương + phiếu lương của tôi; mock; xuất Excel bảng lương ở Báo cáo đang rỗng | Chưa |
| 10 | Thực đơn, sức khỏe | `/thuc-don`, `/thuc-don/mon-an`, `/suc-khoe/can-do`, `/suc-khoe/so-theo-doi`, tab Sức khỏe ở `/tre/:id` | Gần đủ | Có | Mock: file kết quả khám; API số suất ăn theo sĩ số (`/menus/{id}/portions`) | Chưa |
| 11 | Báo cáo | `/bao-cao` | Có | Có | Xuất bảng lương phụ thuộc module Lương | Chưa |
| — | Tài liệu (ngoài danh sách) | `/tai-lieu`, `/cua-toi/van-ban`, `/cua-toi/ho-so` (có trang, chưa vào menu demo) | Không | Có | Mock toàn bộ thư viện văn bản, hồ sơ của tôi; route + menu (cần khách duyệt giao diện) | Chưa |

## Nhật ký

- 2026-10-03: lập bảng.
- 2026-10-03: Nhân sự xong. Mock thêm giấy tờ (thêm/xóa, xem file), cấu hình lương, ngân hàng, điều chuyển (lịch sử
  công tác), đề xuất cập nhật hồ sơ (gửi, duyệt, từ chối); quyền mock theo mô hình mới (hiệu trưởng điều chuyển, xem
  và sửa lương). Backend: ngày nghiệp vụ của nhân sự tính theo giờ Việt Nam (trước đây dùng UTC nên 0h–7h điều chuyển
  "hôm nay" chưa áp dụng, số ngày còn lại của giấy tờ lệch 1); test dùng `TestData.VN`.
- 2026-10-03: Chấm công, nghỉ phép xong. Route `/cham-cong/cau-hinh` (trang Chấm công đã link tới nhưng thiếu route,
  nút Cấu hình chỉ hiện với người quản lý); bỏ ẩn nút Cấu hình, Import máy chấm công ở bản demo. Mock: cấu hình chấm
  công theo ngày hiệu lực (ngày làm việc, nửa buổi, ân hạn, phép năm dùng cho bảng công và phép còn lại), ngày lễ thêm
  được (chung hoặc riêng trường, ngày lễ quốc gia cố định), import máy chấm công (khớp mã chấm công, tự điền X, sai
  lệch thiếu giờ vào/ra, mã không khớp), file đính kèm đơn nghỉ. E2E: thêm `gridCell` cuộn lưới ảo hóa tới ô cần tìm.
- 2026-10-03: Học phí, thu chi xong. Mock: PDF phiếu thu (vẽ phiếu bằng canvas, nhúng JPEG vào một trang PDF A5 viết
  tay, không thêm thư viện; chữ tiếng Việt đủ dấu), xem chứng từ thu chi qua kho file demo. Lỗi "tệp không còn" của
  kho file demo trả 404 có thông điệp thay vì lỗi chung.


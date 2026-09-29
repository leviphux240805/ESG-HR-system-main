-- Dữ liệu dev: 1 chuỗi, 2 cơ sở, mỗi vai trò 1 tài khoản. CHỈ nạp ở profile dev (xem application-dev.yml).
-- Mật khẩu mọi tài khoản: Matkhau@123. Đăng nhập bằng email hoặc số điện thoại.
-- Migration lặp lại (R__): Flyway chạy lại khi file đổi, nên mọi câu lệnh phải idempotent.

INSERT INTO schools (id, code, name, province_code, ward_code, address_detail, phone) VALUES
    ('00000000-0000-0000-0000-00000000000a', 'CS-A', 'Cơ sở A – Hoa Sen', '01', '00004', 'Số 1 phố Mẫu, Phường Ba Đình', '0241000001'),
    ('00000000-0000-0000-0000-00000000000b', 'CS-B', 'Cơ sở B – Hoa Mai', '01', '00008', 'Số 2 phố Mẫu, Phường Ngọc Hà', '0241000002')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, phone, full_name, password_hash) VALUES
    ('00000000-0000-0000-0000-000000000001', 'owner@preschool.local',       '0900000001', 'Chủ Chuỗi',          '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000002', 'admin@preschool.local',       '0900000002', 'Văn Phòng Điều Hành', '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000003', 'ketoan.a@preschool.local',    '0900000003', 'Kế Toán A',          '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000004', 'hieutruong.a@preschool.local', '0900000004', 'Hiệu Trưởng A',      '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000005', 'giaovien.a@preschool.local',  '0900000005', 'Giáo Viên A',        '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000006', 'yte.a@preschool.local',       '0900000006', 'Y Tế A',             '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000007', 'capduong.b@preschool.local',  '0900000007', 'Cấp Dưỡng B',        '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000008', 'nhanvien.b@preschool.local',  '0900000008', 'Nhân Viên B',        '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_code, school_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'OWNER',       NULL),
    ('00000000-0000-0000-0000-000000000002', 'CHAIN_ADMIN', NULL),
    ('00000000-0000-0000-0000-000000000003', 'ACCOUNTANT',  '00000000-0000-0000-0000-00000000000a'),
    ('00000000-0000-0000-0000-000000000004', 'PRINCIPAL',   '00000000-0000-0000-0000-00000000000a'),
    ('00000000-0000-0000-0000-000000000005', 'TEACHER',     '00000000-0000-0000-0000-00000000000a'),
    ('00000000-0000-0000-0000-000000000006', 'NURSE',       '00000000-0000-0000-0000-00000000000a'),
    ('00000000-0000-0000-0000-000000000007', 'KITCHEN',     '00000000-0000-0000-0000-00000000000b'),
    ('00000000-0000-0000-0000-000000000008', 'STAFF',       '00000000-0000-0000-0000-00000000000b')
ON CONFLICT DO NOTHING;

INSERT INTO school_years (id, name, start_date, end_date, is_current) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '2026–2027', '2026-09-05', '2027-05-31', true)
ON CONFLICT DO NOTHING;

-- Ngày lễ dương lịch dùng chung + một ngày nghỉ riêng mỗi cơ sở (để thử lọc theo cơ sở)
INSERT INTO holidays (school_id, holiday_date, name, is_custom) VALUES
    (NULL, '2026-09-02', 'Quốc khánh', false),
    (NULL, '2027-01-01', 'Tết Dương lịch', false),
    (NULL, '2027-04-30', 'Ngày Giải phóng miền Nam', false),
    (NULL, '2027-05-01', 'Quốc tế Lao động', false),
    ('00000000-0000-0000-0000-00000000000a', '2026-11-20', 'Nghỉ Ngày Nhà giáo (riêng Cơ sở A)', true),
    ('00000000-0000-0000-0000-00000000000b', '2026-12-24', 'Nghỉ Giáng sinh (riêng Cơ sở B)', true)
ON CONFLICT DO NOTHING;

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

-- ---------------------------------------------------------------- nhân sự (giai đoạn 2)
-- Nhân viên gắn với tài khoản seed + vài nhân viên không có tài khoản. Mã NVxxxx do DB sinh.
INSERT INTO staff (id, school_id, full_name, dob, gender, citizen_id, phone, email, perm_province_code, perm_ward_code,
                   perm_address_detail, position, qualification, specialization, start_date, status, end_date,
                   termination_reason, bank_name, bank_account_no, bank_account_holder) VALUES
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000a', 'Hiệu Trưởng A', '1980-03-12', 'FEMALE', '001180000101', '0900000004', 'hieutruong.a@preschool.local', '01', '00004', 'Số 10 phố Mẫu', 'MANAGER', 'MASTER', 'Quản lý giáo dục', '2018-08-01', 'ACTIVE', NULL, NULL, 'Vietcombank', '0011000000101', 'HIEU TRUONG A'),
    ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000000a', 'Giáo Viên A', '1995-06-20', 'FEMALE', '001195000102', '0900000005', 'giaovien.a@preschool.local', '01', '00004', 'Số 11 phố Mẫu', 'TEACHER', 'BACHELOR', 'Sư phạm mầm non', '2020-08-15', 'ACTIVE', NULL, NULL, 'BIDV', '0011000000102', 'GIAO VIEN A'),
    ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000000a', 'Y Tế A', '1990-01-05', 'FEMALE', '001190000103', '0900000006', 'yte.a@preschool.local', '01', '00008', 'Số 12 phố Mẫu', 'NURSE', 'COLLEGE', 'Điều dưỡng', '2021-02-01', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-00000000000a', 'Kế Toán A', '1988-11-30', 'FEMALE', '001188000104', '0900000003', 'ketoan.a@preschool.local', '01', '00008', 'Số 13 phố Mẫu', 'ACCOUNTANT', 'BACHELOR', 'Kế toán', '2019-05-01', 'ACTIVE', NULL, NULL, 'Techcombank', '0011000000104', 'KE TOAN A'),
    ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-00000000000a', 'Nguyễn Thị Lan', '1998-09-09', 'FEMALE', '001198000105', '0911000105', 'lan.nguyen@preschool.local', '01', '00004', 'Số 14 phố Mẫu', 'TEACHER', 'COLLEGE', 'Sư phạm mầm non', '2024-08-01', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-00000000000a', 'Trần Thị Mai', '1985-04-18', 'FEMALE', '001185000106', '0911000106', NULL, '01', '00004', 'Số 15 phố Mẫu', 'NANNY', 'INTERMEDIATE', NULL, '2022-09-01', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-00000000000a', 'Lê Văn Hùng', '1975-12-01', 'MALE', '001175000107', '0911000107', NULL, '01', '00008', 'Số 16 phố Mẫu', 'SECURITY', 'HIGH_SCHOOL', NULL, '2020-01-10', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-00000000000b', 'Cấp Dưỡng B', '1982-07-07', 'FEMALE', '001182000111', '0900000007', 'capduong.b@preschool.local', '01', '00008', 'Số 20 phố Mẫu', 'COOK', 'INTERMEDIATE', 'Nấu ăn', '2021-06-01', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-00000000000b', 'Nhân Viên B', '1993-02-14', 'MALE', '001193000112', '0900000008', 'nhanvien.b@preschool.local', '01', '00008', 'Số 21 phố Mẫu', 'OTHER', 'COLLEGE', NULL, '2023-03-01', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-00000000000b', 'Phạm Thị Hoa', '1997-10-25', 'FEMALE', '001197000113', '0911000113', 'hoa.pham@preschool.local', '01', '00008', 'Số 22 phố Mẫu', 'TEACHER', 'BACHELOR', 'Sư phạm mầm non', '2022-08-15', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000114', '00000000-0000-0000-0000-00000000000b', 'Võ Thị Ngọc', '1989-05-03', 'FEMALE', '001189000114', '0911000114', NULL, '01', '00004', 'Số 23 phố Mẫu', 'NANNY', 'INTERMEDIATE', NULL, '2023-09-01', 'ACTIVE', NULL, NULL, NULL, NULL, NULL),
    ('00000000-0000-0000-0000-000000000115', '00000000-0000-0000-0000-00000000000b', 'Đặng Văn Nam', '1991-08-19', 'MALE', '001191000115', '0911000115', NULL, '01', '00008', 'Số 24 phố Mẫu', 'SECURITY', 'HIGH_SCHOOL', NULL, '2021-01-01', 'TERMINATED', '2025-12-31', 'Nghỉ theo nguyện vọng', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Lịch sử cơ sở: mỗi nhân viên seed một giai đoạn từ ngày vào làm
INSERT INTO staff_school_assignments (id, staff_id, school_id, from_date, to_date)
SELECT ('00000000-0000-0000-0000-0000000002' || right(s.id::text, 2))::uuid, s.id, s.school_id, s.start_date, s.end_date
FROM staff s
WHERE s.id::text LIKE '00000000-0000-0000-0000-0000000001%'
ON CONFLICT DO NOTHING;

-- Hợp đồng: một hợp đồng sắp hết hạn (cảnh báo 30 ngày), còn lại không thời hạn hoặc còn dài
INSERT INTO staff_contracts (id, staff_id, contract_type, contract_no, signed_on, start_date, end_date) VALUES
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'INDEFINITE', 'HĐ-2018-001', '2018-08-01', '2018-08-01', NULL),
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', 'DEFINITE',   'HĐ-2025-002', '2025-08-15', '2025-08-15', '2027-08-14'),
    ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000105', 'DEFINITE',   'HĐ-2024-005', '2024-08-01', '2024-08-01', CURRENT_DATE + 20),
    ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000113', 'DEFINITE',   'HĐ-2024-013', '2024-08-15', '2024-08-15', CURRENT_DATE + 75)
ON CONFLICT DO NOTHING;

INSERT INTO staff_salary_configs (id, staff_id, effective_from, salary_mode, base_salary, coefficient, region, allowances, insurance_salary) VALUES
    ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '2025-01-01', 'FIXED', 15000000, NULL, 'I', '{"lunch": 730000, "responsibility": 2000000}', 12000000),
    ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102', '2025-08-15', 'FIXED', 8500000, NULL, 'I', '{"lunch": 730000}', 7000000),
    ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000105', '2024-08-01', 'COEFFICIENT', NULL, 2.340, 'I', '{"lunch": 730000}', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO staff_certificates (id, staff_id, name, issued_by, issue_date, expiry_date) VALUES
    ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000102', 'Chứng chỉ sơ cấp cứu', 'Hội Chữ thập đỏ', '2024-11-01', CURRENT_DATE + 45)
ON CONFLICT DO NOTHING;

-- Gắn tài khoản seed với hồ sơ nhân viên
UPDATE users SET staff_id = '00000000-0000-0000-0000-000000000104' WHERE id = '00000000-0000-0000-0000-000000000003' AND staff_id IS NULL;
UPDATE users SET staff_id = '00000000-0000-0000-0000-000000000101' WHERE id = '00000000-0000-0000-0000-000000000004' AND staff_id IS NULL;
UPDATE users SET staff_id = '00000000-0000-0000-0000-000000000102' WHERE id = '00000000-0000-0000-0000-000000000005' AND staff_id IS NULL;
UPDATE users SET staff_id = '00000000-0000-0000-0000-000000000103' WHERE id = '00000000-0000-0000-0000-000000000006' AND staff_id IS NULL;
UPDATE users SET staff_id = '00000000-0000-0000-0000-000000000111' WHERE id = '00000000-0000-0000-0000-000000000007' AND staff_id IS NULL;
UPDATE users SET staff_id = '00000000-0000-0000-0000-000000000112' WHERE id = '00000000-0000-0000-0000-000000000008' AND staff_id IS NULL;

-- Dữ liệu dev, CHỈ nạp ở profile dev (xem application-dev.yml). Mật khẩu mọi tài khoản: Matkhau@123; đăng nhập bằng
-- email hoặc số điện thoại. Migration lặp lại (R__): Flyway chạy lại khi file đổi, nên mọi câu lệnh phải idempotent.
--   Tổ chức 1 (mặc định của V13): Hiệu trưởng 0900000001 quản lý 3 trường A, B, C; phó hiệu trưởng 0900000004 ở A
--     (nhóm Lớp & trẻ, Thực đơn & sức khỏe, Nhân sự, Báo cáo); kế toán, giáo viên, y tế ở A; cấp dưỡng, nhân viên ở B.
--   Tổ chức 2: Hiệu trưởng 0900000002 quản lý 1 trường D (không thấy dữ liệu tổ chức 1).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = '00000000-0000-0000-0000-0000000000f2') THEN
        PERFORM provision_organization('00000000-0000-0000-0000-0000000000f2', 'Mầm non Sao Mai');
    END IF;
END $$;
UPDATE organizations SET name = 'Chuỗi Mầm non Hoa' WHERE id = '00000000-0000-0000-0000-0000000000f0';

INSERT INTO schools (id, organization_id, code, name, province_code, ward_code, address_detail, phone) VALUES
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f0', 'CS-A', 'Trường A – Hoa Sen', '01', '00004', 'Số 1 phố Mẫu, Phường Ba Đình', '0241000001'),
    ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f0', 'CS-B', 'Trường B – Hoa Mai', '01', '00008', 'Số 2 phố Mẫu, Phường Ngọc Hà', '0241000002'),
    ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f0', 'CS-C', 'Trường C – Hoa Đào', '01', '00004', 'Số 3 phố Mẫu, Phường Ba Đình', '0241000003'),
    ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-0000000000f2', 'SM-1', 'Trường D – Sao Mai', '79', '26734', 'Số 4 đường Mẫu, Phường Bến Thành', '0281000004')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO users (id, organization_id, email, phone, full_name, password_hash) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f0', 'owner@preschool.local',       '0900000001', 'Hiệu Trưởng Chuỗi Hoa', '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f2', 'admin@preschool.local',       '0900000002', 'Hiệu Trưởng Sao Mai',   '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f0', 'ketoan.a@preschool.local',    '0900000003', 'Kế Toán A',             '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000f0', 'hieutruong.a@preschool.local', '0900000004', 'Phó Hiệu Trưởng A',    '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000f0', 'giaovien.a@preschool.local',  '0900000005', 'Giáo Viên A',           '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000f0', 'yte.a@preschool.local',       '0900000006', 'Y Tế A',                '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000f0', 'capduong.b@preschool.local',  '0900000007', 'Cấp Dưỡng B',           '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm'),
    ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000f0', 'nhanvien.b@preschool.local',  '0900000008', 'Nhân Viên B',           '$2a$10$m6CyYyZfJ0ukgdzPkYu2H.9Kh0hQ3HZQbaIxhEcr/GTU1nG5mwmPm')
ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, full_name = EXCLUDED.full_name;

-- Vai trò của tài khoản seed luôn đặt lại đúng như trên
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE id::text LIKE '00000000-0000-0000-0000-00000000000_');
INSERT INTO user_roles (user_id, role_code, school_id, function_groups) VALUES
    ('00000000-0000-0000-0000-000000000001', 'PRINCIPAL',      '00000000-0000-0000-0000-00000000000a', NULL),
    ('00000000-0000-0000-0000-000000000001', 'PRINCIPAL',      '00000000-0000-0000-0000-00000000000b', NULL),
    ('00000000-0000-0000-0000-000000000001', 'PRINCIPAL',      '00000000-0000-0000-0000-00000000000c', NULL),
    ('00000000-0000-0000-0000-000000000002', 'PRINCIPAL',      '00000000-0000-0000-0000-00000000000d', NULL),
    ('00000000-0000-0000-0000-000000000003', 'ACCOUNTANT',     '00000000-0000-0000-0000-00000000000a', NULL),
    ('00000000-0000-0000-0000-000000000004', 'VICE_PRINCIPAL', '00000000-0000-0000-0000-00000000000a', '{CLASSROOM,NUTRITION,HR,REPORTS}'),
    ('00000000-0000-0000-0000-000000000005', 'TEACHER',        '00000000-0000-0000-0000-00000000000a', NULL),
    ('00000000-0000-0000-0000-000000000006', 'NURSE',          '00000000-0000-0000-0000-00000000000a', NULL),
    ('00000000-0000-0000-0000-000000000007', 'KITCHEN',        '00000000-0000-0000-0000-00000000000b', NULL),
    ('00000000-0000-0000-0000-000000000008', 'STAFF',          '00000000-0000-0000-0000-00000000000b', NULL);

INSERT INTO school_years (id, organization_id, name, start_date, end_date, is_current) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f0', '2026–2027', '2026-09-05', '2027-05-31', true),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', '2026–2027', '2026-09-05', '2027-05-31', true)
ON CONFLICT DO NOTHING;

-- Ngày lễ dương lịch dùng chung + một ngày nghỉ riêng mỗi cơ sở (để thử lọc theo cơ sở)
INSERT INTO holidays (organization_id, school_id, holiday_date, name, is_custom) VALUES
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-09-02', 'Quốc khánh', false),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2027-01-01', 'Tết Dương lịch', false),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2027-04-30', 'Ngày Giải phóng miền Nam', false),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2027-05-01', 'Quốc tế Lao động', false),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-00000000000a', '2026-11-20', 'Nghỉ Ngày Nhà giáo (riêng Cơ sở A)', true),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-00000000000b', '2026-12-24', 'Nghỉ Giáng sinh (riêng Cơ sở B)', true)
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

-- ---------------------------------------------------------------- chấm công (giai đoạn 3)
-- Cấu hình mặc định toàn chuỗi: ca 07:30–17:00, nghỉ trưa 11:30–13:00, T2–T7 (T7 nửa buổi), ân hạn 15 phút,
-- được muộn nhẹ 3 lần/tháng, phép năm 12 ngày.
INSERT INTO attendance_configs (organization_id, id, school_id, effective_from, shift_start, shift_end, lunch_start, lunch_end,
    late_grace_minutes, max_late_count_allowed, working_weekdays, half_day_weekdays, annual_leave_days) VALUES
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000601', NULL, '2025-01-01', '07:30', '17:00', '11:30', '13:00', 15, 3,
     '{1,2,3,4,5,6}', '{6}', 12)
ON CONFLICT DO NOTHING;

-- Ngày lễ mẫu 2026 (toàn chuỗi) – kiểm tra lại theo lịch nghỉ chính thức trước khi dùng thật
INSERT INTO holidays (organization_id, school_id, holiday_date, name) VALUES
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-01-01', 'Tết Dương lịch'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-02-16', 'Tết Nguyên đán'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-02-17', 'Tết Nguyên đán'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-02-18', 'Tết Nguyên đán'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-02-19', 'Tết Nguyên đán'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-02-20', 'Tết Nguyên đán'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-04-26', 'Giỗ Tổ Hùng Vương'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-04-30', 'Ngày Giải phóng miền Nam'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-05-01', 'Quốc tế Lao động'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-09-01', 'Quốc khánh'),
    ('00000000-0000-0000-0000-0000000000f0', NULL, '2026-09-02', 'Quốc khánh')
ON CONFLICT DO NOTHING;

-- Mã chấm công của nhân viên seed = 3 số cuối của id (101, 102, …)
UPDATE staff SET machine_code = right(id::text, 3)
WHERE id::text LIKE '00000000-0000-0000-0000-0000000001%' AND machine_code IS NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------- lớp, trẻ (giai đoạn 5)
-- Hai lớp ở Cơ sở A (giáo viên A phụ trách Chồi 1), một lớp ở Cơ sở B; mỗi lớp vài trẻ có phụ huynh chính.
INSERT INTO classes (id, school_id, school_year_id, age_group_id, name, room, capacity) VALUES
    ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
     (SELECT id FROM age_groups WHERE organization_id = '00000000-0000-0000-0000-0000000000f0' AND code = 'MAU_GIAO_4_5'), 'Chồi 1', 'P.101', 30),
    ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
     (SELECT id FROM age_groups WHERE organization_id = '00000000-0000-0000-0000-0000000000f0' AND code = 'NHA_TRE'), 'Nhà trẻ 1', 'P.102', 25),
    ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a1',
     (SELECT id FROM age_groups WHERE organization_id = '00000000-0000-0000-0000-0000000000f0' AND code = 'MAU_GIAO_5_6'), 'Lá 1', 'P.201', 35)
ON CONFLICT DO NOTHING;

INSERT INTO class_teachers (school_id, class_id, staff_id, role, from_date)
SELECT '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000701',
       '00000000-0000-0000-0000-000000000102', 'MAIN', '2026-09-05'
WHERE NOT EXISTS (SELECT 1 FROM class_teachers WHERE class_id = '00000000-0000-0000-0000-000000000701');

INSERT INTO children (id, school_id, full_name, nickname, dob, gender, status, enrolled_at) VALUES
    ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-00000000000a', 'Nguyễn Minh An', 'Bin', '2021-03-15', 'MALE', 'STUDYING', '2026-09-05'),
    ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-00000000000a', 'Trần Bảo Ngọc', 'Na', '2021-07-02', 'FEMALE', 'STUDYING', '2026-09-05'),
    ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-00000000000a', 'Lê Gia Huy', NULL, '2021-11-20', 'MALE', 'STUDYING', '2026-09-15'),
    ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-00000000000a', 'Phạm Khánh Linh', 'Mít', '2023-05-10', 'FEMALE', 'STUDYING', '2026-09-05'),
    ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-00000000000b', 'Hoàng Đức Minh', NULL, '2020-12-01', 'MALE', 'STUDYING', '2026-09-05')
ON CONFLICT DO NOTHING;

INSERT INTO class_enrollments (school_id, child_id, class_id, from_date)
SELECT c.school_id, c.id, v.class_id::uuid, c.enrolled_at
FROM (VALUES ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000701'),
             ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000701'),
             ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000701'),
             ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000702'),
             ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000703')) AS v (child_id, class_id)
JOIN children c ON c.id = v.child_id::uuid
WHERE NOT EXISTS (SELECT 1 FROM class_enrollments e WHERE e.child_id = c.id);

-- ---------------------------------------------------------------- học phí (giai đoạn 6)
-- Biểu phí năm học 2026–2027: học phí theo khối, tiền ăn theo ngày, CSVC một lần, năng khiếu tự chọn.
INSERT INTO fee_schedules (school_id, school_year_id, age_group_id, fee_type_id, amount, effective_from)
SELECT s.school_id::uuid, '00000000-0000-0000-0000-0000000000a1', ag.id, ft.id, s.amount, '2026-09-01'
FROM (VALUES ('00000000-0000-0000-0000-00000000000a', 'NHA_TRE', 'HOC_PHI', 4200000),
             ('00000000-0000-0000-0000-00000000000a', 'MAU_GIAO_3_4', 'HOC_PHI', 3900000),
             ('00000000-0000-0000-0000-00000000000a', 'MAU_GIAO_4_5', 'HOC_PHI', 3700000),
             ('00000000-0000-0000-0000-00000000000a', 'MAU_GIAO_5_6', 'HOC_PHI', 3600000),
             ('00000000-0000-0000-0000-00000000000a', NULL, 'TIEN_AN', 35000),
             ('00000000-0000-0000-0000-00000000000a', NULL, 'CSVC', 1500000),
             ('00000000-0000-0000-0000-00000000000a', NULL, 'NANG_KHIEU', 400000),
             ('00000000-0000-0000-0000-00000000000b', NULL, 'HOC_PHI', 3500000),
             ('00000000-0000-0000-0000-00000000000b', NULL, 'TIEN_AN', 32000),
             ('00000000-0000-0000-0000-00000000000b', NULL, 'CSVC', 1200000)) AS s (school_id, age_code, fee_code, amount)
JOIN fee_types ft ON ft.organization_id = '00000000-0000-0000-0000-0000000000f0' AND ft.code = s.fee_code
LEFT JOIN age_groups ag ON ag.organization_id = '00000000-0000-0000-0000-0000000000f0' AND ag.code = s.age_code
ON CONFLICT DO NOTHING;

-- Trẻ 801 học năng khiếu; trẻ 802 là con nhân viên, giảm 50% học phí cả năm học
INSERT INTO child_fee_items (school_id, child_id, fee_type_id, from_month)
SELECT '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000801', id, '2026-09-01'
FROM fee_types WHERE organization_id = '00000000-0000-0000-0000-0000000000f0' AND code = 'NANG_KHIEU'
AND NOT EXISTS (SELECT 1 FROM child_fee_items WHERE child_id = '00000000-0000-0000-0000-000000000801');

INSERT INTO child_discounts (school_id, child_id, fee_type_id, percent, reason, from_month, to_month)
SELECT '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000802', id, 50, 'Con nhân viên',
       '2026-09-01', '2027-05-01'
FROM fee_types WHERE organization_id = '00000000-0000-0000-0000-0000000000f0' AND code = 'HOC_PHI'
AND NOT EXISTS (SELECT 1 FROM child_discounts WHERE child_id = '00000000-0000-0000-0000-000000000802');

-- ---------------------------------------------------------------- thực đơn, sức khỏe (giai đoạn 7)
-- Món chung chuỗi + vài món riêng từng cơ sở; thực đơn Cơ sở A tuần 28/09 (đã công bố) và 05/10 (nháp), chung mọi khối.
INSERT INTO dishes (organization_id, id, school_id, name, ingredients, kcal, protein_g, fat_g, carb_g) VALUES
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000901', NULL, 'Cháo thịt bằm',
     '[{"name":"Gạo tẻ","grams":30},{"name":"Thịt lợn nạc","grams":25},{"name":"Hành lá","grams":3}]', 210, 9, 6, 30),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000902', NULL, 'Phở bò',
     '[{"name":"Bánh phở","grams":80},{"name":"Thịt bò","grams":30},{"name":"Hành lá","grams":3}]', 280, 14, 7, 40),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000903', NULL, 'Cơm trắng', '[{"name":"Gạo tẻ","grams":60}]', 210, 4, 1, 46),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000904', NULL, 'Tôm rim thịt',
     '[{"name":"Tôm","grams":25},{"name":"Thịt lợn","grams":20},{"name":"Nước mắm","grams":3}]', 150, 14, 9, 3),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000905', NULL, 'Canh bí đỏ nấu thịt',
     '[{"name":"Bí đỏ","grams":50},{"name":"Thịt lợn nạc","grams":15}]', 70, 4, 2, 8),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000906', NULL, 'Trứng đúc thịt',
     '[{"name":"Trứng gà","grams":30},{"name":"Thịt lợn","grams":15}]', 140, 11, 10, 1),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000907', NULL, 'Sữa chua', '[{"name":"Sữa bò","grams":100}]', 90, 4, 3, 12),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000908', NULL, 'Chuối tiêu', '[{"name":"Chuối","grams":80}]', 70, 1, 0, 18),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-00000000000a', 'Bánh flan',
     '[{"name":"Trứng gà","grams":30},{"name":"Sữa bò","grams":60},{"name":"Đường","grams":8}]', 120, 5, 5, 14),
    ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-00000000000b', 'Súp cua',
     '[{"name":"Cua đồng","grams":25},{"name":"Bột năng","grams":5},{"name":"Trứng gà","grams":10}]', 110, 8, 4, 9)
ON CONFLICT DO NOTHING;

INSERT INTO menus (id, school_id, week_start, status, published_at) VALUES
    ('00000000-0000-0000-0000-000000000931', '00000000-0000-0000-0000-00000000000a', '2026-09-28', 'PUBLISHED', '2026-09-25 09:00+07'),
    ('00000000-0000-0000-0000-000000000932', '00000000-0000-0000-0000-00000000000a', '2026-10-05', 'DRAFT', NULL)
ON CONFLICT DO NOTHING;

-- Thứ Hai–thứ Sáu: sáng xoay cháo/phở; trưa cơm + món mặn xoay + canh; chiều sữa chua/chuối/bánh flan
INSERT INTO menu_items (school_id, menu_id, menu_date, meal, dish_id, order_no)
SELECT '00000000-0000-0000-0000-00000000000a', m.id, m.week_start + d.n, i.meal, i.dish::uuid, i.order_no
FROM menus m
CROSS JOIN generate_series(0, 4) AS d (n)
CROSS JOIN LATERAL (VALUES
    ('BREAKFAST', CASE WHEN d.n % 2 = 0 THEN '00000000-0000-0000-0000-000000000901' ELSE '00000000-0000-0000-0000-000000000902' END, 1),
    ('LUNCH', '00000000-0000-0000-0000-000000000903', 1),
    ('LUNCH', CASE WHEN d.n IN (1, 3) THEN '00000000-0000-0000-0000-000000000904' ELSE '00000000-0000-0000-0000-000000000906' END, 2),
    ('LUNCH', '00000000-0000-0000-0000-000000000905', 3),
    ('AFTERNOON', CASE d.n WHEN 0 THEN '00000000-0000-0000-0000-000000000907' WHEN 2 THEN '00000000-0000-0000-0000-000000000911'
                           ELSE '00000000-0000-0000-0000-000000000908' END, 1)) AS i (meal, dish, order_no)
WHERE m.id IN ('00000000-0000-0000-0000-000000000931', '00000000-0000-0000-0000-000000000932')
AND NOT EXISTS (SELECT 1 FROM menu_items x WHERE x.menu_id = m.id);

-- Ghi chú dị ứng để thấy cảnh báo ở thực đơn và điểm danh
UPDATE children SET allergy_note = 'Dị ứng tôm'
WHERE id = '00000000-0000-0000-0000-000000000801' AND allergy_note IS NULL;
UPDATE children SET allergy_note = 'Dị ứng sữa bò'
WHERE id = '00000000-0000-0000-0000-000000000804' AND allergy_note IS NULL;

-- Cân đo tháng 9 (z-score và kênh tính sẵn bằng đúng thuật toán của GrowthClassifier)
INSERT INTO growth_measurements (school_id, child_id, class_id, measured_on, weight_kg, height_cm, age_days, age_months,
                                 bmi, weight_z, height_z, bmi_z, weight_status, height_status, bmi_status, standard,
                                 source, recorded_by)
SELECT v.*, 'CLASS', '00000000-0000-0000-0000-000000000006'::uuid
FROM (VALUES
    ('00000000-0000-0000-0000-00000000000a'::uuid, '00000000-0000-0000-0000-000000000801'::uuid, '00000000-0000-0000-0000-000000000701'::uuid, DATE '2026-09-08', 18.6, 110.5, 2003, 65.81, 15.23, -0.31, -0.49, -0.02, 'NORMAL', 'NORMAL', 'NORMAL', 'WHO_2007'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000701', '2026-09-25', 19.0, 111.0, 2020, 66.37, 15.42, -0.18, -0.44, 0.12, 'NORMAL', 'NORMAL', 'NORMAL', 'WHO_2007'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000701', '2026-09-25', 13.4, 100.5, 1911, 62.78, 13.27, -2.45, -2.08, -1.52, 'UNDERWEIGHT', 'STUNTED', 'NORMAL', 'WHO_2007'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000701', '2026-09-25', 22.5, 104.0, 1770, 58.15, 20.80, 1.63, -1.08, 3.33, 'NORMAL', 'NORMAL', 'OBESE', 'WHO_2006'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000702', '2026-09-25', 12.0, 88.0, 1234, 40.54, 15.50, -1.58, -2.52, 0.12, 'NORMAL', 'STUNTED', 'NORMAL', 'WHO_2006'),
    ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000703', '2026-09-25', 20.5, 115.0, 2124, 69.78, 15.50, 0.15, 0.03, 0.16, 'NORMAL', 'NORMAL', 'NORMAL', 'WHO_2007'))
    AS v (school_id, child_id, class_id, measured_on, weight_kg, height_cm, age_days, age_months, bmi, weight_z, height_z,
          bmi_z, weight_status, height_status, bmi_status, standard)
ON CONFLICT DO NOTHING;

INSERT INTO health_logs (id, school_id, child_id, class_id, log_date, type, content, temperature_c, parent_notified_at,
                         parent_notified_by, recorded_by) VALUES
    ('00000000-0000-0000-0000-000000000941', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000802',
     '00000000-0000-0000-0000-000000000701', '2026-09-29', 'FEVER', 'Sốt sau ngủ trưa, đã chườm mát', 38.3,
     '2026-09-29 14:30+07', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005'),
    ('00000000-0000-0000-0000-000000000942', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000801',
     '00000000-0000-0000-0000-000000000701', '2026-09-30', 'MEDICINE', 'Phụ huynh dặn uống siro ho sau bữa trưa', NULL,
     NULL, NULL, '00000000-0000-0000-0000-000000000005'),
    ('00000000-0000-0000-0000-000000000943', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000804',
     '00000000-0000-0000-0000-000000000702', '2026-09-30', 'INCIDENT', 'Ngã trầy đầu gối khi chơi ngoài sân, đã sát trùng', NULL,
     NULL, NULL, '00000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

INSERT INTO health_checkups (id, school_id, child_id, checkup_date, provider, summary) VALUES
    ('00000000-0000-0000-0000-000000000951', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000801',
     '2026-09-20', 'Trạm y tế phường', 'Sức khỏe bình thường; răng sâu nhẹ, đề nghị khám nha khoa.')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- tổ chức 2 (trường D) – để thử cách ly giữa hai hiệu trưởng
INSERT INTO classes (id, school_id, school_year_id, age_group_id, name, room, capacity)
SELECT '00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-00000000000d',
       '00000000-0000-0000-0000-0000000000a2', id, 'Mầm 1', 'P.01', 25
FROM age_groups WHERE organization_id = '00000000-0000-0000-0000-0000000000f2' AND code = 'MAU_GIAO_3_4'
ON CONFLICT DO NOTHING;

INSERT INTO children (id, school_id, full_name, dob, gender, status, enrolled_at) VALUES
    ('00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-00000000000d', 'Đặng Thu Hà', '2022-06-12', 'FEMALE', 'STUDYING', '2026-09-05'),
    ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-00000000000d', 'Bùi Quang Khải', '2022-08-30', 'MALE', 'STUDYING', '2026-09-05')
ON CONFLICT DO NOTHING;

INSERT INTO class_enrollments (school_id, child_id, class_id, from_date)
SELECT c.school_id, c.id, '00000000-0000-0000-0000-000000000704', c.enrolled_at
FROM children c
WHERE c.id IN ('00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-000000000807')
AND NOT EXISTS (SELECT 1 FROM class_enrollments e WHERE e.child_id = c.id);

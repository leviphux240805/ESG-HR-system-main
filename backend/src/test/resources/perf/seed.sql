-- Dữ liệu kiểm thử hiệu năng (chạy sau seed dev): 5 trường mới của Hiệu trưởng 0900000001, mỗi trường 8 lớp, 200 trẻ,
-- 25 nhân viên; 12 tháng 10/2025–9/2026: điểm danh trẻ, chấm công, phiếu thu + thu tiền, bảng lương, cân đo, đơn nghỉ,
-- công việc. Id sinh tất định bằng md5 để chạy lại được.

INSERT INTO schools (id, organization_id, code, name, province_code, ward_code)
SELECT md5('perf-school-' || s)::uuid, '00000000-0000-0000-0000-0000000000f0', 'PERF-' || s, 'Trường hiệu năng ' || s,
       '01', '00004'
FROM generate_series(1, 5) s;

INSERT INTO user_roles (user_id, role_code, school_id)
SELECT '00000000-0000-0000-0000-000000000001', 'PRINCIPAL', md5('perf-school-' || s)::uuid
FROM generate_series(1, 5) s;

INSERT INTO classes (id, school_id, school_year_id, age_group_id, name, room, capacity)
SELECT md5('perf-class-' || s || '-' || c)::uuid, md5('perf-school-' || s)::uuid,
       '00000000-0000-0000-0000-0000000000a1',
       (SELECT id FROM age_groups WHERE organization_id = '00000000-0000-0000-0000-0000000000f0'
        AND code = (ARRAY['NHA_TRE', 'MAU_GIAO_3_4', 'MAU_GIAO_4_5', 'MAU_GIAO_5_6'])[1 + c % 4]),
       'Lớp ' || c, 'P.' || (100 + c), 30
FROM generate_series(1, 5) s, generate_series(1, 8) c;

INSERT INTO staff (id, school_id, full_name, dob, gender, citizen_id, phone, position, start_date)
SELECT md5('perf-staff-' || s || '-' || n)::uuid, md5('perf-school-' || s)::uuid,
       (ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng'])[1 + n % 5] || ' Thị Nhân Viên ' || s || '-' || n,
       date '1985-01-01' + (n * 97 % 4000), CASE WHEN n % 7 = 0 THEN 'MALE' ELSE 'FEMALE' END,
       '0791' || lpad((s * 100 + n)::text, 8, '0'), '097' || lpad((s * 100 + n)::text, 7, '0'),
       CASE WHEN n <= 16 THEN 'TEACHER' WHEN n <= 19 THEN 'NANNY' WHEN n <= 21 THEN 'COOK' WHEN n = 22 THEN 'NURSE'
            WHEN n = 23 THEN 'ACCOUNTANT' WHEN n = 24 THEN 'SECURITY' ELSE 'MANAGER' END,
       '2024-08-01'
FROM generate_series(1, 5) s, generate_series(1, 25) n;

INSERT INTO staff_school_assignments (staff_id, school_id, from_date)
SELECT md5('perf-staff-' || s || '-' || n)::uuid, md5('perf-school-' || s)::uuid, '2024-08-01'
FROM generate_series(1, 5) s, generate_series(1, 25) n;

INSERT INTO staff_salary_configs (staff_id, effective_from, salary_mode, base_salary, region, allowances, insurance_salary)
SELECT md5('perf-staff-' || s || '-' || n)::uuid, '2024-08-01', 'FIXED', 7000000 + n * 150000, 'I',
       '{"lunch": 730000}', 6000000
FROM generate_series(1, 5) s, generate_series(1, 25) n;

INSERT INTO class_teachers (school_id, class_id, staff_id, role, from_date)
SELECT md5('perf-school-' || s)::uuid, md5('perf-class-' || s || '-' || ((n - 1) % 8 + 1))::uuid,
       md5('perf-staff-' || s || '-' || n)::uuid, CASE WHEN n <= 8 THEN 'MAIN' ELSE 'ASSISTANT' END, '2025-10-01'
FROM generate_series(1, 5) s, generate_series(1, 16) n;

INSERT INTO children (id, school_id, full_name, nickname, dob, gender, status, enrolled_at, allergy_note)
SELECT md5('perf-child-' || s || '-' || k)::uuid, md5('perf-school-' || s)::uuid,
       (ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'])[1 + k % 8] || ' '
           || (ARRAY['Minh', 'Gia', 'Bảo', 'Khánh', 'Ngọc', 'Anh'])[1 + k % 6] || ' '
           || (ARRAY['An', 'Huy', 'Linh', 'Châu', 'Phúc', 'Vy', 'Nam', 'Hà'])[1 + k % 7] || ' ' || s || '-' || k,
       NULL, date '2020-09-01' + (k * 13 % 1500), CASE WHEN k % 2 = 0 THEN 'MALE' ELSE 'FEMALE' END, 'STUDYING',
       '2025-10-01', CASE WHEN k % 25 = 0 THEN 'Dị ứng tôm' END
FROM generate_series(1, 5) s, generate_series(1, 200) k;

INSERT INTO class_enrollments (school_id, child_id, class_id, from_date)
SELECT md5('perf-school-' || s)::uuid, md5('perf-child-' || s || '-' || k)::uuid,
       md5('perf-class-' || s || '-' || ((k - 1) % 8 + 1))::uuid, '2025-10-01'
FROM generate_series(1, 5) s, generate_series(1, 200) k;

-- Ngày học/làm việc: thứ Hai–thứ Sáu trong 12 tháng
CREATE TEMP TABLE perf_days AS
SELECT d::date AS day FROM generate_series(date '2025-10-01', date '2026-09-30', interval '1 day') d
WHERE extract(isodow FROM d) < 6;

INSERT INTO child_attendance (school_id, child_id, class_id, attend_date, status, check_in_at, locked_at)
SELECT md5('perf-school-' || s)::uuid, md5('perf-child-' || s || '-' || k)::uuid,
       md5('perf-class-' || s || '-' || ((k - 1) % 8 + 1))::uuid, day,
       CASE WHEN (k + extract(doy FROM day)::int) % 17 = 0 THEN 'EXCUSED'
            WHEN (k + extract(doy FROM day)::int) % 29 = 0 THEN 'ABSENT' ELSE 'PRESENT' END,
       day + time '07:30', day + time '10:00'
FROM generate_series(1, 5) s, generate_series(1, 200) k, perf_days;

INSERT INTO staff_attendance_days (school_id, staff_id, work_date, status_code, source)
SELECT md5('perf-school-' || s)::uuid, md5('perf-staff-' || s || '-' || n)::uuid, day,
       CASE WHEN (n + extract(doy FROM day)::int) % 23 = 0 THEN 'P' ELSE 'X' END, 'MACHINE'
FROM generate_series(1, 5) s, generate_series(1, 25) n, perf_days;

INSERT INTO attendance_month_locks (school_id, month, locked_at, locked_by)
SELECT md5('perf-school-' || s)::uuid, m::date, m + interval '1 month 3 days', '00000000-0000-0000-0000-000000000001'
FROM generate_series(1, 5) s, generate_series(date '2025-10-01', date '2026-08-01', interval '1 month') m;

INSERT INTO staff_attendance_months (school_id, staff_id, month, total_work, paid_leave, unpaid_leave, holiday_leave,
                                     late_count, locked_at)
SELECT md5('perf-school-' || s)::uuid, md5('perf-staff-' || s || '-' || n)::uuid, m::date, 21, 1, 0, 0, n % 3,
       m + interval '1 month 3 days'
FROM generate_series(1, 5) s, generate_series(1, 25) n,
     generate_series(date '2025-10-01', date '2026-08-01', interval '1 month') m;

-- Phiếu thu: học phí + tiền ăn; các tháng trước đã thu đủ, hai tháng gần nhất còn nợ một phần
INSERT INTO invoices (id, school_id, child_id, class_id, period_month, invoice_no, subtotal, amount_due, amount_paid,
                      status, due_date, issued_at)
SELECT md5('perf-inv-' || s || '-' || k || '-' || m)::uuid, md5('perf-school-' || s)::uuid,
       md5('perf-child-' || s || '-' || k)::uuid, md5('perf-class-' || s || '-' || ((k - 1) % 8 + 1))::uuid, m::date,
       'PT' || to_char(m, 'YYMM') || '-' || lpad(k::text, 4, '0'), 4500000, 4500000,
       CASE WHEN m < date '2026-08-01' THEN 4500000 WHEN k % 3 = 0 THEN 0 ELSE 2000000 END,
       CASE WHEN m < date '2026-08-01' THEN 'PAID' WHEN k % 3 = 0 THEN 'ISSUED' ELSE 'PARTIAL' END,
       (m + interval '9 days')::date, m
FROM generate_series(1, 5) s, generate_series(1, 200) k,
     generate_series(date '2025-10-01', date '2026-09-01', interval '1 month') m;

INSERT INTO invoice_lines (invoice_id, fee_type_id, kind, description, quantity, unit_price, amount, order_no)
SELECT i.id, ft.id, 'CHARGE', ft.name, CASE WHEN ft.code = 'TIEN_AN' THEN 22 ELSE 1 END,
       CASE WHEN ft.code = 'TIEN_AN' THEN 35000 ELSE 3730000 END,
       CASE WHEN ft.code = 'TIEN_AN' THEN 770000 ELSE 3730000 END, CASE WHEN ft.code = 'TIEN_AN' THEN 2 ELSE 1 END
FROM invoices i
JOIN fee_types ft ON ft.organization_id = '00000000-0000-0000-0000-0000000000f0' AND ft.code IN ('HOC_PHI', 'TIEN_AN')
WHERE i.invoice_no LIKE 'PT%' AND i.school_id IN (SELECT md5('perf-school-' || s)::uuid FROM generate_series(1, 5) s);

INSERT INTO payments (school_id, invoice_id, amount, method, paid_on, received_by)
SELECT school_id, id, amount_paid, CASE WHEN extract(month FROM period_month)::int % 2 = 0 THEN 'CASH' ELSE 'TRANSFER' END,
       (period_month + interval '5 days')::date, '00000000-0000-0000-0000-000000000001'
FROM invoices
WHERE amount_paid > 0 AND school_id IN (SELECT md5('perf-school-' || s)::uuid FROM generate_series(1, 5) s);

-- Bảng lương 12 tháng: các tháng đã trả, tháng 9/2026 nháp
INSERT INTO payroll_periods (id, school_id, month, standard_work_days, status, calculated_at, approved_by, approved_at,
                             paid_at)
SELECT md5('perf-pay-' || s || '-' || m)::uuid, md5('perf-school-' || s)::uuid, m::date, 22,
       CASE WHEN m < date '2026-09-01' THEN 'PAID' ELSE 'DRAFT' END, m + interval '1 month 2 days',
       CASE WHEN m < date '2026-09-01' THEN '00000000-0000-0000-0000-000000000001'::uuid END,
       CASE WHEN m < date '2026-09-01' THEN m + interval '1 month 3 days' END,
       CASE WHEN m < date '2026-09-01' THEN m + interval '1 month 5 days' END
FROM generate_series(1, 5) s, generate_series(date '2025-10-01', date '2026-09-01', interval '1 month') m;

INSERT INTO payroll_records (school_id, period_id, staff_id, work_days, salary_mode, contract_salary, salary_by_work,
                             allowances, allowances_detail, gross_salary, insurance_base, social_insurance,
                             health_insurance, unemployment_insurance, insurance_deduction, net_salary)
SELECT md5('perf-school-' || s)::uuid, md5('perf-pay-' || s || '-' || m)::uuid,
       md5('perf-staff-' || s || '-' || n)::uuid, 22, 'FIXED', 7000000 + n * 150000, 7000000 + n * 150000, 730000,
       '{"lunch": 730000}', 7730000 + n * 150000, 6000000, 480000, 90000, 60000, 630000, 7100000 + n * 150000
FROM generate_series(1, 5) s, generate_series(1, 25) n,
     generate_series(date '2025-10-01', date '2026-09-01', interval '1 month') m;

INSERT INTO growth_measurements (school_id, child_id, class_id, measured_on, weight_kg, height_cm, age_days, age_months,
                                 bmi, source)
SELECT md5('perf-school-' || s)::uuid, md5('perf-child-' || s || '-' || k)::uuid,
       md5('perf-class-' || s || '-' || ((k - 1) % 8 + 1))::uuid, (m + interval '14 days')::date,
       12 + (k % 9) + extract(month FROM m)::int * 0.1, 85 + (k % 25) + extract(month FROM m)::int * 0.3,
       ((m + interval '14 days')::date - (date '2020-09-01' + (k * 13 % 1500))),
       ((m + interval '14 days')::date - (date '2020-09-01' + (k * 13 % 1500))) / 30.4375, 15.5, 'CLASS'
FROM generate_series(1, 5) s, generate_series(1, 200) k,
     generate_series(date '2025-10-01', date '2026-09-01', interval '1 month') m;

INSERT INTO health_logs (school_id, child_id, class_id, log_date, type, content, temperature_c)
SELECT md5('perf-school-' || s)::uuid, md5('perf-child-' || s || '-' || k)::uuid,
       md5('perf-class-' || s || '-' || ((k - 1) % 8 + 1))::uuid, date '2025-10-06' + (k * 7 % 360), 'FEVER',
       'Sốt nhẹ, đã báo phụ huynh', 38.2
FROM generate_series(1, 5) s, generate_series(1, 200, 4) k;

INSERT INTO leave_requests (school_id, staff_id, leave_code, from_date, to_date, days, reason, status)
SELECT md5('perf-school-' || s)::uuid, md5('perf-staff-' || s || '-' || n)::uuid, 'P', d, d, 1, 'Việc gia đình',
       CASE WHEN d < date '2026-09-15' THEN 'APPROVED' ELSE 'PENDING' END
FROM generate_series(1, 5) s, generate_series(1, 25) n,
     LATERAL (SELECT day AS d FROM perf_days WHERE day >= date '2025-10-01' + n * 11 % 330 LIMIT 1) x
UNION ALL
SELECT md5('perf-school-' || s)::uuid, md5('perf-staff-' || s || '-' || n)::uuid, 'P', d, d, 1, 'Khám bệnh', 'PENDING'
FROM generate_series(1, 5) s, generate_series(1, 25, 3) n,
     LATERAL (SELECT day AS d FROM perf_days WHERE day >= date '2026-10-12' LIMIT 1) x;

INSERT INTO tasks (id, organization_id, school_id, title, priority, status, due_at)
SELECT md5('perf-task-' || s || '-' || t)::uuid, '00000000-0000-0000-0000-0000000000f0', md5('perf-school-' || s)::uuid,
       'Việc định kỳ ' || t, (ARRAY['LOW', 'MEDIUM', 'HIGH'])[1 + t % 3],
       (ARRAY['NEW', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DONE'])[1 + t % 4], date '2025-10-01' + t * 9
FROM generate_series(1, 5) s, generate_series(1, 40) t;

INSERT INTO task_assignees (organization_id, school_id, task_id, staff_id)
SELECT '00000000-0000-0000-0000-0000000000f0', md5('perf-school-' || s)::uuid, md5('perf-task-' || s || '-' || t)::uuid,
       md5('perf-staff-' || s || '-' || (t % 25 + 1))::uuid
FROM generate_series(1, 5) s, generate_series(1, 40) t;

ANALYZE;

-- 1. Thêm năm học mặc định cho Trường MN Phan Bội Châu
INSERT INTO school_years (id, organization_id, name, start_date, end_date, is_current)
VALUES ('7d3c0b8e-5a41-4c2e-9f1a-0b5c0a0000a1', '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001', '2026–2027', '2026-09-01', '2027-05-31', true)
ON CONFLICT DO NOTHING;

-- 2. Thêm năm học mặc định cho các tổ chức thật khác nếu chưa có (bỏ qua seed dev có prefix 00000000-)
INSERT INTO school_years (id, organization_id, name, start_date, end_date, is_current)
SELECT gen_random_uuid(), o.id, '2026–2027', '2026-09-01', '2027-05-31', true
FROM organizations o
WHERE o.id::text NOT LIKE '00000000-%'
  AND NOT EXISTS (
    SELECT 1 FROM school_years sy WHERE sy.organization_id = o.id
);

-- 3. Cập nhật provision_organization để tổ chức thật mới tạo sau này luôn có năm học mặc định
CREATE OR REPLACE FUNCTION provision_organization(p_id uuid, p_name text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO organizations (id, name) VALUES (p_id, p_name)
    ON CONFLICT (id) DO NOTHING;

    IF p_id::text NOT LIKE '00000000-%' THEN
        INSERT INTO school_years (id, organization_id, name, start_date, end_date, is_current)
        VALUES (gen_random_uuid(), p_id, '2026–2027', '2026-09-01', '2027-05-31', true)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO age_groups (organization_id, code, name, min_months, max_months, max_class_size, order_no) VALUES
        (p_id, 'NHA_TRE', 'Nhà trẻ 24–36 tháng', 24, 36, 25, 1),
        (p_id, 'MAU_GIAO_3_4', 'Mẫu giáo 3–4 tuổi', 36, 48, 25, 2),
        (p_id, 'MAU_GIAO_4_5', 'Mẫu giáo 4–5 tuổi', 48, 60, 30, 3),
        (p_id, 'MAU_GIAO_5_6', 'Mẫu giáo 5–6 tuổi', 60, 72, 35, 4)
    ON CONFLICT DO NOTHING;

    INSERT INTO fee_types (organization_id, code, name, calc_method, refundable_on_absence, order_no) VALUES
        (p_id, 'HOC_PHI', 'Học phí', 'MONTHLY', false, 1),
        (p_id, 'TIEN_AN', 'Tiền ăn', 'PER_DAY', true, 2),
        (p_id, 'CSVC', 'Cơ sở vật chất', 'ONE_TIME', false, 3),
        (p_id, 'DONG_PHUC', 'Đồng phục', 'ONE_TIME', false, 4),
        (p_id, 'NANG_KHIEU', 'Năng khiếu', 'OPTIONAL', false, 5)
    ON CONFLICT DO NOTHING;

    INSERT INTO cash_categories (organization_id, direction, name, system_code, order_no) VALUES
        (p_id, 'IN', 'Thu học phí', 'TUITION', 1),
        (p_id, 'IN', 'Thu khác', NULL, 2),
        (p_id, 'OUT', 'Thực phẩm', NULL, 1),
        (p_id, 'OUT', 'Điện nước', NULL, 2),
        (p_id, 'OUT', 'Sửa chữa', NULL, 3),
        (p_id, 'OUT', 'Văn phòng phẩm', NULL, 4),
        (p_id, 'OUT', 'Lương', 'PAYROLL', 5),
        (p_id, 'OUT', 'Chi khác', NULL, 6)
    ON CONFLICT DO NOTHING;

    INSERT INTO finance_configs (organization_id, school_id, effective_from, meal_refund_rule, proration, due_day)
    VALUES (p_id, NULL, '2020-01-01', 'BEFORE_CUTOFF', 'BY_SCHOOL_DAYS', 10)
    ON CONFLICT DO NOTHING;

    INSERT INTO child_attendance_configs (organization_id, school_id, effective_from, meal_cutoff_time)
    VALUES (p_id, NULL, '2020-01-01', '08:30')
    ON CONFLICT DO NOTHING;
END $$;

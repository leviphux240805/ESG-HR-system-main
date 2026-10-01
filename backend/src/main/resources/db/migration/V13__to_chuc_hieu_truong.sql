-- Mô hình quyền mới (thiết kế mục "Vai trò và phân quyền", nhật ký 2026-10-01):
-- tổ chức → trường; hiệu trưởng là vai trò cao nhất, quản lý nhiều trường; phó hiệu trưởng giới hạn theo nhóm chức năng.
-- Dữ liệu dùng chung (school_id rỗng) và danh mục do hiệu trưởng sửa tách theo organization_id.
-- Dữ liệu hiện có chuyển vào một tổ chức mặc định; OWNER, CHAIN_ADMIN thành PRINCIPAL ở mọi trường.

-- ---------------------------------------------------------------- tổ chức
CREATE TABLE organizations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(200) NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id)
);

INSERT INTO organizations (id, name) VALUES ('00000000-0000-0000-0000-0000000000f0', 'Tổ chức mặc định');

-- ---------------------------------------------------------------- trường, người dùng
ALTER TABLE schools ADD COLUMN organization_id uuid REFERENCES organizations (id);
UPDATE schools SET organization_id = '00000000-0000-0000-0000-0000000000f0';
ALTER TABLE schools ALTER COLUMN organization_id SET NOT NULL;
DROP INDEX schools_code_uq;
CREATE UNIQUE INDEX schools_code_uq ON schools (organization_id, code);

ALTER TABLE users ADD COLUMN organization_id uuid REFERENCES organizations (id);
UPDATE users SET organization_id = '00000000-0000-0000-0000-0000000000f0';
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX users_organization_idx ON users (organization_id);

-- ---------------------------------------------------------------- organization_id cho dữ liệu dùng chung và danh mục
-- Dòng có school_id lấy tổ chức của trường; dòng dùng chung thuộc tổ chức mặc định.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['holidays', 'files', 'doc_folders', 'library_documents', 'attendance_configs', 'tasks',
                             'task_assignees', 'task_checklist_items', 'task_comments', 'task_attachments',
                             'child_attendance_configs', 'finance_configs', 'cash_categories', 'dishes']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id uuid REFERENCES organizations (id)', t);
        EXECUTE format('UPDATE %I x SET organization_id = coalesce((SELECT s.organization_id FROM schools s WHERE s.id = x.school_id), %L)',
                       t, '00000000-0000-0000-0000-0000000000f0');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', t);
        EXECUTE format('CREATE INDEX %I ON %I (organization_id)', t || '_organization_idx', t);
    END LOOP;
    FOREACH t IN ARRAY ARRAY['school_years', 'age_groups', 'fee_types']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id uuid REFERENCES organizations (id)', t);
        EXECUTE format('UPDATE %I SET organization_id = %L', t, '00000000-0000-0000-0000-0000000000f0');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', t);
    END LOOP;
END $$;

-- Ràng buộc duy nhất tính trong tổ chức
DROP INDEX school_years_name_uq;
DROP INDEX school_years_current_uq;
CREATE UNIQUE INDEX school_years_name_uq ON school_years (organization_id, name);
CREATE UNIQUE INDEX school_years_current_uq ON school_years (organization_id) WHERE is_current;

ALTER TABLE age_groups DROP CONSTRAINT age_groups_code_key;
ALTER TABLE age_groups ADD CONSTRAINT age_groups_code_uq UNIQUE (organization_id, code);

ALTER TABLE fee_types DROP CONSTRAINT fee_types_code_key;
ALTER TABLE fee_types ADD CONSTRAINT fee_types_code_uq UNIQUE (organization_id, code);

ALTER TABLE holidays DROP CONSTRAINT holidays_uq;
ALTER TABLE holidays ADD CONSTRAINT holidays_uq UNIQUE NULLS NOT DISTINCT (organization_id, school_id, holiday_date);

DROP INDEX doc_folders_name_uq;
CREATE UNIQUE INDEX doc_folders_name_uq ON doc_folders (organization_id, school_id, parent_id, lower(name)) NULLS NOT DISTINCT;

ALTER TABLE attendance_configs DROP CONSTRAINT attendance_configs_uq;
ALTER TABLE attendance_configs ADD CONSTRAINT attendance_configs_uq
    UNIQUE NULLS NOT DISTINCT (organization_id, school_id, effective_from);

ALTER TABLE child_attendance_configs DROP CONSTRAINT child_attendance_configs_uq;
ALTER TABLE child_attendance_configs ADD CONSTRAINT child_attendance_configs_uq
    UNIQUE NULLS NOT DISTINCT (organization_id, school_id, effective_from);

ALTER TABLE finance_configs DROP CONSTRAINT finance_configs_uq;
ALTER TABLE finance_configs ADD CONSTRAINT finance_configs_uq
    UNIQUE NULLS NOT DISTINCT (organization_id, school_id, effective_from);

ALTER TABLE cash_categories DROP CONSTRAINT cash_categories_name_uq;
ALTER TABLE cash_categories DROP CONSTRAINT cash_categories_system_code_key;
ALTER TABLE cash_categories ADD CONSTRAINT cash_categories_name_uq
    UNIQUE NULLS NOT DISTINCT (organization_id, school_id, direction, name);
ALTER TABLE cash_categories ADD CONSTRAINT cash_categories_system_code_uq UNIQUE (organization_id, system_code);

ALTER TABLE dishes DROP CONSTRAINT dishes_name_uq;
ALTER TABLE dishes ADD CONSTRAINT dishes_name_uq UNIQUE NULLS NOT DISTINCT (organization_id, school_id, name);

-- ---------------------------------------------------------------- vai trò
ALTER TABLE user_roles ADD COLUMN function_groups varchar(20)[];

INSERT INTO user_roles (user_id, role_code, school_id)
SELECT r.user_id, 'PRINCIPAL', s.id
FROM user_roles r CROSS JOIN schools s
WHERE r.role_code IN ('OWNER', 'CHAIN_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_code, school_id)
SELECT r.user_id, 'ACCOUNTANT', s.id
FROM user_roles r CROSS JOIN schools s
WHERE r.role_code = 'ACCOUNTANT' AND r.school_id IS NULL
ON CONFLICT DO NOTHING;

DELETE FROM user_roles WHERE role_code IN ('OWNER', 'CHAIN_ADMIN') OR school_id IS NULL;

ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_code;
ALTER TABLE user_roles DROP CONSTRAINT user_roles_scope;
ALTER TABLE user_roles ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_code CHECK (role_code IN
    ('PRINCIPAL', 'VICE_PRINCIPAL', 'ACCOUNTANT', 'TEACHER', 'NURSE', 'KITCHEN', 'STAFF'));
-- Nhóm chức năng chỉ dành cho phó hiệu trưởng
ALTER TABLE user_roles ADD CONSTRAINT user_roles_function_groups CHECK (
    (role_code = 'VICE_PRINCIPAL' AND function_groups IS NOT NULL
        AND function_groups <@ ARRAY['CLASSROOM', 'NUTRITION', 'HR', 'FINANCE', 'REPORTS']::varchar(20)[])
    OR (role_code <> 'VICE_PRINCIPAL' AND function_groups IS NULL));

-- ---------------------------------------------------------------- khởi tạo tổ chức mới (bên vận hành)
-- SELECT provision_organization('<uuid>', 'Tên tổ chức'); rồi tạo tài khoản hiệu trưởng và gán PRINCIPAL ở trường.
-- Chép danh mục mặc định (khối, khoản thu, danh mục thu chi, cấu hình tài chính, giờ báo ăn) như V7, V10.
CREATE FUNCTION provision_organization(p_id uuid, p_name text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO organizations (id, name) VALUES (p_id, p_name);

    INSERT INTO age_groups (organization_id, code, name, min_months, max_months, max_class_size, order_no) VALUES
        (p_id, 'NHA_TRE', 'Nhà trẻ 24–36 tháng', 24, 36, 25, 1),
        (p_id, 'MAU_GIAO_3_4', 'Mẫu giáo 3–4 tuổi', 36, 48, 25, 2),
        (p_id, 'MAU_GIAO_4_5', 'Mẫu giáo 4–5 tuổi', 48, 60, 30, 3),
        (p_id, 'MAU_GIAO_5_6', 'Mẫu giáo 5–6 tuổi', 60, 72, 35, 4);

    INSERT INTO fee_types (organization_id, code, name, calc_method, refundable_on_absence, order_no) VALUES
        (p_id, 'HOC_PHI', 'Học phí', 'MONTHLY', false, 1),
        (p_id, 'TIEN_AN', 'Tiền ăn', 'PER_DAY', true, 2),
        (p_id, 'CSVC', 'Cơ sở vật chất', 'ONE_TIME', false, 3),
        (p_id, 'DONG_PHUC', 'Đồng phục', 'ONE_TIME', false, 4),
        (p_id, 'NANG_KHIEU', 'Năng khiếu', 'OPTIONAL', false, 5);

    INSERT INTO cash_categories (organization_id, direction, name, system_code, order_no) VALUES
        (p_id, 'IN', 'Thu học phí', 'TUITION', 1),
        (p_id, 'IN', 'Thu khác', NULL, 2),
        (p_id, 'OUT', 'Thực phẩm', NULL, 1),
        (p_id, 'OUT', 'Điện nước', NULL, 2),
        (p_id, 'OUT', 'Sửa chữa', NULL, 3),
        (p_id, 'OUT', 'Văn phòng phẩm', NULL, 4),
        (p_id, 'OUT', 'Lương', 'PAYROLL', 5),
        (p_id, 'OUT', 'Chi khác', NULL, 6);

    INSERT INTO finance_configs (organization_id, school_id, effective_from, meal_refund_rule, proration, due_day)
    VALUES (p_id, NULL, '2020-01-01', 'BEFORE_CUTOFF', 'BY_SCHOOL_DAYS', 10);

    INSERT INTO child_attendance_configs (organization_id, school_id, effective_from, meal_cutoff_time)
    VALUES (p_id, NULL, '2020-01-01', '08:30');
END $$;

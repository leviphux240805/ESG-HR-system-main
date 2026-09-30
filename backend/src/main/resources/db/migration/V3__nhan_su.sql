-- Giai đoạn 2 – Nhân sự: hồ sơ nhân viên, phân công cơ sở, hợp đồng, cấu hình lương, người phụ thuộc,
-- chứng chỉ, đào tạo, giấy tờ theo loại, đề xuất cập nhật. Thay bảng employees của ESG HR.

-- ---------------------------------------------------------------- staff
CREATE SEQUENCE staff_code_seq START 1;

CREATE TABLE staff (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id             uuid         NOT NULL REFERENCES schools (id),   -- cơ sở hiện tại
    staff_code            varchar(20)  NOT NULL DEFAULT ('NV' || lpad(nextval('staff_code_seq')::text, 4, '0')),
    full_name             varchar(200) NOT NULL,
    dob                   date,
    gender                varchar(10),
    ethnicity             varchar(50),
    citizen_id            varchar(12),
    citizen_id_issued_on  date,
    phone                 varchar(15),
    email                 varchar(255),
    -- Địa chỉ: tỉnh + phường/xã (34 tỉnh, không có quận/huyện), mã theo public/addressData.json
    perm_province_code    varchar(5),
    perm_ward_code        varchar(10),
    perm_address_detail   varchar(300),
    curr_province_code    varchar(5),
    curr_ward_code        varchar(10),
    curr_address_detail   varchar(300),
    position              varchar(20)  NOT NULL,
    qualification         varchar(20),
    specialization        varchar(200),
    bank_name             varchar(100),
    bank_account_no       varchar(30),
    bank_account_holder   varchar(200),
    social_insurance_no   varchar(20),
    health_insurance_no   varchar(20),
    personal_tax_code     varchar(15),
    photo_file_id         uuid REFERENCES files (id),
    start_date            date         NOT NULL,
    end_date              date,
    status                varchar(12)  NOT NULL DEFAULT 'ACTIVE',
    termination_reason    varchar(500),
    deleted_at            timestamptz,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    created_by            uuid REFERENCES users (id),
    CONSTRAINT staff_gender CHECK (gender IN ('MALE', 'FEMALE')),
    CONSTRAINT staff_citizen_id_digits CHECK (citizen_id ~ '^[0-9]{12}$'),
    CONSTRAINT staff_phone_digits CHECK (phone ~ '^[0-9]{9,15}$'),
    CONSTRAINT staff_email_lower CHECK (email = lower(email)),
    CONSTRAINT staff_position CHECK (position IN
        ('TEACHER', 'NANNY', 'COOK', 'NURSE', 'ACCOUNTANT', 'SECURITY', 'MANAGER', 'OTHER')),
    CONSTRAINT staff_qualification CHECK (qualification IN
        ('HIGH_SCHOOL', 'INTERMEDIATE', 'COLLEGE', 'BACHELOR', 'MASTER', 'OTHER')),
    CONSTRAINT staff_status CHECK (status IN ('ACTIVE', 'TERMINATED')),
    CONSTRAINT staff_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE UNIQUE INDEX staff_code_uq ON staff (staff_code);
-- Trùng CCCD/SĐT/email bị chặn toàn chuỗi (bỏ qua hồ sơ đã xóa mềm)
CREATE UNIQUE INDEX staff_citizen_id_uq ON staff (citizen_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX staff_phone_uq ON staff (phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX staff_email_uq ON staff (email) WHERE deleted_at IS NULL;
CREATE INDEX staff_school_status_idx ON staff (school_id, status) WHERE deleted_at IS NULL;

-- Tài khoản đăng nhập gắn với hồ sơ nhân viên (tối đa một tài khoản mỗi nhân viên)
ALTER TABLE users ADD CONSTRAINT users_staff_fk FOREIGN KEY (staff_id) REFERENCES staff (id);
CREATE UNIQUE INDEX users_staff_uq ON users (staff_id) WHERE staff_id IS NOT NULL;

-- ---------------------------------------------------------------- staff_school_assignments
-- Lịch sử cơ sở làm việc. Không lọc theo cơ sở: lịch sử điều chuyển luôn đầy đủ (truy cập qua hồ sơ nhân viên).
CREATE TABLE staff_school_assignments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id          uuid         NOT NULL REFERENCES staff (id),
    school_id         uuid         NOT NULL REFERENCES schools (id),
    from_date         date         NOT NULL,
    to_date           date,
    decision_file_id  uuid REFERENCES files (id),
    note              varchar(500),
    created_at        timestamptz  NOT NULL DEFAULT now(),
    updated_at        timestamptz  NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES users (id),
    CONSTRAINT staff_assignments_dates CHECK (to_date IS NULL OR to_date >= from_date)
);
CREATE INDEX staff_assignments_staff_idx ON staff_school_assignments (staff_id, from_date);

-- ---------------------------------------------------------------- staff_contracts
CREATE TABLE staff_contracts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid         NOT NULL REFERENCES staff (id),
    contract_type   varchar(20)  NOT NULL,
    contract_no     varchar(50),
    signed_on       date,
    start_date      date         NOT NULL,
    end_date        date,
    file_id         uuid REFERENCES files (id),
    note            varchar(500),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT staff_contracts_type CHECK (contract_type IN ('PROBATION', 'DEFINITE', 'INDEFINITE', 'SERVICE')),
    CONSTRAINT staff_contracts_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX staff_contracts_staff_idx ON staff_contracts (staff_id, start_date DESC);
CREATE INDEX staff_contracts_end_idx ON staff_contracts (end_date) WHERE end_date IS NOT NULL;

-- ---------------------------------------------------------------- staff_salary_configs
-- Chỉ thêm bản mới có ngày hiệu lực, không sửa đè (lịch sử lương tự có).
CREATE TABLE staff_salary_configs (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id          uuid           NOT NULL REFERENCES staff (id),
    effective_from    date           NOT NULL,
    salary_mode       varchar(12)    NOT NULL,
    base_salary       numeric(14, 0),
    coefficient       numeric(6, 3),
    region            varchar(3),
    allowances        jsonb          NOT NULL DEFAULT '{}'::jsonb,
    insurance_salary  numeric(14, 0),
    note              varchar(500),
    created_at        timestamptz    NOT NULL DEFAULT now(),
    updated_at        timestamptz    NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES users (id),
    CONSTRAINT salary_configs_mode CHECK (salary_mode IN ('FIXED', 'COEFFICIENT')),
    CONSTRAINT salary_configs_region CHECK (region IN ('I', 'II', 'III', 'IV')),
    CONSTRAINT salary_configs_amounts CHECK (
        (salary_mode = 'FIXED' AND base_salary IS NOT NULL AND base_salary >= 0)
        OR (salary_mode = 'COEFFICIENT' AND coefficient IS NOT NULL AND coefficient > 0)
    ),
    CONSTRAINT salary_configs_uq UNIQUE (staff_id, effective_from)
);

-- ---------------------------------------------------------------- staff_dependents
CREATE TABLE staff_dependents (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id      uuid         NOT NULL REFERENCES staff (id),
    full_name     varchar(200) NOT NULL,
    relationship  varchar(50)  NOT NULL,
    dob           date,
    id_number     varchar(20),
    from_month    date         NOT NULL,   -- ngày đầu tháng bắt đầu giảm trừ
    to_month      date,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES users (id),
    CONSTRAINT staff_dependents_months CHECK (to_month IS NULL OR to_month >= from_month)
);
CREATE INDEX staff_dependents_staff_idx ON staff_dependents (staff_id);

-- ---------------------------------------------------------------- staff_certificates
CREATE TABLE staff_certificates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id     uuid         NOT NULL REFERENCES staff (id),
    name         varchar(200) NOT NULL,
    issued_by    varchar(200),
    issue_date   date,
    expiry_date  date,
    file_id      uuid REFERENCES files (id),
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id)
);
CREATE INDEX staff_certificates_staff_idx ON staff_certificates (staff_id);
CREATE INDEX staff_certificates_expiry_idx ON staff_certificates (expiry_date) WHERE expiry_date IS NOT NULL;

-- ---------------------------------------------------------------- staff_trainings
CREATE TABLE staff_trainings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id     uuid         NOT NULL REFERENCES staff (id),
    course_name  varchar(200) NOT NULL,
    provider     varchar(200),
    start_date   date,
    end_date     date,
    result       varchar(200),
    file_id      uuid REFERENCES files (id),
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id)
);
CREATE INDEX staff_trainings_staff_idx ON staff_trainings (staff_id);

-- ---------------------------------------------------------------- document_types
CREATE TABLE document_types (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(50)  NOT NULL,
    name        varchar(200) NOT NULL,
    scope       varchar(10)  NOT NULL,
    category    varchar(20)  NOT NULL DEFAULT 'OTHER',
    has_expiry  boolean      NOT NULL DEFAULT false,
    sort_order  int          NOT NULL DEFAULT 0,
    is_active   boolean      NOT NULL DEFAULT true,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT document_types_scope CHECK (scope IN ('STAFF', 'CHILD', 'LIBRARY')),
    -- Nhóm hiển thị trên hồ sơ: DECISION ở tab "Hợp đồng & quyết định", còn lại ở tab "Giấy tờ"
    CONSTRAINT document_types_category CHECK (category IN
        ('IDENTITY', 'DECISION', 'HEALTH', 'EDUCATION', 'INSURANCE', 'DISCIPLINE', 'SAFETY', 'OTHER'))
);
CREATE UNIQUE INDEX document_types_code_uq ON document_types (code);

-- Danh mục loại giấy tờ nhân viên (mã giữ theo ESG HR)
INSERT INTO document_types (code, name, scope, category, has_expiry, sort_order) VALUES
    ('CCCD_MAT_TRUOC',         'CCCD – mặt trước',                    'STAFF', 'IDENTITY',   true,  10),
    ('CCCD_MAT_SAU',           'CCCD – mặt sau',                      'STAFF', 'IDENTITY',   true,  11),
    ('SO_YEU_LY_LICH',         'Sơ yếu lý lịch',                      'STAFF', 'IDENTITY',   false, 12),
    ('LY_LICH_TU_PHAP',        'Lý lịch tư pháp',                     'STAFF', 'IDENTITY',   true,  13),
    ('QUYET_DINH_TIEP_NHAN',   'Quyết định tiếp nhận',                'STAFF', 'DECISION',   false, 20),
    ('QUYET_DINH_BO_NHIEM',    'Quyết định bổ nhiệm',                 'STAFF', 'DECISION',   false, 21),
    ('QUYET_DINH_DIEU_CHUYEN', 'Quyết định điều chuyển',              'STAFF', 'DECISION',   false, 22),
    ('QUYET_DINH_CHAM_DUT',    'Quyết định chấm dứt hợp đồng',        'STAFF', 'DECISION',   false, 23),
    ('THOA_THUAN_NDA',         'Thỏa thuận bảo mật (NDA)',            'STAFF', 'DECISION',   false, 24),
    ('THOA_THUAN_NCA',         'Thỏa thuận không cạnh tranh',         'STAFF', 'DECISION',   false, 25),
    ('BANG_CAP',               'Bằng cấp chuyên môn',                 'STAFF', 'EDUCATION',  false, 30),
    ('GIAY_KHAM_SUC_KHOE',     'Giấy khám sức khỏe',                  'STAFF', 'HEALTH',     true,  40),
    ('HO_SO_TANG_LAO_DONG',    'Hồ sơ báo tăng lao động (BHXH)',      'STAFF', 'INSURANCE',  false, 50),
    ('HO_SO_GIAM_LAO_DONG',    'Hồ sơ báo giảm lao động (BHXH)',      'STAFF', 'INSURANCE',  false, 51),
    ('QUYET_TOAN_THUE',        'Quyết toán thuế TNCN',                'STAFF', 'INSURANCE',  false, 52),
    ('BIEN_BAN_VI_PHAM',       'Biên bản vi phạm',                    'STAFF', 'DISCIPLINE', false, 60),
    ('QUYET_DINH_KY_LUAT',     'Quyết định kỷ luật',                  'STAFF', 'DISCIPLINE', false, 61),
    ('HO_SO_TAI_NAN',          'Hồ sơ tai nạn lao động',              'STAFF', 'SAFETY',     false, 70),
    ('HO_SO_PCCC',             'Chứng nhận huấn luyện PCCC',          'STAFF', 'SAFETY',     true,  71),
    ('CAM_KET_NOI_QUY',        'Cam kết nội quy',                     'STAFF', 'SAFETY',     false, 72),
    ('CAM_KET_BAO_MAT',        'Cam kết bảo mật thông tin',           'STAFF', 'SAFETY',     false, 73),
    ('TAI_LIEU_KHAC',          'Tài liệu khác',                       'STAFF', 'OTHER',      false, 99);

-- ---------------------------------------------------------------- staff_documents
-- Mỗi dòng là một phiên bản giấy tờ; bản mới nhất theo loại là bản hiện hành.
CREATE TABLE staff_documents (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id          uuid         NOT NULL REFERENCES staff (id),
    document_type_id  uuid         NOT NULL REFERENCES document_types (id),
    file_id           uuid         NOT NULL REFERENCES files (id),
    issued_date       date,
    expiry_date       date,
    note              varchar(500),
    created_at        timestamptz  NOT NULL DEFAULT now(),
    updated_at        timestamptz  NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES users (id)
);
CREATE INDEX staff_documents_staff_type_idx ON staff_documents (staff_id, document_type_id, created_at DESC);
CREATE INDEX staff_documents_expiry_idx ON staff_documents (expiry_date) WHERE expiry_date IS NOT NULL;

-- ---------------------------------------------------------------- staff_change_requests
-- Nhân viên tự đề xuất cập nhật SĐT/địa chỉ/tài khoản ngân hàng; người có quyền duyệt rồi mới áp vào hồ sơ.
CREATE TABLE staff_change_requests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id      uuid         NOT NULL REFERENCES staff (id),
    school_id     uuid         NOT NULL REFERENCES schools (id),
    changes       jsonb        NOT NULL,
    status        varchar(10)  NOT NULL DEFAULT 'PENDING',
    reviewed_by   uuid REFERENCES users (id),
    reviewed_at   timestamptz,
    review_note   varchar(500),
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES users (id),
    CONSTRAINT staff_change_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);
CREATE INDEX staff_change_requests_school_idx ON staff_change_requests (school_id, status);

-- ---------------------------------------------------------------- notifications
-- Job nền dùng dedupe_key để không tạo lại cùng một thông báo cho cùng người nhận
ALTER TABLE notifications ADD COLUMN dedupe_key varchar(200);
CREATE UNIQUE INDEX notifications_dedupe_uq ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Giai đoạn 1 – Nền tảng: cơ sở, tài khoản, phân quyền, cấu hình chung, thông báo, nhật ký, file.
-- Quy ước: khóa chính UUID; mọi bảng có created_at, updated_at, created_by; trạng thái varchar + CHECK.

-- ---------------------------------------------------------------- users
-- Tạo trước để các bảng khác tham chiếu created_by.
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           varchar(255) NOT NULL,
    phone           varchar(15),
    full_name       varchar(200) NOT NULL,
    password_hash   varchar(100) NOT NULL,
    staff_id        uuid,          -- FK tới staff thêm ở giai đoạn 2
    guardian_id     uuid,          -- FK tới guardians thêm ở giai đoạn 5
    is_active       boolean      NOT NULL DEFAULT true,
    last_login_at   timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT users_email_format CHECK (email = lower(email) AND position('@' IN email) > 1),
    CONSTRAINT users_phone_digits CHECK (phone ~ '^[0-9]{9,15}$')
);
CREATE UNIQUE INDEX users_email_uq ON users (email);
CREATE UNIQUE INDEX users_phone_uq ON users (phone);

-- ---------------------------------------------------------------- schools
CREATE TABLE schools (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(20)  NOT NULL,
    name            varchar(200) NOT NULL,
    province_code   varchar(5),    -- mã tỉnh theo public/addressData.json (34 tỉnh)
    ward_code       varchar(10),   -- mã phường/xã; không có cấp quận/huyện
    address_detail  varchar(300),
    phone           varchar(20),
    license_no      varchar(50),
    is_active       boolean      NOT NULL DEFAULT true,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id)
);
CREATE UNIQUE INDEX schools_code_uq ON schools (code);

-- ---------------------------------------------------------------- user_roles
-- Mỗi dòng: một vai trò kèm phạm vi. school_id rỗng = toàn chuỗi.
CREATE TABLE user_roles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_code       varchar(20)  NOT NULL,
    school_id       uuid REFERENCES schools (id),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT user_roles_role_code CHECK (role_code IN
        ('OWNER', 'CHAIN_ADMIN', 'ACCOUNTANT', 'PRINCIPAL', 'TEACHER', 'NURSE', 'KITCHEN', 'STAFF')),
    -- OWNER, CHAIN_ADMIN chỉ gán toàn chuỗi; ACCOUNTANT gán toàn chuỗi hoặc từng cơ sở; còn lại gán một cơ sở
    CONSTRAINT user_roles_scope CHECK (
        (role_code IN ('OWNER', 'CHAIN_ADMIN') AND school_id IS NULL)
        OR role_code = 'ACCOUNTANT'
        OR (role_code IN ('PRINCIPAL', 'TEACHER', 'NURSE', 'KITCHEN', 'STAFF') AND school_id IS NOT NULL)
    ),
    CONSTRAINT user_roles_uq UNIQUE NULLS NOT DISTINCT (user_id, role_code, school_id)
);
CREATE INDEX user_roles_school_idx ON user_roles (school_id);

-- ---------------------------------------------------------------- refresh_tokens
-- Chỉ lưu SHA-256 của token. Mỗi lần refresh sinh token mới cùng family_id;
-- dùng lại token đã thay thế thì thu hồi cả family (phát hiện token bị đánh cắp).
CREATE TABLE refresh_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash      varchar(64)  NOT NULL,
    family_id       uuid         NOT NULL,
    remember_me     boolean      NOT NULL DEFAULT false,
    expires_at      timestamptz  NOT NULL,
    revoked_at      timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id)
);
CREATE UNIQUE INDEX refresh_tokens_hash_uq ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ---------------------------------------------------------------- school_years
CREATE TABLE school_years (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(20)  NOT NULL,
    start_date      date         NOT NULL,
    end_date        date         NOT NULL,
    is_current      boolean      NOT NULL DEFAULT false,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT school_years_dates CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX school_years_name_uq ON school_years (name);
-- Chỉ một năm học hiện hành
CREATE UNIQUE INDEX school_years_current_uq ON school_years (is_current) WHERE is_current;

-- ---------------------------------------------------------------- holidays
CREATE TABLE holidays (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid REFERENCES schools (id),   -- rỗng = áp dụng toàn chuỗi
    holiday_date    date         NOT NULL,
    name            varchar(200) NOT NULL,
    is_custom       boolean      NOT NULL DEFAULT false,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT holidays_uq UNIQUE NULLS NOT DISTINCT (school_id, holiday_date)
);
CREATE INDEX holidays_date_idx ON holidays (holiday_date);

-- ---------------------------------------------------------------- notifications
CREATE TABLE notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type            varchar(50)  NOT NULL,
    title           varchar(300) NOT NULL,
    body            text,
    link            varchar(500),
    read_at         timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id)
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- ---------------------------------------------------------------- audit_logs
-- Thời điểm thao tác = created_at.
CREATE TABLE audit_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users (id),
    entity          varchar(100) NOT NULL,
    entity_id       uuid         NOT NULL,
    action          varchar(20)  NOT NULL,
    before_data     jsonb,
    after_data      jsonb,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT audit_logs_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE'))
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity, entity_id, created_at DESC);

-- ---------------------------------------------------------------- files
-- Metadata file trên S3/MinIO. PENDING = đã cấp link upload; READY = đã kiểm tra object trên storage.
CREATE TABLE files (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid REFERENCES schools (id),   -- rỗng = dùng chung toàn chuỗi
    storage_key     varchar(500) NOT NULL,
    original_name   varchar(255) NOT NULL,
    mime_type       varchar(100) NOT NULL,
    size_bytes      bigint       NOT NULL,
    status          varchar(10)  NOT NULL DEFAULT 'PENDING',
    uploaded_by     uuid         NOT NULL REFERENCES users (id),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT files_status CHECK (status IN ('PENDING', 'READY')),
    CONSTRAINT files_size_positive CHECK (size_bytes > 0)
);
CREATE UNIQUE INDEX files_storage_key_uq ON files (storage_key);
CREATE INDEX files_school_idx ON files (school_id);

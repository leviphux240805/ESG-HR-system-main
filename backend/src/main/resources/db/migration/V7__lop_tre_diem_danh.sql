-- Giai đoạn 5 – Lớp học, hồ sơ trẻ, điểm danh (thiết kế mục 7).
-- Năm học (school_years, đã có ở V1) → khối theo độ tuổi → lớp → giáo viên phụ trách; trẻ xếp vào lớp theo
-- class_enrollments (giữ cả lịch sử để lên lớp không mất dấu). Điểm danh sáng chốt trước giờ báo ăn.

-- ---------------------------------------------------------------- khối theo độ tuổi (danh mục chung toàn chuỗi)
CREATE TABLE age_groups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(20)  NOT NULL UNIQUE,
    name            varchar(100) NOT NULL,
    min_months      integer      NOT NULL,
    max_months      integer      NOT NULL,
    -- Sĩ số tối đa theo Điều lệ trường mầm non; sửa được khi văn bản thay đổi
    max_class_size  integer      NOT NULL,
    order_no        integer      NOT NULL,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT age_groups_months CHECK (min_months < max_months)
);

INSERT INTO age_groups (code, name, min_months, max_months, max_class_size, order_no) VALUES
    ('NHA_TRE', 'Nhà trẻ 24–36 tháng', 24, 36, 25, 1),
    ('MAU_GIAO_3_4', 'Mẫu giáo 3–4 tuổi', 36, 48, 25, 2),
    ('MAU_GIAO_4_5', 'Mẫu giáo 4–5 tuổi', 48, 60, 30, 3),
    ('MAU_GIAO_5_6', 'Mẫu giáo 5–6 tuổi', 60, 72, 35, 4);

-- ---------------------------------------------------------------- lớp
CREATE TABLE classes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    school_year_id  uuid         NOT NULL REFERENCES school_years (id),
    age_group_id    uuid         NOT NULL REFERENCES age_groups (id),
    name            varchar(100) NOT NULL,
    room            varchar(50),
    capacity        integer      NOT NULL,
    note            varchar(500),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT classes_capacity CHECK (capacity > 0),
    CONSTRAINT classes_name_uq UNIQUE (school_id, school_year_id, name)
);
CREATE INDEX classes_school_year_idx ON classes (school_id, school_year_id);

-- Giáo viên phụ trách; to_date rỗng = đang phụ trách
CREATE TABLE class_teachers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid        NOT NULL REFERENCES schools (id),
    class_id    uuid        NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
    staff_id    uuid        NOT NULL REFERENCES staff (id),
    role        varchar(10) NOT NULL DEFAULT 'MAIN',
    from_date   date        NOT NULL,
    to_date     date,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT class_teachers_role CHECK (role IN ('MAIN', 'ASSISTANT')),
    CONSTRAINT class_teachers_dates CHECK (to_date IS NULL OR to_date >= from_date)
);
-- Một giáo viên chỉ có một phân công đang hiệu lực trong một lớp
CREATE UNIQUE INDEX class_teachers_active_uq ON class_teachers (class_id, staff_id) WHERE to_date IS NULL;
CREATE INDEX class_teachers_staff_idx ON class_teachers (staff_id) WHERE to_date IS NULL;

-- ---------------------------------------------------------------- trẻ
CREATE SEQUENCE child_code_seq START 1;

CREATE TABLE children (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            uuid         NOT NULL REFERENCES schools (id),
    child_code           varchar(30)  NOT NULL DEFAULT ('HS' || lpad(nextval('child_code_seq')::text, 5, '0')),
    full_name            varchar(150) NOT NULL,
    nickname             varchar(50),
    dob                  date         NOT NULL,
    gender               varchar(10)  NOT NULL,
    -- Mã định danh cá nhân (giấy khai sinh / CCCD trẻ em)
    personal_id          varchar(20),
    health_insurance_no  varchar(20),
    province_code        varchar(5),
    ward_code            varchar(10),
    address_detail       varchar(300),
    allergy_note         varchar(500),
    health_note          varchar(1000),
    status               varchar(20)  NOT NULL DEFAULT 'STUDYING',
    enrolled_at          date         NOT NULL,
    left_at              date,
    left_reason          varchar(300),
    photo_file_id        uuid REFERENCES files (id),
    created_at           timestamptz  NOT NULL DEFAULT now(),
    updated_at           timestamptz  NOT NULL DEFAULT now(),
    created_by           uuid REFERENCES users (id),
    deleted_at           timestamptz,
    CONSTRAINT children_gender CHECK (gender IN ('MALE', 'FEMALE')),
    -- Đang học / Bảo lưu / Đã nghỉ / Hoàn thành chương trình
    CONSTRAINT children_status CHECK (status IN ('STUDYING', 'RESERVED', 'LEFT', 'COMPLETED')),
    CONSTRAINT children_left CHECK (left_at IS NULL OR left_at >= enrolled_at)
);
CREATE UNIQUE INDEX children_code_uq ON children (child_code);
CREATE UNIQUE INDEX children_personal_id_uq ON children (personal_id)
    WHERE deleted_at IS NULL AND personal_id IS NOT NULL;
CREATE INDEX children_school_status_idx ON children (school_id, status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------- phụ huynh, người được phép đón
-- TODO(assumption): phụ huynh lưu theo cơ sở; có con ở hai cơ sở thì là hai dòng (chưa có cổng phụ huynh).
CREATE TABLE guardians (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid         NOT NULL REFERENCES schools (id),
    full_name   varchar(150) NOT NULL,
    phone       varchar(15),
    email       varchar(255),
    citizen_id  varchar(20),
    job         varchar(100),
    -- Chừa sẵn cho cổng phụ huynh (ngoài phạm vi bản đầu)
    user_id     uuid REFERENCES users (id),
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id)
);
CREATE INDEX guardians_school_phone_idx ON guardians (school_id, phone);

CREATE TABLE child_guardians (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES schools (id),
    child_id      uuid        NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    guardian_id   uuid        NOT NULL REFERENCES guardians (id),
    relationship  varchar(50) NOT NULL,
    is_primary    boolean     NOT NULL DEFAULT false,
    can_pick_up   boolean     NOT NULL DEFAULT true,
    note          varchar(300),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES users (id),
    CONSTRAINT child_guardians_uq UNIQUE (child_id, guardian_id)
);
-- Mỗi trẻ chỉ một người liên hệ chính
CREATE UNIQUE INDEX child_guardians_primary_uq ON child_guardians (child_id) WHERE is_primary;

-- ---------------------------------------------------------------- giấy tờ của trẻ
CREATE TABLE child_documents (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid        NOT NULL REFERENCES schools (id),
    child_id          uuid        NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    document_type_id  uuid        NOT NULL REFERENCES document_types (id),
    file_id           uuid        NOT NULL REFERENCES files (id),
    issued_date       date,
    expiry_date       date,
    note              varchar(300),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES users (id)
);
CREATE INDEX child_documents_child_idx ON child_documents (child_id);
CREATE INDEX child_documents_expiry_idx ON child_documents (expiry_date) WHERE expiry_date IS NOT NULL;

-- ---------------------------------------------------------------- xếp lớp (giữ lịch sử để lên lớp không mất dấu)
CREATE TABLE class_enrollments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid        NOT NULL REFERENCES schools (id),
    child_id    uuid        NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    class_id    uuid        NOT NULL REFERENCES classes (id),
    from_date   date        NOT NULL,
    to_date     date,
    note        varchar(300),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT class_enrollments_dates CHECK (to_date IS NULL OR to_date >= from_date)
);
-- Một trẻ chỉ ở một lớp tại một thời điểm
CREATE UNIQUE INDEX class_enrollments_active_uq ON class_enrollments (child_id) WHERE to_date IS NULL;
CREATE INDEX class_enrollments_class_idx ON class_enrollments (class_id);

-- ---------------------------------------------------------------- điểm danh trẻ
-- Chốt trước giờ báo ăn để cấp dưỡng có số suất và học phí có số ngày vắng.
CREATE TABLE child_attendance_configs (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid REFERENCES schools (id),
    effective_from    date        NOT NULL,
    -- Qua giờ này bảng điểm danh trong ngày tự khóa
    meal_cutoff_time  time        NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES users (id),
    CONSTRAINT child_attendance_configs_uq UNIQUE NULLS NOT DISTINCT (school_id, effective_from)
);
-- Mặc định toàn chuỗi: báo ăn 08:30
INSERT INTO child_attendance_configs (school_id, effective_from, meal_cutoff_time)
VALUES (NULL, '2020-01-01', '08:30');

CREATE TABLE child_attendance (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid        NOT NULL REFERENCES schools (id),
    child_id       uuid        NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    class_id       uuid        NOT NULL REFERENCES classes (id),
    attend_date    date        NOT NULL,
    status         varchar(20) NOT NULL,
    check_in_at    timestamptz,
    check_out_at   timestamptz,
    -- Người đón, chọn trong số người được phép đón của trẻ
    picked_up_by   uuid REFERENCES guardians (id),
    note           varchar(300),
    -- Đã chốt (qua giờ báo ăn hoặc hiệu trưởng chốt); mở lại phải có lý do, ghi audit
    locked_at      timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    created_by     uuid REFERENCES users (id),
    -- Có mặt / Vắng có phép / Vắng không phép
    CONSTRAINT child_attendance_status CHECK (status IN ('PRESENT', 'EXCUSED', 'ABSENT')),
    CONSTRAINT child_attendance_uq UNIQUE (child_id, attend_date)
);
CREATE INDEX child_attendance_class_date_idx ON child_attendance (class_id, attend_date);
CREATE INDEX child_attendance_school_date_idx ON child_attendance (school_id, attend_date);

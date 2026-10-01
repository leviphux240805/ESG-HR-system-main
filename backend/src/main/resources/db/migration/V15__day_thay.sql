-- Phân công dạy thay trong ngày: người thay giáo viên nghỉ ở một lớp (trang Hôm nay)
CREATE TABLE class_substitutions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid        NOT NULL REFERENCES schools (id),
    sub_date         date        NOT NULL,
    class_id         uuid        NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
    absent_staff_id  uuid        NOT NULL REFERENCES staff (id),
    staff_id         uuid        NOT NULL REFERENCES staff (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES users (id),
    CONSTRAINT class_substitutions_other CHECK (staff_id <> absent_staff_id)
);
CREATE UNIQUE INDEX class_substitutions_uq ON class_substitutions (class_id, absent_staff_id, sub_date);
CREATE INDEX class_substitutions_school_date_idx ON class_substitutions (school_id, sub_date);

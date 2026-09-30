-- Giai đoạn 3 – Chấm công & nghỉ phép: cấu hình theo cơ sở, import máy chấm công, bảng công ngày/tháng, khóa công,
-- phép năm, đơn nghỉ. Thay attendance_config, attendance_raw_machine, attendance_manual, daily_attendance_summary,
-- attendance_monthly_summaries của ESG HR.

-- Bộ mã công ESG: X, P, 1/2P, K, 1/2K, O, CO, TS, T, NL, NB, NN

-- ---------------------------------------------------------------- mã chấm công của nhân viên
ALTER TABLE staff ADD COLUMN machine_code varchar(30);
-- Mã trên máy chấm công, duy nhất trong một cơ sở
CREATE UNIQUE INDEX staff_machine_code_uq ON staff (school_id, machine_code)
    WHERE deleted_at IS NULL AND machine_code IS NOT NULL;

-- ---------------------------------------------------------------- attendance_configs
-- Thêm bản mới theo effective_from, không sửa đè. school_id rỗng = mặc định toàn chuỗi.
-- Ngày trong tuần theo ISO: 1 = thứ Hai … 7 = Chủ nhật.
CREATE TABLE attendance_configs (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid REFERENCES schools (id),
    effective_from          date         NOT NULL,
    shift_start             time         NOT NULL,
    shift_end               time         NOT NULL,
    lunch_start             time         NOT NULL,
    lunch_end               time         NOT NULL,
    late_grace_minutes      integer      NOT NULL,
    max_late_count_allowed  integer      NOT NULL,
    working_weekdays        smallint[]   NOT NULL,
    half_day_weekdays       smallint[]   NOT NULL DEFAULT '{}',
    annual_leave_days       numeric(4,1) NOT NULL,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    updated_at              timestamptz  NOT NULL DEFAULT now(),
    created_by              uuid REFERENCES users (id),
    CONSTRAINT attendance_configs_uq UNIQUE NULLS NOT DISTINCT (school_id, effective_from),
    CONSTRAINT attendance_configs_shift CHECK (shift_start < shift_end),
    CONSTRAINT attendance_configs_lunch CHECK (lunch_start < lunch_end
        AND lunch_start > shift_start AND lunch_end < shift_end),
    CONSTRAINT attendance_configs_numbers CHECK (late_grace_minutes >= 0 AND max_late_count_allowed >= 0
        AND annual_leave_days >= 0),
    CONSTRAINT attendance_configs_weekdays CHECK (working_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
        AND half_day_weekdays <@ working_weekdays)
);

-- ---------------------------------------------------------------- import máy chấm công
CREATE TABLE attendance_import_batches (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    month           date         NOT NULL,   -- ngày đầu tháng
    file_id         uuid REFERENCES files (id),
    row_count       integer      NOT NULL,
    matched_count   integer      NOT NULL,
    unmatched_codes varchar(30)[] NOT NULL DEFAULT '{}',
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),   -- người import
    CONSTRAINT attendance_import_batches_month CHECK (extract(day FROM month) = 1)
);
CREATE INDEX attendance_import_batches_school_idx ON attendance_import_batches (school_id, month);

-- Giờ vào/ra của máy (dạng chữ như file: "07:58", "K"); mỗi nhân viên một dòng mỗi ngày, lần import sau ghi đè.
CREATE TABLE attendance_punches (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    batch_id        uuid         NOT NULL REFERENCES attendance_import_batches (id),
    staff_id        uuid         NOT NULL REFERENCES staff (id),
    machine_code    varchar(30)  NOT NULL,
    work_date       date         NOT NULL,
    check_in        varchar(10),
    check_out       varchar(10),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT attendance_punches_uq UNIQUE (staff_id, work_date)
);
CREATE INDEX attendance_punches_school_date_idx ON attendance_punches (school_id, work_date);

-- ---------------------------------------------------------------- bảng công ngày
-- status_code rỗng = chưa chấm (dòng vẫn có thể tồn tại để giữ kết quả đối soát).
CREATE TABLE staff_attendance_days (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid         NOT NULL REFERENCES schools (id),
    staff_id            uuid         NOT NULL REFERENCES staff (id),
    work_date           date         NOT NULL,
    status_code         varchar(5),
    source              varchar(10)  NOT NULL DEFAULT 'MANUAL',
    late_minutes        integer      NOT NULL DEFAULT 0,
    is_counted_late     boolean      NOT NULL DEFAULT false,
    is_discrepancy      boolean      NOT NULL DEFAULT false,
    discrepancy_reason  varchar(300),
    suggested_status    varchar(5),
    note                varchar(500),
    leave_time          time,
    return_time         time,
    confirmed_by        uuid REFERENCES users (id),
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    created_by          uuid REFERENCES users (id),
    CONSTRAINT staff_attendance_days_uq UNIQUE (staff_id, work_date),
    CONSTRAINT staff_attendance_days_status CHECK (status_code IN
        ('X', 'P', '1/2P', 'K', '1/2K', 'O', 'CO', 'TS', 'T', 'NL', 'NB', 'NN')),
    CONSTRAINT staff_attendance_days_suggested CHECK (suggested_status IN
        ('X', 'P', '1/2P', 'K', '1/2K', 'O', 'CO', 'TS', 'T', 'NL', 'NB', 'NN')),
    CONSTRAINT staff_attendance_days_source CHECK (source IN ('MANUAL', 'MACHINE', 'LEAVE')),
    CONSTRAINT staff_attendance_days_late CHECK (late_minutes >= 0)
);
CREATE INDEX staff_attendance_days_school_date_idx ON staff_attendance_days (school_id, work_date);

-- ---------------------------------------------------------------- khóa công + tổng tháng
CREATE TABLE attendance_month_locks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    month           date         NOT NULL,
    locked_at       timestamptz  NOT NULL,
    locked_by       uuid         NOT NULL REFERENCES users (id),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT attendance_month_locks_uq UNIQUE (school_id, month),
    CONSTRAINT attendance_month_locks_month CHECK (extract(day FROM month) = 1)
);

-- Tổng tháng chốt khi khóa công (dùng cho tính lương giai đoạn 4)
CREATE TABLE staff_attendance_months (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    staff_id        uuid         NOT NULL REFERENCES staff (id),
    month           date         NOT NULL,
    total_work      numeric(4,1) NOT NULL,
    paid_leave      numeric(4,1) NOT NULL,
    unpaid_leave    numeric(4,1) NOT NULL,
    holiday_leave   numeric(4,1) NOT NULL,
    late_count      integer      NOT NULL,
    locked_at       timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT staff_attendance_months_uq UNIQUE (staff_id, month),
    CONSTRAINT staff_attendance_months_month CHECK (extract(day FROM month) = 1)
);
CREATE INDEX staff_attendance_months_school_idx ON staff_attendance_months (school_id, month);

-- ---------------------------------------------------------------- phép năm + đơn nghỉ
CREATE TABLE leave_balances (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    staff_id        uuid         NOT NULL REFERENCES staff (id),
    year            integer      NOT NULL,
    annual_days     numeric(4,1) NOT NULL,
    used_days       numeric(4,1) NOT NULL DEFAULT 0,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT leave_balances_uq UNIQUE (staff_id, year),
    CONSTRAINT leave_balances_days CHECK (annual_days >= 0 AND used_days >= 0)
);

CREATE TABLE leave_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid         NOT NULL REFERENCES schools (id),
    staff_id        uuid         NOT NULL REFERENCES staff (id),
    leave_code      varchar(5)   NOT NULL,
    from_date       date         NOT NULL,
    to_date         date         NOT NULL,
    half_day        boolean      NOT NULL DEFAULT false,
    days            numeric(4,1) NOT NULL,   -- số ngày làm việc trong khoảng (nửa ngày = 0,5)
    reason          varchar(500) NOT NULL,
    file_id         uuid REFERENCES files (id),
    status          varchar(10)  NOT NULL DEFAULT 'PENDING',
    approved_by     uuid REFERENCES users (id),   -- người duyệt hoặc từ chối
    approved_at     timestamptz,
    review_note     varchar(500),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT leave_requests_code CHECK (leave_code IN ('P', 'K', 'O', 'CO', 'TS', 'T', 'NB')),
    CONSTRAINT leave_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT leave_requests_dates CHECK (to_date >= from_date),
    CONSTRAINT leave_requests_half_day CHECK (NOT half_day OR (from_date = to_date AND leave_code IN ('P', 'K')))
);
CREATE INDEX leave_requests_staff_idx ON leave_requests (staff_id, from_date);
CREATE INDEX leave_requests_school_status_idx ON leave_requests (school_id, status);

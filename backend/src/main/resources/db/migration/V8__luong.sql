-- Giai đoạn 4 – Lương & phiếu lương (thiết kế mục 6).
-- Giữ luồng ESG (lương × công thực tế / công chuẩn + phụ cấp + thưởng − phạt) và bổ sung khấu trừ bảo hiểm phần
-- người lao động, thuế TNCN lũy tiến có giảm trừ bản thân và người phụ thuộc.
-- Trạng thái kỳ lương: Nháp → Đã duyệt → Đã trả; đã duyệt thì không sửa được.

-- ---------------------------------------------------------------- tham số lương
-- Tỷ lệ và mức giảm trừ do pháp luật quy định nên dùng chung toàn chuỗi, không có school_id.
-- Chỉ thêm bản mới theo effective_from, không sửa đè (quy tắc 5).
CREATE TABLE payroll_params (
    id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    effective_from                date          NOT NULL UNIQUE,
    -- Phần người lao động đóng
    social_insurance_rate         numeric(6, 4) NOT NULL,
    health_insurance_rate         numeric(6, 4) NOT NULL,
    unemployment_insurance_rate   numeric(6, 4) NOT NULL,
    -- Giảm trừ gia cảnh khi tính thuế TNCN
    personal_deduction            numeric(14, 0) NOT NULL,
    dependent_deduction           numeric(14, 0) NOT NULL,
    -- Trần đóng BHXH/BHYT = hệ số × lương cơ sở; trần BHTN = hệ số × lương tối thiểu vùng
    base_salary                   numeric(14, 0) NOT NULL,
    insurance_cap_multiplier      integer        NOT NULL DEFAULT 20,
    region_min_wages              jsonb          NOT NULL DEFAULT '{}'::jsonb,
    -- Biểu thuế lũy tiến từng phần: [{"upTo": 5000000, "rate": 0.05}, …, {"upTo": null, "rate": 0.35}]
    pit_brackets                  jsonb          NOT NULL,
    note                          varchar(500),
    created_at                    timestamptz   NOT NULL DEFAULT now(),
    updated_at                    timestamptz   NOT NULL DEFAULT now(),
    created_by                    uuid REFERENCES users (id),
    CONSTRAINT payroll_params_rates CHECK (
        social_insurance_rate >= 0 AND health_insurance_rate >= 0 AND unemployment_insurance_rate >= 0
        AND personal_deduction >= 0 AND dependent_deduction >= 0 AND base_salary > 0
        AND insurance_cap_multiplier > 0)
);

-- TODO(assumption): số tham khảo, phải đối chiếu văn bản hiện hành trước khi trả lương thật.
-- Sửa ở màn hình /luong/tham-so bằng cách thêm bản mới theo ngày hiệu lực.
INSERT INTO payroll_params (effective_from, social_insurance_rate, health_insurance_rate,
        unemployment_insurance_rate, personal_deduction, dependent_deduction, base_salary,
        insurance_cap_multiplier, region_min_wages, pit_brackets, note)
VALUES ('2024-07-01', 0.0800, 0.0150, 0.0100, 11000000, 4400000, 2340000, 20,
        '{"I": 4960000, "II": 4410000, "III": 3860000, "IV": 3450000}'::jsonb,
        '[{"upTo": 5000000, "rate": 0.05}, {"upTo": 10000000, "rate": 0.10}, {"upTo": 18000000, "rate": 0.15},
          {"upTo": 32000000, "rate": 0.20}, {"upTo": 52000000, "rate": 0.25}, {"upTo": 80000000, "rate": 0.30},
          {"upTo": null, "rate": 0.35}]'::jsonb,
        'Số tham khảo, cần đối chiếu văn bản hiện hành');

-- ---------------------------------------------------------------- kỳ lương theo cơ sở
CREATE TABLE payroll_periods (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            uuid         NOT NULL REFERENCES schools (id),
    -- Ngày đầu tháng
    month                date         NOT NULL,
    -- Mẫu số khi chia lương theo công; tính từ cấu hình chấm công, kế toán sửa được trước khi tính
    standard_work_days   numeric(4, 1) NOT NULL,
    status               varchar(10)  NOT NULL DEFAULT 'DRAFT',
    -- Bản tham số đã dùng để tính (giữ lại để đối chiếu về sau)
    params_id            uuid REFERENCES payroll_params (id),
    calculated_at        timestamptz,
    approved_by          uuid REFERENCES users (id),
    approved_at          timestamptz,
    paid_at              timestamptz,
    note                 varchar(500),
    created_at           timestamptz  NOT NULL DEFAULT now(),
    updated_at           timestamptz  NOT NULL DEFAULT now(),
    created_by           uuid REFERENCES users (id),
    CONSTRAINT payroll_periods_status CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
    CONSTRAINT payroll_periods_standard CHECK (standard_work_days > 0),
    CONSTRAINT payroll_periods_uq UNIQUE (school_id, month)
);

-- ---------------------------------------------------------------- phiếu lương từng người
-- Lưu đủ các dòng trung gian để màn hình diễn giải được từng bước, không phải tính lại.
CREATE TABLE payroll_records (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id              uuid           NOT NULL REFERENCES schools (id),
    period_id              uuid           NOT NULL REFERENCES payroll_periods (id) ON DELETE CASCADE,
    staff_id               uuid           NOT NULL REFERENCES staff (id),
    -- Công thực tế lấy từ staff_attendance_months của tháng đã khóa
    work_days              numeric(4, 1)  NOT NULL,
    salary_mode            varchar(12)    NOT NULL,
    -- Lương tháng đầy đủ (lương cứng, hoặc hệ số × lương cơ sở)
    contract_salary        numeric(14, 0) NOT NULL,
    coefficient            numeric(6, 3),
    -- contract_salary × work_days / standard_work_days
    salary_by_work         numeric(14, 0) NOT NULL,
    allowances             numeric(14, 0) NOT NULL DEFAULT 0,
    allowances_detail      jsonb          NOT NULL DEFAULT '{}'::jsonb,
    bonus                  numeric(14, 0) NOT NULL DEFAULT 0,
    fines                  numeric(14, 0) NOT NULL DEFAULT 0,
    gross_salary           numeric(14, 0) NOT NULL,
    -- Mức đóng bảo hiểm sau khi áp trần
    insurance_base         numeric(14, 0) NOT NULL DEFAULT 0,
    social_insurance       numeric(14, 0) NOT NULL DEFAULT 0,
    health_insurance       numeric(14, 0) NOT NULL DEFAULT 0,
    unemployment_insurance numeric(14, 0) NOT NULL DEFAULT 0,
    insurance_deduction    numeric(14, 0) NOT NULL DEFAULT 0,
    dependent_count        integer        NOT NULL DEFAULT 0,
    total_deduction        numeric(14, 0) NOT NULL DEFAULT 0,
    -- Thu nhập tính thuế sau giảm trừ (không âm)
    taxable_income         numeric(14, 0) NOT NULL DEFAULT 0,
    pit                    numeric(14, 0) NOT NULL DEFAULT 0,
    net_salary             numeric(14, 0) NOT NULL,
    note                   varchar(500),
    paid_at                timestamptz,
    email_sent_at          timestamptz,
    payslip_file_id        uuid REFERENCES files (id),
    created_at             timestamptz    NOT NULL DEFAULT now(),
    updated_at             timestamptz    NOT NULL DEFAULT now(),
    created_by             uuid REFERENCES users (id),
    CONSTRAINT payroll_records_mode CHECK (salary_mode IN ('FIXED', 'COEFFICIENT')),
    CONSTRAINT payroll_records_uq UNIQUE (period_id, staff_id)
);
CREATE INDEX payroll_records_staff_idx ON payroll_records (staff_id);

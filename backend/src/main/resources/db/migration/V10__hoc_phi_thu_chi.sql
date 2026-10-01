-- Giai đoạn 6 – Học phí & thu chi (thiết kế mục 8).
-- Khoản thu (danh mục chung) → biểu phí theo cơ sở, năm học, khối → phiếu thu tháng sinh hàng loạt cho từng trẻ.
-- Phiếu: Nháp → Đã phát hành → Thu một phần / Đã thu đủ; khi phiếu tháng sau nhận số dư thì phiếu cũ thành
-- Đã chuyển nợ (CARRIED) để nợ không bị đếm hai lần. Thanh toán tự ghi một dòng thu vào sổ thu chi.

-- ---------------------------------------------------------------- khoản thu (danh mục chung toàn chuỗi)
CREATE TABLE fee_types (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                   varchar(30)  NOT NULL UNIQUE,
    name                   varchar(100) NOT NULL,
    -- Theo tháng (học phí) · theo ngày học (tiền ăn) · một lần mỗi năm học · tự chọn (trẻ đăng ký mới thu)
    calc_method            varchar(10)  NOT NULL,
    -- Chỉ áp dụng cho khoản theo ngày: hoàn ngày vắng có phép tháng trước theo quy tắc trong finance_configs
    refundable_on_absence  boolean      NOT NULL DEFAULT false,
    active                 boolean      NOT NULL DEFAULT true,
    order_no               integer      NOT NULL DEFAULT 0,
    created_at             timestamptz  NOT NULL DEFAULT now(),
    updated_at             timestamptz  NOT NULL DEFAULT now(),
    created_by             uuid REFERENCES users (id),
    CONSTRAINT fee_types_method CHECK (calc_method IN ('MONTHLY', 'PER_DAY', 'ONE_TIME', 'OPTIONAL')),
    CONSTRAINT fee_types_refund CHECK (NOT refundable_on_absence OR calc_method = 'PER_DAY')
);

INSERT INTO fee_types (code, name, calc_method, refundable_on_absence, order_no) VALUES
    ('HOC_PHI', 'Học phí', 'MONTHLY', false, 1),
    ('TIEN_AN', 'Tiền ăn', 'PER_DAY', true, 2),
    ('CSVC', 'Cơ sở vật chất', 'ONE_TIME', false, 3),
    ('DONG_PHUC', 'Đồng phục', 'ONE_TIME', false, 4),
    ('NANG_KHIEU', 'Năng khiếu', 'OPTIONAL', false, 5);

-- ---------------------------------------------------------------- biểu phí
-- age_group_id rỗng = áp dụng cho mọi khối của cơ sở (dòng có khối cụ thể được ưu tiên).
-- Chỉ thêm bản mới theo effective_from, không sửa đè (quy tắc 5).
CREATE TABLE fee_schedules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid           NOT NULL REFERENCES schools (id),
    school_year_id  uuid           NOT NULL REFERENCES school_years (id),
    age_group_id    uuid REFERENCES age_groups (id),
    fee_type_id     uuid           NOT NULL REFERENCES fee_types (id),
    -- Theo tháng/một lần/tự chọn: số tiền mỗi lần thu; theo ngày: đơn giá một ngày
    amount          numeric(14, 0) NOT NULL,
    effective_from  date           NOT NULL,
    note            varchar(300),
    created_at      timestamptz    NOT NULL DEFAULT now(),
    updated_at      timestamptz    NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT fee_schedules_amount CHECK (amount >= 0),
    CONSTRAINT fee_schedules_uq UNIQUE NULLS NOT DISTINCT (school_id, school_year_id, age_group_id, fee_type_id,
                                                           effective_from)
);
CREATE INDEX fee_schedules_lookup_idx ON fee_schedules (school_id, school_year_id, fee_type_id);

-- ---------------------------------------------------------------- khoản tự chọn trẻ đăng ký
-- Tháng lưu bằng ngày đầu tháng; to_month rỗng = đến khi hủy đăng ký.
CREATE TABLE child_fee_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid         NOT NULL REFERENCES schools (id),
    child_id     uuid         NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    fee_type_id  uuid         NOT NULL REFERENCES fee_types (id),
    from_month   date         NOT NULL,
    to_month     date,
    note         varchar(300),
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT child_fee_items_months CHECK (to_month IS NULL OR to_month >= from_month),
    CONSTRAINT child_fee_items_first_day CHECK (EXTRACT(DAY FROM from_month) = 1
                                                AND (to_month IS NULL OR EXTRACT(DAY FROM to_month) = 1))
);
CREATE INDEX child_fee_items_child_idx ON child_fee_items (child_id);

-- ---------------------------------------------------------------- miễn giảm theo trẻ, có thời hạn
-- fee_type_id rỗng = giảm trên tổng các khoản thu của tháng. Hoặc theo %, hoặc số tiền cố định; không vượt khoản.
CREATE TABLE child_discounts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid           NOT NULL REFERENCES schools (id),
    child_id     uuid           NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    fee_type_id  uuid REFERENCES fee_types (id),
    percent      numeric(5, 2),
    amount       numeric(14, 0),
    reason       varchar(300)   NOT NULL,
    from_month   date           NOT NULL,
    to_month     date,
    created_at   timestamptz    NOT NULL DEFAULT now(),
    updated_at   timestamptz    NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT child_discounts_value CHECK ((percent IS NULL) <> (amount IS NULL)),
    CONSTRAINT child_discounts_percent CHECK (percent IS NULL OR (percent > 0 AND percent <= 100)),
    CONSTRAINT child_discounts_amount CHECK (amount IS NULL OR amount > 0),
    CONSTRAINT child_discounts_months CHECK (to_month IS NULL OR to_month >= from_month),
    CONSTRAINT child_discounts_first_day CHECK (EXTRACT(DAY FROM from_month) = 1
                                                AND (to_month IS NULL OR EXTRACT(DAY FROM to_month) = 1))
);
CREATE INDEX child_discounts_child_idx ON child_discounts (child_id);

-- ---------------------------------------------------------------- cấu hình tài chính (quy tắc 5)
-- school_id rỗng = mặc định toàn chuỗi; chỉ thêm bản mới theo effective_from.
CREATE TABLE finance_configs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id          uuid REFERENCES schools (id),
    effective_from     date         NOT NULL,
    -- Hoàn tiền ăn ngày vắng có phép tháng trước: chỉ ngày báo trước giờ báo ăn · mọi ngày có phép · không hoàn
    meal_refund_rule   varchar(20)  NOT NULL,
    -- Khoản theo tháng khi nhập/nghỉ giữa tháng: thu đủ tháng · chia theo ngày học
    proration          varchar(20)  NOT NULL,
    -- Hạn nộp: ngày trong tháng của phiếu
    due_day            integer      NOT NULL,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    created_by         uuid REFERENCES users (id),
    CONSTRAINT finance_configs_refund CHECK (meal_refund_rule IN ('BEFORE_CUTOFF', 'ALL_EXCUSED', 'NONE')),
    CONSTRAINT finance_configs_proration CHECK (proration IN ('FULL_MONTH', 'BY_SCHOOL_DAYS')),
    CONSTRAINT finance_configs_due_day CHECK (due_day BETWEEN 1 AND 28),
    CONSTRAINT finance_configs_uq UNIQUE NULLS NOT DISTINCT (school_id, effective_from)
);

-- TODO(assumption): hoàn tiền ăn ngày vắng có phép báo trước giờ báo ăn; chia học phí theo ngày học; hạn nộp ngày 10.
INSERT INTO finance_configs (school_id, effective_from, meal_refund_rule, proration, due_day)
VALUES (NULL, '2020-01-01', 'BEFORE_CUTOFF', 'BY_SCHOOL_DAYS', 10);

-- ---------------------------------------------------------------- phiếu thu
CREATE TABLE invoices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid           NOT NULL REFERENCES schools (id),
    child_id         uuid           NOT NULL REFERENCES children (id),
    -- Lớp của trẻ khi sinh phiếu (để lọc theo lớp)
    class_id         uuid REFERENCES classes (id),
    -- Ngày đầu tháng
    period_month     date           NOT NULL,
    -- Số phiếu đánh theo cơ sở, cấp khi phát hành
    invoice_no       varchar(30),
    -- Tổng các khoản thu · miễn giảm · hoàn tiền ăn (số dương)
    subtotal         numeric(14, 0) NOT NULL DEFAULT 0,
    discount         numeric(14, 0) NOT NULL DEFAULT 0,
    refund           numeric(14, 0) NOT NULL DEFAULT 0,
    -- Số dư phiếu trước chuyển sang: dương = nợ cũ, âm = trả thừa
    carried_balance  numeric(14, 0) NOT NULL DEFAULT 0,
    -- subtotal − discount − refund + carried_balance (âm = còn dư sang tháng sau)
    amount_due       numeric(14, 0) NOT NULL DEFAULT 0,
    amount_paid      numeric(14, 0) NOT NULL DEFAULT 0,
    status           varchar(10)    NOT NULL DEFAULT 'DRAFT',
    due_date         date,
    issued_at        timestamptz,
    issued_by        uuid REFERENCES users (id),
    -- Phiếu tháng sau đã nhận số dư của phiếu này
    carried_to_id    uuid REFERENCES invoices (id),
    cancelled_at     timestamptz,
    cancel_reason    varchar(300),
    note             varchar(500),
    created_at       timestamptz    NOT NULL DEFAULT now(),
    updated_at       timestamptz    NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES users (id),
    deleted_at       timestamptz,
    CONSTRAINT invoices_status CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CARRIED', 'CANCELLED')),
    CONSTRAINT invoices_month CHECK (EXTRACT(DAY FROM period_month) = 1),
    CONSTRAINT invoices_amounts CHECK (subtotal >= 0 AND discount >= 0 AND refund >= 0 AND amount_paid >= 0),
    CONSTRAINT invoices_carried CHECK ((status = 'CARRIED') = (carried_to_id IS NOT NULL)),
    CONSTRAINT invoices_no_uq UNIQUE (school_id, invoice_no)
);
-- Mỗi trẻ một phiếu mỗi tháng (phiếu đã hủy không tính)
CREATE UNIQUE INDEX invoices_child_month_uq ON invoices (child_id, period_month)
    WHERE status <> 'CANCELLED' AND deleted_at IS NULL;
CREATE INDEX invoices_school_month_idx ON invoices (school_id, period_month) WHERE deleted_at IS NULL;

CREATE TABLE invoice_lines (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id   uuid           NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    fee_type_id  uuid REFERENCES fee_types (id),
    -- Khoản thu · hoàn tiền ăn · miễn giảm · số dư phiếu trước
    kind         varchar(10)    NOT NULL,
    description  varchar(200)   NOT NULL,
    quantity     numeric(8, 2)  NOT NULL DEFAULT 1,
    unit_price   numeric(14, 0) NOT NULL DEFAULT 0,
    -- Có dấu: hoàn tiền và miễn giảm là số âm
    amount       numeric(14, 0) NOT NULL,
    note         varchar(300),
    order_no     integer        NOT NULL DEFAULT 0,
    created_at   timestamptz    NOT NULL DEFAULT now(),
    updated_at   timestamptz    NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT invoice_lines_kind CHECK (kind IN ('CHARGE', 'REFUND', 'DISCOUNT', 'CARRIED')),
    CONSTRAINT invoice_lines_sign CHECK ((kind = 'CHARGE' AND amount >= 0) OR (kind IN ('REFUND', 'DISCOUNT') AND amount <= 0)
                                         OR kind = 'CARRIED')
);
CREATE INDEX invoice_lines_invoice_idx ON invoice_lines (invoice_id);

-- ---------------------------------------------------------------- thanh toán (nhiều lần cho một phiếu)
-- Không xóa: hủy bằng voided_at (kèm lý do) để giữ dấu vết.
CREATE TABLE payments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid           NOT NULL REFERENCES schools (id),
    invoice_id   uuid           NOT NULL REFERENCES invoices (id),
    amount       numeric(14, 0) NOT NULL,
    method       varchar(10)    NOT NULL,
    paid_on      date           NOT NULL,
    reference    varchar(100),
    note         varchar(300),
    file_id      uuid REFERENCES files (id),
    received_by  uuid REFERENCES users (id),
    voided_at    timestamptz,
    voided_by    uuid REFERENCES users (id),
    void_reason  varchar(300),
    created_at   timestamptz    NOT NULL DEFAULT now(),
    updated_at   timestamptz    NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT payments_amount CHECK (amount > 0),
    CONSTRAINT payments_method CHECK (method IN ('CASH', 'TRANSFER'))
);
CREATE INDEX payments_invoice_idx ON payments (invoice_id);

-- ---------------------------------------------------------------- sổ thu chi
-- school_id rỗng = danh mục dùng chung; system_code đánh dấu danh mục dòng tự sinh (học phí, lương).
CREATE TABLE cash_categories (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid REFERENCES schools (id),
    direction    varchar(3)   NOT NULL,
    name         varchar(100) NOT NULL,
    system_code  varchar(20) UNIQUE,
    active       boolean      NOT NULL DEFAULT true,
    order_no     integer      NOT NULL DEFAULT 0,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT cash_categories_direction CHECK (direction IN ('IN', 'OUT')),
    CONSTRAINT cash_categories_name_uq UNIQUE NULLS NOT DISTINCT (school_id, direction, name)
);

INSERT INTO cash_categories (direction, name, system_code, order_no) VALUES
    ('IN', 'Thu học phí', 'TUITION', 1),
    ('IN', 'Thu khác', NULL, 2),
    ('OUT', 'Thực phẩm', NULL, 1),
    ('OUT', 'Điện nước', NULL, 2),
    ('OUT', 'Sửa chữa', NULL, 3),
    ('OUT', 'Văn phòng phẩm', NULL, 4),
    ('OUT', 'Lương', 'PAYROLL', 5),
    ('OUT', 'Chi khác', NULL, 6);

CREATE TABLE cash_entries (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid           NOT NULL REFERENCES schools (id),
    category_id  uuid           NOT NULL REFERENCES cash_categories (id),
    direction    varchar(3)     NOT NULL,
    amount       numeric(14, 0) NOT NULL,
    entry_date   date           NOT NULL,
    description  varchar(300)   NOT NULL,
    -- Nhập tay · tự sinh từ thanh toán học phí · tự sinh từ lương đã trả (dòng tự sinh không sửa tay được)
    source       varchar(10)    NOT NULL DEFAULT 'MANUAL',
    source_id    uuid,
    file_id      uuid REFERENCES files (id),
    created_at   timestamptz    NOT NULL DEFAULT now(),
    updated_at   timestamptz    NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT cash_entries_direction CHECK (direction IN ('IN', 'OUT')),
    CONSTRAINT cash_entries_amount CHECK (amount > 0),
    CONSTRAINT cash_entries_source CHECK (source IN ('MANUAL', 'PAYMENT', 'PAYROLL')),
    CONSTRAINT cash_entries_source_id CHECK ((source = 'MANUAL') = (source_id IS NULL))
);
CREATE UNIQUE INDEX cash_entries_source_uq ON cash_entries (source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX cash_entries_school_date_idx ON cash_entries (school_id, entry_date);

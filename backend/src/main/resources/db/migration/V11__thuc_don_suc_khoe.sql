-- Giai đoạn 7 – Thực đơn & sức khỏe trẻ (thiết kế mục 9).
-- Món ăn (chung chuỗi hoặc riêng cơ sở) → thực đơn tuần theo cơ sở và khối → món theo ngày và bữa.
-- Cân đo xếp kênh theo chuẩn WHO (bảng LMS nạp ở V12); khám định kỳ; sổ theo dõi sức khỏe hằng ngày.

-- ---------------------------------------------------------------- món ăn
-- school_id rỗng = món dùng chung toàn chuỗi. Dinh dưỡng tính cho một suất.
CREATE TABLE dishes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid REFERENCES schools (id),
    name         varchar(150) NOT NULL,
    -- [{"name": "Thịt lợn", "grams": 30}, …]
    ingredients  jsonb        NOT NULL DEFAULT '[]'::jsonb,
    kcal         numeric(7, 1),
    protein_g    numeric(6, 1),
    fat_g        numeric(6, 1),
    carb_g       numeric(6, 1),
    active       boolean      NOT NULL DEFAULT true,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES users (id),
    CONSTRAINT dishes_ingredients CHECK (jsonb_typeof(ingredients) = 'array'),
    CONSTRAINT dishes_nutrition CHECK ((kcal IS NULL OR kcal >= 0) AND (protein_g IS NULL OR protein_g >= 0)
                                       AND (fat_g IS NULL OR fat_g >= 0) AND (carb_g IS NULL OR carb_g >= 0)),
    CONSTRAINT dishes_name_uq UNIQUE NULLS NOT DISTINCT (school_id, name)
);

-- ---------------------------------------------------------------- thực đơn tuần
-- age_group_id rỗng = áp dụng mọi khối của cơ sở (thực đơn có khối cụ thể được ưu tiên). week_start là thứ Hai.
CREATE TABLE menus (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES schools (id),
    age_group_id  uuid REFERENCES age_groups (id),
    week_start    date        NOT NULL,
    status        varchar(20) NOT NULL DEFAULT 'DRAFT',
    note          varchar(500),
    published_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES users (id),
    CONSTRAINT menus_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT menus_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1),
    CONSTRAINT menus_uq UNIQUE NULLS NOT DISTINCT (school_id, age_group_id, week_start)
);

-- Bữa: sáng · trưa · chiều · phụ
CREATE TABLE menu_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid        NOT NULL REFERENCES schools (id),
    menu_id     uuid        NOT NULL REFERENCES menus (id) ON DELETE CASCADE,
    menu_date   date        NOT NULL,
    meal        varchar(20) NOT NULL,
    dish_id     uuid        NOT NULL REFERENCES dishes (id),
    order_no    integer     NOT NULL DEFAULT 0,
    note        varchar(300),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT menu_items_meal CHECK (meal IN ('BREAKFAST', 'LUNCH', 'AFTERNOON', 'SNACK')),
    CONSTRAINT menu_items_uq UNIQUE (menu_id, menu_date, meal, dish_id)
);
CREATE INDEX menu_items_menu_idx ON menu_items (menu_id, menu_date);
CREATE INDEX menu_items_dish_idx ON menu_items (dish_id);

-- ---------------------------------------------------------------- chuẩn tăng trưởng WHO
-- Bảng LMS chính thức: WHO 2006 (0–1826 ngày tuổi, theo ngày) và WHO 2007 (60–96 tháng, theo tháng, nội suy giữa hai tháng).
-- Z = ((X/M)^L − 1)/(L·S); các mốc −3…+3 SD suy ra từ L, M, S nên không lưu riêng.
CREATE TABLE who_growth_standards (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Cân nặng/tuổi · chiều cao/tuổi · BMI/tuổi
    indicator   varchar(10)    NOT NULL,
    gender      varchar(10)    NOT NULL,
    age_unit    varchar(10)    NOT NULL,
    age         integer        NOT NULL,
    l           numeric(10, 6) NOT NULL,
    m           numeric(10, 4) NOT NULL,
    s           numeric(10, 6) NOT NULL,
    source      varchar(20)    NOT NULL,
    created_at  timestamptz    NOT NULL DEFAULT now(),
    updated_at  timestamptz    NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT who_growth_indicator CHECK (indicator IN ('WFA', 'HFA', 'BFA')),
    CONSTRAINT who_growth_gender CHECK (gender IN ('MALE', 'FEMALE')),
    CONSTRAINT who_growth_unit CHECK (age_unit IN ('DAY', 'MONTH')),
    CONSTRAINT who_growth_source CHECK (source IN ('WHO_2006', 'WHO_2007')),
    CONSTRAINT who_growth_uq UNIQUE (indicator, gender, age_unit, age)
);

-- ---------------------------------------------------------------- cân đo
-- Kết quả xếp kênh lưu lại tại thời điểm cân đo; nguồn: giáo viên nhập theo lớp · khám định kỳ · phụ huynh báo.
CREATE TABLE growth_measurements (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid          NOT NULL REFERENCES schools (id),
    child_id       uuid          NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    class_id       uuid REFERENCES classes (id),
    measured_on    date          NOT NULL,
    weight_kg      numeric(5, 2) NOT NULL,
    height_cm      numeric(5, 1) NOT NULL,
    age_days       integer       NOT NULL,
    age_months     numeric(5, 2) NOT NULL,
    bmi            numeric(5, 2) NOT NULL,
    weight_z       numeric(5, 2),
    height_z       numeric(5, 2),
    bmi_z          numeric(5, 2),
    weight_status  varchar(30),
    height_status  varchar(30),
    bmi_status     varchar(30),
    standard       varchar(20),
    source         varchar(20)   NOT NULL,
    note           varchar(300),
    recorded_by    uuid REFERENCES users (id),
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    created_by     uuid REFERENCES users (id),
    CONSTRAINT growth_measurements_values CHECK (weight_kg > 0 AND weight_kg < 100 AND height_cm > 30
                                                 AND height_cm < 200 AND age_days >= 0),
    CONSTRAINT growth_measurements_source CHECK (source IN ('CLASS', 'CHECKUP', 'PARENT')),
    CONSTRAINT growth_measurements_standard CHECK (standard IS NULL OR standard IN ('WHO_2006', 'WHO_2007')),
    CONSTRAINT growth_measurements_weight_status CHECK (weight_status IS NULL OR weight_status IN
        ('SEVERE_UNDERWEIGHT', 'UNDERWEIGHT', 'NORMAL', 'ABOVE_NORMAL')),
    CONSTRAINT growth_measurements_height_status CHECK (height_status IS NULL OR height_status IN
        ('SEVERE_STUNTED', 'STUNTED', 'NORMAL', 'TALL')),
    CONSTRAINT growth_measurements_bmi_status CHECK (bmi_status IS NULL OR bmi_status IN
        ('SEVERE_WASTED', 'WASTED', 'NORMAL', 'OVERWEIGHT_RISK', 'OVERWEIGHT', 'OBESE')),
    CONSTRAINT growth_measurements_uq UNIQUE (child_id, measured_on)
);
CREATE INDEX growth_measurements_school_date_idx ON growth_measurements (school_id, measured_on);

-- ---------------------------------------------------------------- khám sức khỏe định kỳ
CREATE TABLE health_checkups (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid          NOT NULL REFERENCES schools (id),
    child_id      uuid          NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    checkup_date  date          NOT NULL,
    provider      varchar(200),
    summary       varchar(2000) NOT NULL,
    file_id       uuid REFERENCES files (id),
    created_at    timestamptz   NOT NULL DEFAULT now(),
    updated_at    timestamptz   NOT NULL DEFAULT now(),
    created_by    uuid REFERENCES users (id)
);
CREATE INDEX health_checkups_child_idx ON health_checkups (child_id, checkup_date);

-- ---------------------------------------------------------------- sổ theo dõi hằng ngày
-- Sốt · dặn thuốc · sự cố nhỏ · khác; "đã báo phụ huynh" lưu thời điểm và người báo.
CREATE TABLE health_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid          NOT NULL REFERENCES schools (id),
    child_id            uuid          NOT NULL REFERENCES children (id) ON DELETE CASCADE,
    class_id            uuid REFERENCES classes (id),
    log_date            date          NOT NULL,
    type                varchar(20)   NOT NULL,
    content             varchar(2000) NOT NULL,
    temperature_c       numeric(3, 1),
    parent_notified_at  timestamptz,
    parent_notified_by  uuid REFERENCES users (id),
    recorded_by         uuid REFERENCES users (id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    created_by          uuid REFERENCES users (id),
    CONSTRAINT health_logs_type CHECK (type IN ('FEVER', 'MEDICINE', 'INCIDENT', 'OTHER')),
    CONSTRAINT health_logs_temperature CHECK (temperature_c IS NULL OR (temperature_c BETWEEN 34 AND 43))
);
CREATE INDEX health_logs_school_date_idx ON health_logs (school_id, log_date);
CREATE INDEX health_logs_child_idx ON health_logs (child_id, log_date);

-- Danh mục loại giấy tờ của trẻ (hồ sơ trẻ, giai đoạn 5)
INSERT INTO document_types (code, name, scope, category, has_expiry, sort_order) VALUES
    ('TRE_GIAY_KHAI_SINH',   'Giấy khai sinh',                 'CHILD', 'IDENTITY',  false, 10),
    ('TRE_THE_BHYT',         'Thẻ BHYT',                       'CHILD', 'INSURANCE', true,  20),
    ('TRE_SO_TIEM_CHUNG',    'Sổ tiêm chủng',                  'CHILD', 'HEALTH',    false, 30),
    ('TRE_GIAY_KHAM_SK',     'Giấy khám sức khỏe',             'CHILD', 'HEALTH',    true,  31),
    ('TRE_DON_NHAP_HOC',     'Đơn xin nhập học',               'CHILD', 'EDUCATION', false, 40),
    ('TRE_GIAY_CHUYEN_TRUONG', 'Giấy chuyển trường',           'CHILD', 'EDUCATION', false, 41),
    ('TRE_KHAC',             'Giấy tờ khác',                   'CHILD', 'OTHER',     false, 90);

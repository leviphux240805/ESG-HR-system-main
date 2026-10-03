-- Dữ liệu thật (không phải seed dev): Trường MN Phan Bội Châu và 2 phân hiệu, Phường Hồng Bàng, TP Hải Phòng.
-- Mã địa chỉ theo frontend/public/addressData.json: TP Hải Phòng = 31, Phường Hồng Bàng = 11311.
-- TODO(assumption): trường thuộc một tổ chức riêng "Trường MN Phan Bội Châu" (chép danh mục mặc định bằng
-- provision_organization). Tài khoản hiệu trưởng do bên vận hành tạo rồi gán PRINCIPAL ở cả 3 trường.
SELECT provision_organization('7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001', 'Trường MN Phan Bội Châu');

INSERT INTO schools (id, organization_id, code, name, type, parent_id, province_code, ward_code, address_detail) VALUES
    ('7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000101', '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001', 'PBC',
     'Trường MN Phan Bội Châu', 'MAIN', NULL, '31', '11311', '85 Quang Trung');
INSERT INTO schools (id, organization_id, code, name, type, parent_id, province_code, ward_code, address_detail) VALUES
    ('7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000102', '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001', 'PBC-PH1',
     'Trường MN Phan Bội Châu – Phân hiệu 1', 'BRANCH', '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000101', '31', '11311', '134 Hạ Lý'),
    ('7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000103', '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001', 'PBC-PH2',
     'Trường MN Phan Bội Châu – Phân hiệu 2', 'BRANCH', '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000101', '31', '11311', '191 Phan Bội Châu');

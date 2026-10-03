-- Trường chính (MAIN) và phân hiệu (BRANCH): phân hiệu thuộc một trường chính cùng tổ chức, chỉ một cấp.
-- Phân hiệu vẫn là trường riêng về dữ liệu và quyền; quan hệ chỉ dùng để hiển thị lồng nhau.
ALTER TABLE schools ADD COLUMN type varchar(10) NOT NULL DEFAULT 'MAIN';
ALTER TABLE schools ADD COLUMN parent_id uuid REFERENCES schools (id);
ALTER TABLE schools ADD CONSTRAINT schools_type CHECK (type IN ('MAIN', 'BRANCH'));
ALTER TABLE schools ADD CONSTRAINT schools_parent CHECK ((type = 'BRANCH') = (parent_id IS NOT NULL) AND parent_id <> id);
CREATE INDEX schools_parent_idx ON schools (parent_id);

-- Trường cha phải là trường chính cùng tổ chức (ràng buộc giữa hai dòng nên dùng trigger)
CREATE FUNCTION schools_check_parent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM schools p
        WHERE p.id = NEW.parent_id AND p.type = 'MAIN' AND p.organization_id = NEW.organization_id) THEN
        RAISE EXCEPTION 'Trường chính của phân hiệu phải là trường chính cùng tổ chức' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.type = 'BRANCH' AND EXISTS (SELECT 1 FROM schools c WHERE c.parent_id = NEW.id) THEN
        RAISE EXCEPTION 'Trường đang có phân hiệu không chuyển thành phân hiệu được' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER schools_check_parent BEFORE INSERT OR UPDATE OF type, parent_id, organization_id ON schools
    FOR EACH ROW EXECUTE FUNCTION schools_check_parent();

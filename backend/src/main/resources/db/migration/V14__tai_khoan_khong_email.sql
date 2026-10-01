-- Tạm không dùng email: tài khoản đăng nhập bằng email hoặc số điện thoại; mật khẩu do người tạo đặt,
-- người dùng phải đổi ở lần đăng nhập kế tiếp.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_login_required CHECK (email IS NOT NULL OR phone IS NOT NULL);
ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

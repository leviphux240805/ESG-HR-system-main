-- Quên mật khẩu: link đặt lại dùng một lần, chỉ lưu SHA-256 của token.
CREATE TABLE password_reset_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash      varchar(64)  NOT NULL,
    expires_at      timestamptz  NOT NULL,
    used_at         timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id)
);
CREATE UNIQUE INDEX password_reset_tokens_hash_uq ON password_reset_tokens (token_hash);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id, created_at DESC);

-- Bình luận công việc đính kèm nhiều file (tối đa 10). Cột task_comments.file_id giữ lại cho dữ liệu cũ, đã chép sang đây.
CREATE TABLE task_comment_files (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid        NOT NULL REFERENCES organizations (id),
    school_id        uuid REFERENCES schools (id),
    comment_id       uuid        NOT NULL REFERENCES task_comments (id) ON DELETE CASCADE,
    file_id          uuid        NOT NULL REFERENCES files (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES users (id),
    CONSTRAINT task_comment_files_uq UNIQUE (comment_id, file_id)
);
CREATE INDEX task_comment_files_organization_idx ON task_comment_files (organization_id);

INSERT INTO task_comment_files (organization_id, school_id, comment_id, file_id, created_at, created_by)
SELECT organization_id, school_id, id, file_id, created_at, created_by FROM task_comments WHERE file_id IS NOT NULL;

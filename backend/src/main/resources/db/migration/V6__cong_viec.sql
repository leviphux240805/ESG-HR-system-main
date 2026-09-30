-- Giai đoạn 3 – Công việc: giao việc (một hoặc nhiều người), checklist, bình luận, đính kèm, việc lặp lại.
-- school_id rỗng = việc của toàn chuỗi (văn phòng điều hành giao). Bảng con mang school_id của việc (quy tắc 1).

CREATE TABLE tasks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid REFERENCES schools (id),
    title            varchar(300) NOT NULL,
    description      text,
    priority         varchar(10)  NOT NULL DEFAULT 'MEDIUM',
    status           varchar(20)  NOT NULL DEFAULT 'NEW',
    due_at           timestamptz,
    completed_at     timestamptz,
    -- Việc lặp lại: dòng mẫu có recurrence_rule (không hiện trên bảng việc); bản việc sinh ra có parent_id = mẫu
    parent_id        uuid REFERENCES tasks (id),
    recurrence_rule  varchar(200),
    occurrence_date  date,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES users (id),   -- người giao
    CONSTRAINT tasks_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT tasks_status CHECK (status IN ('NEW', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DONE', 'CANCELLED')),
    CONSTRAINT tasks_template CHECK (recurrence_rule IS NULL OR parent_id IS NULL),
    CONSTRAINT tasks_occurrence CHECK ((parent_id IS NULL) = (occurrence_date IS NULL))
);
CREATE INDEX tasks_school_status_idx ON tasks (school_id, status);
CREATE INDEX tasks_due_idx ON tasks (due_at) WHERE status NOT IN ('DONE', 'CANCELLED');
-- Mỗi mẫu sinh tối đa một bản việc cho một ngày (job chạy lại không trùng)
CREATE UNIQUE INDEX tasks_occurrence_uq ON tasks (parent_id, occurrence_date) WHERE parent_id IS NOT NULL;

CREATE TABLE task_assignees (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid REFERENCES schools (id),
    task_id     uuid         NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    staff_id    uuid         NOT NULL REFERENCES staff (id),
    status      varchar(10)  NOT NULL DEFAULT 'OPEN',
    done_at     timestamptz,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT task_assignees_uq UNIQUE (task_id, staff_id),
    CONSTRAINT task_assignees_status CHECK (status IN ('OPEN', 'DONE'))
);
CREATE INDEX task_assignees_staff_idx ON task_assignees (staff_id);

CREATE TABLE task_checklist_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid REFERENCES schools (id),
    task_id     uuid         NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    content     varchar(500) NOT NULL,
    is_done     boolean      NOT NULL DEFAULT false,
    order_no    integer      NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id)
);
CREATE INDEX task_checklist_items_task_idx ON task_checklist_items (task_id, order_no);

CREATE TABLE task_comments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid REFERENCES schools (id),
    task_id     uuid         NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id     uuid         NOT NULL REFERENCES users (id),
    body        text         NOT NULL,
    file_id     uuid REFERENCES files (id),
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id)
);
CREATE INDEX task_comments_task_idx ON task_comments (task_id, created_at);

CREATE TABLE task_attachments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid REFERENCES schools (id),
    task_id     uuid         NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    file_id     uuid         NOT NULL REFERENCES files (id),
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users (id),
    CONSTRAINT task_attachments_uq UNIQUE (task_id, file_id)
);

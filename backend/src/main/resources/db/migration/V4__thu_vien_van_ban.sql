-- Giai đoạn 2 – Tài liệu: thư viện văn bản của chuỗi/cơ sở (thư mục, văn bản, phiên bản, xác nhận đã đọc).

-- ---------------------------------------------------------------- doc_folders
-- school_id rỗng = thư mục dùng chung toàn chuỗi. Thư mục con cùng cơ sở với thư mục cha.
CREATE TABLE doc_folders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid REFERENCES schools (id),
    parent_id       uuid REFERENCES doc_folders (id),
    name            varchar(200) NOT NULL,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT doc_folders_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX doc_folders_parent_idx ON doc_folders (parent_id);
CREATE INDEX doc_folders_school_idx ON doc_folders (school_id);
-- Không trùng tên trong cùng thư mục cha (cùng cơ sở)
CREATE UNIQUE INDEX doc_folders_name_uq ON doc_folders (school_id, parent_id, lower(name)) NULLS NOT DISTINCT;

-- ---------------------------------------------------------------- library_documents
-- Phạm vi xem = school_id (rỗng = toàn chuỗi) + visible_roles (rỗng = mọi vai trò).
-- ack_version_no: phiên bản mà người đọc phải xác nhận (phiên bản mới có thể yêu cầu xác nhận lại).
CREATE TABLE library_documents (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid REFERENCES schools (id),
    folder_id           uuid REFERENCES doc_folders (id),
    title               varchar(300) NOT NULL,
    doc_number          varchar(50),
    issued_date         date,
    effective_to        date,
    visible_roles       varchar(20)[] NOT NULL DEFAULT '{}',
    require_ack         boolean      NOT NULL DEFAULT false,
    ack_version_no      integer,
    current_version_no  integer      NOT NULL DEFAULT 1,
    last_reminded_at    timestamptz,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    created_by          uuid REFERENCES users (id),
    CONSTRAINT library_documents_dates CHECK (effective_to IS NULL OR issued_date IS NULL OR effective_to >= issued_date),
    CONSTRAINT library_documents_ack CHECK (NOT require_ack OR ack_version_no IS NOT NULL),
    CONSTRAINT library_documents_ack_version CHECK (ack_version_no IS NULL OR ack_version_no BETWEEN 1 AND current_version_no),
    CONSTRAINT library_documents_roles CHECK (visible_roles <@ ARRAY
        ['OWNER', 'CHAIN_ADMIN', 'ACCOUNTANT', 'PRINCIPAL', 'TEACHER', 'NURSE', 'KITCHEN', 'STAFF']::varchar(20)[])
);
CREATE INDEX library_documents_folder_idx ON library_documents (folder_id);
CREATE INDEX library_documents_school_idx ON library_documents (school_id);

-- ---------------------------------------------------------------- library_document_versions
CREATE TABLE library_document_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid         NOT NULL REFERENCES library_documents (id) ON DELETE CASCADE,
    version_no      integer      NOT NULL,
    file_id         uuid         NOT NULL REFERENCES files (id),
    note            varchar(500),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users (id),
    CONSTRAINT library_document_versions_no CHECK (version_no >= 1),
    CONSTRAINT library_document_versions_uq UNIQUE (document_id, version_no)
);

-- ---------------------------------------------------------------- document_acks
-- Người xác nhận là nhân viên (tài khoản gắn hồ sơ); mỗi phiên bản xác nhận một lần.
CREATE TABLE document_acks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id      uuid         NOT NULL REFERENCES library_documents (id) ON DELETE CASCADE,
    staff_id         uuid         NOT NULL REFERENCES staff (id),
    version_no       integer      NOT NULL,
    acknowledged_at  timestamptz  NOT NULL DEFAULT now(),
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES users (id),
    CONSTRAINT document_acks_uq UNIQUE (document_id, staff_id, version_no)
);
CREATE INDEX document_acks_staff_idx ON document_acks (staff_id);

BEGIN;

DO $purge$
DECLARE
    sample_organization_ids uuid[] := ARRAY[
        '00000000-0000-0000-0000-0000000000f0'::uuid,
        '00000000-0000-0000-0000-0000000000f2'::uuid
    ];
    pbc_organization_id uuid := '7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001';
    sample_school_ids uuid[];
    base_table record;
    target_table record;
    table_info record;
    foreign_key record;
    condition_sql text;
    blocker_sql text;
    changed integer;
    added integer;
    deleted_rows bigint := 0;
    remaining_rows bigint;
    removed_this_pass bigint;
BEGIN
    IF (
        SELECT count(*)
        FROM schools
        WHERE organization_id = pbc_organization_id
          AND code IN ('PBC', 'PBC-PH1', 'PBC-PH2')
    ) <> 3 THEN
        RAISE EXCEPTION 'Không đủ ba trường PBC; dừng để bảo toàn dữ liệu.';
    END IF;

    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO sample_school_ids
    FROM schools
    WHERE organization_id = ANY(sample_organization_ids);

    CREATE TEMP TABLE purge_sample_row_ids (
        table_oid oid NOT NULL,
        row_id uuid NOT NULL,
        PRIMARY KEY (table_oid, row_id)
    ) ON COMMIT DROP;

    FOR base_table IN
        SELECT n.nspname, c.relname, c.oid,
               bool_or(a.attname = 'organization_id') AS has_organization_id,
               bool_or(a.attname = 'school_id') AS has_school_id
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = current_schema()
          AND c.relkind = 'r'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attname IN ('id', 'organization_id', 'school_id')
          AND a.atttypid = 'uuid'::regtype
        GROUP BY n.nspname, c.relname, c.oid
        HAVING bool_or(a.attname = 'id')
           AND (bool_or(a.attname IN ('organization_id', 'school_id')) OR c.relname = 'organizations')
    LOOP
        condition_sql := '';
        IF base_table.has_organization_id THEN
            condition_sql := 'x.organization_id = ANY($1)';
        END IF;
        IF base_table.has_school_id THEN
            IF condition_sql <> '' THEN
                condition_sql := condition_sql || ' OR ';
            END IF;
            condition_sql := condition_sql || 'x.school_id = ANY($2)';
        END IF;
        IF base_table.relname = 'organizations' THEN
            IF condition_sql <> '' THEN
                condition_sql := condition_sql || ' OR ';
            END IF;
            condition_sql := condition_sql || 'x.id = ANY($1)';
        END IF;

        EXECUTE format(
            'INSERT INTO pg_temp.purge_sample_row_ids (table_oid, row_id) SELECT %s, x.id FROM %I.%I x WHERE (%s) ON CONFLICT DO NOTHING',
            base_table.oid, base_table.nspname, base_table.relname, condition_sql
        ) USING sample_organization_ids, sample_school_ids;
    END LOOP;

    LOOP
        added := 0;
        FOR foreign_key IN
            SELECT child.oid AS child_oid, child_ns.nspname AS child_schema,
                   child.relname AS child_table, child_fk.attname AS child_column,
                   parent.oid AS parent_oid
            FROM pg_constraint fk
            JOIN pg_class child ON child.oid = fk.conrelid
            JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
            JOIN pg_class parent ON parent.oid = fk.confrelid
            JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
            JOIN pg_attribute child_fk ON child_fk.attrelid = child.oid AND child_fk.attnum = fk.conkey[1]
            JOIN pg_attribute parent_pk ON parent_pk.attrelid = parent.oid AND parent_pk.attnum = fk.confkey[1]
            JOIN pg_attribute child_id ON child_id.attrelid = child.oid AND child_id.attname = 'id'
                AND child_id.atttypid = 'uuid'::regtype AND NOT child_id.attisdropped
            WHERE fk.contype = 'f'
              AND cardinality(fk.conkey) = 1
              AND cardinality(fk.confkey) = 1
              AND child_ns.nspname = current_schema()
              AND parent_ns.nspname = current_schema()
              AND parent_pk.attname = 'id'
              AND parent_pk.atttypid = 'uuid'::regtype
              AND child_fk.attname <> 'created_by'
                            AND NOT EXISTS (
                                    SELECT 1
                                    FROM pg_attribute ownership_scope
                                    WHERE ownership_scope.attrelid = child.oid
                                        AND ownership_scope.attnum > 0
                                        AND NOT ownership_scope.attisdropped
                                        AND ownership_scope.attname IN ('school_id', 'organization_id')
                            )
        LOOP
            EXECUTE format(
                'INSERT INTO pg_temp.purge_sample_row_ids (table_oid, row_id) SELECT %s, child.id FROM %I.%I child WHERE EXISTS (SELECT 1 FROM pg_temp.purge_sample_row_ids parent_ids WHERE parent_ids.table_oid = %s AND parent_ids.row_id = child.%I) ON CONFLICT DO NOTHING',
                foreign_key.child_oid, foreign_key.child_schema, foreign_key.child_table,
                foreign_key.parent_oid, foreign_key.child_column
            );
            GET DIAGNOSTICS changed = ROW_COUNT;
            added := added + changed;
        END LOOP;
        EXIT WHEN added = 0;
    END LOOP;

    UPDATE users u
    SET staff_id = NULL
    WHERE u.id IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = 'users'::regclass::oid)
       OR u.staff_id IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = 'staff'::regclass::oid);

    UPDATE users u
    SET guardian_id = NULL
    WHERE u.id IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = 'users'::regclass::oid)
       OR u.guardian_id IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = 'guardians'::regclass::oid);

    UPDATE guardians g
    SET user_id = NULL
    WHERE g.user_id IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = 'users'::regclass::oid);

    UPDATE audit_logs a
    SET user_id = NULL
    WHERE a.user_id IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = 'users'::regclass::oid);

    FOR base_table IN
        SELECT c.oid, n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute id_col ON id_col.attrelid = c.oid AND id_col.attname = 'id'
            AND id_col.atttypid = 'uuid'::regtype AND NOT id_col.attisdropped
        JOIN pg_attribute creator_col ON creator_col.attrelid = c.oid AND creator_col.attname = 'created_by'
            AND NOT creator_col.attisdropped AND NOT creator_col.attnotnull
        WHERE n.nspname = current_schema() AND c.relkind = 'r'
    LOOP
        EXECUTE format(
            'UPDATE %I.%I SET created_by = NULL WHERE created_by IN (SELECT row_id FROM pg_temp.purge_sample_row_ids WHERE table_oid = %s)',
            base_table.nspname, base_table.relname, 'users'::regclass::oid
        );
    END LOOP;

    LOOP
        SELECT count(*) INTO remaining_rows FROM pg_temp.purge_sample_row_ids doomed
        JOIN pg_class c ON c.oid = doomed.table_oid;
        EXIT WHEN remaining_rows = 0;

        removed_this_pass := 0;
        FOR target_table IN SELECT DISTINCT table_oid FROM pg_temp.purge_sample_row_ids LOOP
            SELECT n.nspname, c.relname
            INTO STRICT table_info
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.oid = target_table.table_oid;

            blocker_sql := '';
            FOR foreign_key IN
                SELECT child.oid AS child_oid, child_ns.nspname AS child_schema,
                       child.relname AS child_table, child_fk.attname AS child_column
                FROM pg_constraint fk
                JOIN pg_class child ON child.oid = fk.conrelid
                JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
                JOIN pg_attribute child_fk ON child_fk.attrelid = child.oid AND child_fk.attnum = fk.conkey[1]
                JOIN pg_attribute parent_pk ON parent_pk.attrelid = fk.confrelid AND parent_pk.attnum = fk.confkey[1]
                WHERE fk.contype = 'f'
                  AND cardinality(fk.conkey) = 1
                  AND cardinality(fk.confkey) = 1
                  AND fk.confrelid = target_table.table_oid
                  AND child_ns.nspname = current_schema()
                  AND parent_pk.attname = 'id'
            LOOP
                blocker_sql := blocker_sql || format(
                    ' AND NOT EXISTS (SELECT 1 FROM %I.%I child WHERE child.%I = parent.id)',
                    foreign_key.child_schema, foreign_key.child_table, foreign_key.child_column
                );
            END LOOP;

            EXECUTE format(
                'DELETE FROM %I.%I parent USING pg_temp.purge_sample_row_ids doomed WHERE doomed.table_oid = %s AND doomed.row_id = parent.id%s',
                table_info.nspname, table_info.relname, target_table.table_oid, blocker_sql
            );
            GET DIAGNOSTICS changed = ROW_COUNT;
            removed_this_pass := removed_this_pass + changed;
            EXECUTE format(
                'DELETE FROM pg_temp.purge_sample_row_ids doomed WHERE doomed.table_oid = %s AND NOT EXISTS (SELECT 1 FROM %I.%I existing WHERE existing.id = doomed.row_id)',
                target_table.table_oid, table_info.nspname, table_info.relname
            );
        END LOOP;

        deleted_rows := deleted_rows + removed_this_pass;
        SELECT count(*) INTO remaining_rows FROM pg_temp.purge_sample_row_ids doomed
        JOIN pg_class c ON c.oid = doomed.table_oid;
        IF remaining_rows > 0 AND removed_this_pass = 0 THEN
            RAISE EXCEPTION 'Không thể xóa hết dữ liệu mẫu do còn khóa ngoại tham chiếu; transaction đã hủy.';
        END IF;
    END LOOP;

    IF (
        SELECT count(*)
        FROM schools
        WHERE organization_id = pbc_organization_id
          AND code IN ('PBC', 'PBC-PH1', 'PBC-PH2')
    ) <> 3 THEN
        RAISE EXCEPTION 'Kiểm tra sau xóa thất bại: dữ liệu ba trường PBC phải được giữ nguyên.';
    END IF;

    RAISE NOTICE 'Đã xóa % dòng dữ liệu mẫu; giữ nguyên ba trường PBC.', deleted_rows;
END
$purge$;

COMMIT;
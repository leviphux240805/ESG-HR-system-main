package com.preschool.common.audit;

import java.util.UUID;

import com.preschool.common.audit.AuditLog.Action;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

/**
 * Ghi nhật ký thao tác (ai sửa gì, lúc nào) cho dữ liệu nhạy cảm: hồ sơ nhân viên, lương, học phí, hồ sơ trẻ.
 * Snapshot trước/sau là DTO hoặc Map, lưu JSON. Chạy trong transaction của nghiệp vụ: nghiệp vụ lỗi thì không có log.
 */
@Service
public class AuditService {

	private final AuditLogRepository logs;

	private final JsonMapper jsonMapper;

	public AuditService(AuditLogRepository logs, JsonMapper jsonMapper) {
		this.logs = logs;
		this.jsonMapper = jsonMapper;
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void record(String entity, UUID entityId, Action action, Object before, Object after) {
		UUID userId = SchoolScope.current().map(SchoolScope::userId).orElse(null);
		logs.save(new AuditLog(userId, entity, entityId, action, toJson(before), toJson(after)));
	}

	private String toJson(Object value) {
		return value == null ? null : jsonMapper.writeValueAsString(value);
	}

}

package com.preschool.attendance.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.preschool.attendance.dto.AttendanceDtos.MonthSheet;
import com.preschool.attendance.dto.AttendanceDtos.StaffRow;
import com.preschool.attendance.entity.AttendanceMonthLock;
import com.preschool.attendance.entity.StaffAttendanceMonth;
import com.preschool.attendance.repository.AttendanceMonthLockRepository;
import com.preschool.attendance.repository.StaffAttendanceMonthRepository;
import com.preschool.common.audit.AuditLog.Action;
import com.preschool.common.audit.AuditService;
import com.preschool.common.error.ApiException;
import com.preschool.security.SchoolScope;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khóa công tháng của cơ sở trước khi tính lương: chốt tổng tháng vào {@code staff_attendance_months}; sau đó bảng công
 * chỉ xem. Mở khóa: văn phòng điều hành, bắt buộc lý do (audit).
 */
@Service
public class AttendanceLockService {

	private final AttendanceService attendance;

	private final AttendanceMonthLockRepository locks;

	private final StaffAttendanceMonthRepository months;

	private final AttendanceAccess access;

	private final AuditService audit;

	private final Clock clock;

	public AttendanceLockService(AttendanceService attendance, AttendanceMonthLockRepository locks,
			StaffAttendanceMonthRepository months, AttendanceAccess access, AuditService audit, Clock clock) {
		this.attendance = attendance;
		this.locks = locks;
		this.months = months;
		this.access = access;
		this.audit = audit;
		this.clock = clock;
	}

	@Transactional
	public MonthSheet lock(String monthValue) {
		YearMonth month = AttendanceService.parseMonth(monthValue);
		UUID schoolId = AttendanceService.currentSchool();
		access.requireManage(schoolId);
		if (attendance.isLocked(schoolId, month)) {
			throw ApiException.conflict("ATTENDANCE_MONTH_LOCKED", "Công tháng này đã khóa.");
		}
		MonthSheet sheet = attendance.sheet(monthValue);
		Instant now = Instant.now(clock);
		LocalDate first = month.atDay(1);
		Map<UUID, StaffAttendanceMonth> existing = months.findBySchoolIdAndMonth(schoolId, first)
			.stream()
			.collect(Collectors.toMap(StaffAttendanceMonth::getStaffId, Function.identity()));
		for (StaffRow row : sheet.staff()) {
			StaffAttendanceMonth summary = existing.getOrDefault(row.staffId(),
					new StaffAttendanceMonth(schoolId, row.staffId(), first));
			summary.setTotals(row.totals().totalWork(), row.totals().paidLeave(), row.totals().unpaidLeave(),
					row.totals().holidayLeave(), row.totals().lateCount(), now);
			months.save(summary);
		}
		AttendanceMonthLock lock = locks.save(new AttendanceMonthLock(schoolId, first, now, SchoolScope.require().userId()));
		audit.record("attendance.month", lock.getId(), Action.CREATE, null,
				Map.of("schoolId", schoolId.toString(), "month", month.toString(), "action", "LOCK",
						"staffCount", sheet.staff().size()));
		return attendance.sheet(monthValue);
	}

	@Transactional
	public MonthSheet unlock(String monthValue, String reason) {
		YearMonth month = AttendanceService.parseMonth(monthValue);
		UUID schoolId = AttendanceService.currentSchool();
		access.requireView(schoolId);
		access.requireChainAdmin("Chỉ văn phòng điều hành được mở khóa công tháng.");
		AttendanceMonthLock lock = locks.findBySchoolIdAndMonth(schoolId, month.atDay(1))
			.orElseThrow(() -> ApiException.conflict("ATTENDANCE_MONTH_NOT_LOCKED", "Công tháng này chưa khóa."));
		months.findBySchoolIdAndMonth(schoolId, month.atDay(1)).forEach(StaffAttendanceMonth::unlock);
		audit.record("attendance.month", lock.getId(), Action.DELETE,
				Map.of("month", month.toString(), "lockedAt", lock.getLockedAt().toString()),
				Map.of("schoolId", schoolId.toString(), "month", month.toString(), "action", "UNLOCK",
						"reason", reason.trim()));
		locks.delete(lock);
		locks.flush();
		return attendance.sheet(monthValue);
	}

}

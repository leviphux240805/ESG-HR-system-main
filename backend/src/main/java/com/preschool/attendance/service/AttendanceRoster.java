package com.preschool.attendance.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Nhân viên thuộc bảng công của cơ sở trong tháng: có giai đoạn làm việc ở cơ sở chồng lên tháng (điều chuyển giữa
 * tháng thì mỗi cơ sở chấm phần ngày của mình), chưa nghỉ việc trước tháng. Native SQL, phạm vi cơ sở truyền tường
 * minh; chỉ gọi sau khi đã kiểm tra quyền xem cơ sở.
 */
@Component
public class AttendanceRoster {

	/** {@code activeFrom}–{@code activeTo}: các ngày trong tháng nhân viên thuộc cơ sở (đã cắt theo tháng). */
	public record Member(UUID staffId, String staffCode, String fullName, String position, String machineCode,
			boolean currentSchool, LocalDate activeFrom, LocalDate activeTo) {

		public boolean covers(LocalDate date) {
			return !date.isBefore(activeFrom) && !date.isAfter(activeTo);
		}
	}

	private final NamedParameterJdbcTemplate jdbc;

	public AttendanceRoster(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<Member> members(UUID schoolId, YearMonth month) {
		LocalDate first = month.atDay(1);
		LocalDate last = month.atEndOfMonth();
		String sql = """
				SELECT s.id, s.staff_code, s.full_name, s.position, s.machine_code, s.school_id = :school AS current_school,
				       greatest(min(a.from_date), s.start_date, :first) AS active_from,
				       least(max(coalesce(a.to_date, :last)), coalesce(s.end_date, :last), :last) AS active_to
				FROM staff s JOIN staff_school_assignments a ON a.staff_id = s.id
				WHERE a.school_id = :school AND a.from_date <= :last AND (a.to_date IS NULL OR a.to_date >= :first)
				  AND s.deleted_at IS NULL AND (s.end_date IS NULL OR s.end_date >= :first)
				GROUP BY s.id
				ORDER BY s.full_name""";
		return jdbc.query(sql,
				new MapSqlParameterSource("school", schoolId).addValue("first", first).addValue("last", last),
				(rs, i) -> new Member(rs.getObject("id", UUID.class), rs.getString("staff_code"),
						rs.getString("full_name"), rs.getString("position"), rs.getString("machine_code"),
						rs.getBoolean("current_school"), rs.getObject("active_from", LocalDate.class),
						rs.getObject("active_to", LocalDate.class)))
			.stream()
			.filter(m -> !m.activeFrom().isAfter(m.activeTo()))
			.toList();
	}

}

package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.Staff;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Truy vấn JPQL/Specification tự lọc theo cơ sở đang chọn (Hibernate filter) và bỏ hồ sơ đã xóa mềm. */
public interface StaffRepository extends JpaRepository<Staff, UUID>, JpaSpecificationExecutor<Staff> {

	// ---- Kiểm tra trùng: native query KHÔNG qua filter cơ sở, vì trùng CCCD/SĐT/email bị chặn toàn chuỗi

	@Query(value = """
			SELECT count(*) > 0 FROM staff WHERE deleted_at IS NULL AND citizen_id = :value
			  AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))""", nativeQuery = true)
	boolean citizenIdTakenAnywhere(@Param("value") String value, @Param("exclude") UUID excludeStaffId);

	@Query(value = """
			SELECT count(*) > 0 FROM staff WHERE deleted_at IS NULL AND phone = :value
			  AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))""", nativeQuery = true)
	boolean phoneTakenAnywhere(@Param("value") String value, @Param("exclude") UUID excludeStaffId);

	/** Mã chấm công đã dùng trong cơ sở (kể cả hồ sơ người dùng không thấy). */
	@Query(value = """
			SELECT count(*) > 0 FROM staff WHERE deleted_at IS NULL AND school_id = :schoolId AND machine_code = :value
			  AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))""", nativeQuery = true)
	boolean machineCodeTaken(@Param("schoolId") UUID schoolId, @Param("value") String value,
			@Param("exclude") UUID excludeStaffId);

	@Query(value = """
			SELECT count(*) > 0 FROM staff WHERE deleted_at IS NULL AND email = :value
			  AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))""", nativeQuery = true)
	boolean emailTakenAnywhere(@Param("value") String value, @Param("exclude") UUID excludeStaffId);

	/** File có thuộc hồ sơ nhân viên này không (ảnh, hợp đồng, chứng chỉ, đào tạo, giấy tờ, quyết định điều chuyển). */
	@Query(value = """
			SELECT EXISTS (
			  SELECT 1 FROM staff WHERE id = :staffId AND photo_file_id = :fileId
			  UNION ALL SELECT 1 FROM staff_contracts WHERE staff_id = :staffId AND file_id = :fileId
			  UNION ALL SELECT 1 FROM staff_certificates WHERE staff_id = :staffId AND file_id = :fileId
			  UNION ALL SELECT 1 FROM staff_trainings WHERE staff_id = :staffId AND file_id = :fileId
			  UNION ALL SELECT 1 FROM staff_documents WHERE staff_id = :staffId AND file_id = :fileId
			  UNION ALL SELECT 1 FROM staff_school_assignments WHERE staff_id = :staffId AND decision_file_id = :fileId
			)""", nativeQuery = true)
	boolean fileBelongsToStaff(@Param("staffId") UUID staffId, @Param("fileId") UUID fileId);

	// ---- Tóm tắt (theo phạm vi đang chọn)

	interface PositionCount {

		com.preschool.staff.entity.StaffEnums.Position getPosition();

		long getTotal();

	}

	@Query("""
			select s.position as position, count(s) as total from Staff s
			where s.status = com.preschool.staff.entity.StaffEnums.StaffStatus.ACTIVE
			  and (:schoolId is null or s.schoolId = :schoolId)
			group by s.position""")
	List<PositionCount> countActiveByPosition(@Param("schoolId") UUID schoolId);

}

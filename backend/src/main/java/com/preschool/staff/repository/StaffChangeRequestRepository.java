package com.preschool.staff.repository;

import java.util.List;
import java.util.UUID;

import com.preschool.staff.entity.StaffChangeRequest;
import com.preschool.staff.entity.StaffEnums.ChangeRequestStatus;

import org.springframework.data.jpa.repository.JpaRepository;

/** Đề xuất cập nhật hồ sơ (đã lọc theo cơ sở). */
public interface StaffChangeRequestRepository extends JpaRepository<StaffChangeRequest, UUID> {

	List<StaffChangeRequest> findByStaffIdOrderByCreatedAtDesc(UUID staffId);

	List<StaffChangeRequest> findByStaffIdAndStatus(UUID staffId, ChangeRequestStatus status);

	List<StaffChangeRequest> findByStatusOrderByCreatedAtAsc(ChangeRequestStatus status);

	List<StaffChangeRequest> findAllByOrderByCreatedAtDesc();

}

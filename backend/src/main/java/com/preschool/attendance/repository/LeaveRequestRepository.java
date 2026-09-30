package com.preschool.attendance.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.preschool.attendance.entity.LeaveRequest;
import com.preschool.attendance.entity.LeaveRequest.Status;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, UUID> {

	List<LeaveRequest> findByStaffIdOrderByFromDateDesc(UUID staffId);

	List<LeaveRequest> findByStatusOrderByFromDateAsc(Status status);

	List<LeaveRequest> findAllByOrderByCreatedAtDesc();

	/** Đơn chờ/đã duyệt của nhân viên chồng lên khoảng ngày (chặn đơn trùng). */
	@Query("""
			select r from LeaveRequest r where r.staffId = :staffId and r.status in :statuses
			  and r.fromDate <= :to and r.toDate >= :from""")
	List<LeaveRequest> findOverlapping(@Param("staffId") UUID staffId, @Param("from") LocalDate from,
			@Param("to") LocalDate to, @Param("statuses") Collection<Status> statuses);

	/** Đơn đã duyệt chồng lên tháng (lịch nghỉ của cơ sở). */
	@Query("""
			select r from LeaveRequest r where r.status = :status and r.fromDate <= :to and r.toDate >= :from
			order by r.fromDate""")
	List<LeaveRequest> findInRange(@Param("status") Status status, @Param("from") LocalDate from,
			@Param("to") LocalDate to);

}

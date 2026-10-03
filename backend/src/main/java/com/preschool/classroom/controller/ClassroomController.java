package com.preschool.classroom.controller;

import java.util.List;
import java.util.UUID;

import com.preschool.classroom.dto.ClassroomDtos.AgeGroupDto;
import com.preschool.classroom.dto.ClassroomDtos.AgeGroupRequest;
import com.preschool.classroom.dto.ClassroomDtos.ArchiveClassRequest;
import com.preschool.classroom.dto.ClassroomDtos.AssignTeacherRequest;
import com.preschool.classroom.dto.ClassroomDtos.ClassDetail;
import com.preschool.classroom.dto.ClassroomDtos.ClassItem;
import com.preschool.classroom.dto.ClassroomDtos.ClassRequest;
import com.preschool.classroom.dto.ClassroomDtos.EndAssignmentRequest;
import com.preschool.classroom.dto.ClassroomDtos.SchoolYearDto;
import com.preschool.classroom.dto.ClassroomDtos.SchoolYearRequest;
import com.preschool.classroom.service.ClassroomService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Năm học, khối độ tuổi, lớp và giáo viên phụ trách. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Lớp học")
public class ClassroomController {

	private final ClassroomService classroom;

	public ClassroomController(ClassroomService classroom) {
		this.classroom = classroom;
	}

	@GetMapping("/school-years")
	@Operation(summary = "Danh sách năm học, mới nhất trước")
	public List<SchoolYearDto> schoolYears() {
		return classroom.schoolYears();
	}

	@PostMapping("/school-years")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm năm học (hiệu trưởng)")
	public SchoolYearDto createSchoolYear(@Valid @RequestBody SchoolYearRequest request) {
		return classroom.createSchoolYear(request);
	}

	@PutMapping("/school-years/{id}")
	@Operation(summary = "Sửa năm học (hiệu trưởng)")
	public SchoolYearDto updateSchoolYear(@PathVariable UUID id, @Valid @RequestBody SchoolYearRequest request) {
		return classroom.updateSchoolYear(id, request);
	}

	@PostMapping("/school-years/{id}/current")
	@Operation(summary = "Đặt làm năm học hiện hành (hiệu trưởng)")
	public SchoolYearDto setCurrentSchoolYear(@PathVariable UUID id) {
		return classroom.setCurrentSchoolYear(id);
	}

	@GetMapping("/age-groups")
	@Operation(summary = "Khối theo độ tuổi và sĩ số tối đa")
	public List<AgeGroupDto> ageGroups() {
		return classroom.ageGroups();
	}

	@PutMapping("/age-groups/{id}")
	@Operation(summary = "Sửa khối: tên, độ tuổi, sĩ số tối đa (hiệu trưởng)")
	public AgeGroupDto updateAgeGroup(@PathVariable UUID id, @Valid @RequestBody AgeGroupRequest request) {
		return classroom.updateAgeGroup(id, request);
	}

	@GetMapping("/classes")
	@Operation(summary = "Lớp của năm học (rỗng = năm hiện hành) kèm sĩ số, giáo viên, có mặt hôm nay")
	public List<ClassItem> classes(@RequestParam(required = false) UUID schoolYearId,
			@RequestParam(defaultValue = "false") boolean includeArchived) {
		return classroom.classes(schoolYearId, includeArchived);
	}

	@PostMapping("/classes")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Thêm lớp ở cơ sở đang chọn hoặc chỉ định")
	public ClassItem createClass(@Valid @RequestBody ClassRequest request) {
		return classroom.create(request);
	}

	@GetMapping("/classes/{id}")
	@Operation(summary = "Chi tiết lớp và lịch sử phân công giáo viên")
	public ClassDetail classDetail(@PathVariable UUID id) {
		return classroom.detail(id);
	}

	@PutMapping("/classes/{id}")
	@Operation(summary = "Sửa lớp")
	public ClassItem updateClass(@PathVariable UUID id, @Valid @RequestBody ClassRequest request) {
		return classroom.update(id, request);
	}

	@PatchMapping("/classes/{id}/archive")
	@Operation(summary = "Lưu trữ hoặc khôi phục lớp")
	public ClassItem archiveClass(@PathVariable UUID id, @RequestBody(required = false) ArchiveClassRequest request) {
		boolean archive = request == null || request.archived() == null || request.archived();
		return classroom.archive(id, archive);
	}

	@DeleteMapping("/classes/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Xóa lớp chưa có trẻ và chưa điểm danh")
	public void deleteClass(@PathVariable UUID id) {
		classroom.delete(id);
	}

	@PostMapping("/classes/{id}/teachers")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Phân công giáo viên phụ trách lớp")
	public ClassDetail assignTeacher(@PathVariable UUID id, @Valid @RequestBody AssignTeacherRequest request) {
		return classroom.assignTeacher(id, request);
	}

	@PostMapping("/classes/{id}/teachers/{assignmentId}/end")
	@Operation(summary = "Kết thúc phân công (giữ lịch sử)")
	public ClassDetail endAssignment(@PathVariable UUID id, @PathVariable UUID assignmentId,
			@RequestBody(required = false) EndAssignmentRequest request) {
		return classroom.endAssignment(id, assignmentId, request == null ? null : request.toDate());
	}

}

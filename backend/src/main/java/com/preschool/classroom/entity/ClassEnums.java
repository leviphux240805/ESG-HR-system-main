package com.preschool.classroom.entity;

/** Kiểu liệt kê dùng chung của module Lớp học, hồ sơ trẻ, điểm danh (khớp CHECK trong migration V7). */
public final class ClassEnums {

	private ClassEnums() {
	}

	public enum Gender {
		MALE, FEMALE
	}

	/** Đang học, Bảo lưu, Đã nghỉ, Hoàn thành chương trình. */
	public enum ChildStatus {
		STUDYING, RESERVED, LEFT, COMPLETED
	}

	/** Giáo viên chính, giáo viên hoặc bảo mẫu phụ. */
	public enum TeacherRole {
		MAIN, ASSISTANT
	}

	/** Có mặt, Vắng có phép, Vắng không phép. */
	public enum AttendanceStatus {
		PRESENT, EXCUSED, ABSENT
	}

}

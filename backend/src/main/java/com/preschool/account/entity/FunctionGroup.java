package com.preschool.account.entity;

/** Nhóm chức năng giao cho phó hiệu trưởng ở từng trường (thiết kế mục "Vai trò và phân quyền"). */
public enum FunctionGroup {

	/** Lớp học, hồ sơ trẻ, điểm danh. */
	CLASSROOM,
	/** Thực đơn, cân đo, sổ theo dõi, khám định kỳ. */
	NUTRITION,
	/** Hồ sơ nhân viên (trừ lương), tài liệu, công việc, chấm công & nghỉ phép. */
	HR,
	/** Học phí, thu chi, lương & phiếu lương. */
	FINANCE,
	/** Dashboard và xuất Excel. */
	REPORTS

}

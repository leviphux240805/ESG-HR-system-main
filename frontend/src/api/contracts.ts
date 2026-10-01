/** Kiểu dữ liệu của các module backend chưa có; khi có API thật thì thay bằng type sinh từ OpenAPI. */
/**
 * Kiểu dữ liệu của các module chưa có trong OpenAPI (bản demo). Khi backend có API thật, thay bằng type sinh từ
 * `src/api/schema.d.ts` và xóa file này.
 */

export type AgeGroup = "NHA_TRE" | "MAM" | "CHOI" | "LA";
/** P = có mặt · E = vắng có phép · A = vắng không phép */
export type ChildMark = "P" | "E" | "A";
export type Gender = "MALE" | "FEMALE";

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ---- Hôm nay ----

export interface TodayClass {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  enrolled: number;
  present: number;
  excused: number;
  absent: number;
  /** Đã điểm danh hôm nay */
  taken: boolean;
  teachers: { id: string; fullName: string; onLeave: boolean; substituteName?: string }[];
  /** Có giáo viên nghỉ mà chưa có người thay */
  shortStaffed: boolean;
}

export interface TodayAbsentChild {
  id: string;
  fullName: string;
  className: string;
  mark: Exclude<ChildMark, "P">;
}

export interface TodayStaffLeave {
  staffId: string;
  fullName: string;
  position: string;
  leaveCode: string;
  classId?: string;
  className?: string;
  substituteName?: string;
}

export interface TodaySummary {
  date: string;
  /** Ngày học (hôm nay hoặc ngày học gần nhất nếu hôm nay nghỉ) */
  schoolDay: string;
  isSchoolDay: boolean;
  classes: TodayClass[];
  absentChildren: TodayAbsentChild[];
  staffOnLeave: TodayStaffLeave[];
  availableStaff: { id: string; fullName: string; position: string }[];
  pending: { leaves: number; tasks: number };
  tasksDueToday: number;
  tasksOverdue: number;
}

// ---- Hộp duyệt ----

export type ApprovalType = "LEAVE" | "TASK";

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  requester: string;
  requesterPosition?: string;
  createdAt: string;
  /** Các dòng mô tả ngắn: thời gian nghỉ, lý do, hạn việc… */
  details: { label: string; value: string }[];
}

// ---- Lớp & trẻ ----

export interface ClassItem {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  room: string;
  capacity: number;
  size: number;
  boys: number;
  girls: number;
  teachers: { id: string; fullName: string }[];
  presentToday: number | null;
}

export interface ChildItem {
  id: string;
  code: string;
  fullName: string;
  nickname: string;
  gender: Gender;
  dob: string;
  classId: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  allergies?: string;
  /** Tỷ lệ đi học 30 ngày gần nhất (0–100) */
  attendanceRate: number;
}

export interface ChildFields {
  fullName: string;
  nickname: string;
  gender: Gender;
  dob: string;
  classId: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  address: string;
  allergies?: string;
  healthNote?: string;
}

export interface ChildDetail extends ChildFields {
  id: string;
  code: string;
  className: string;
  schoolName: string;
  enrolledOn: string;
  attendance: { present: number; excused: number; absent: number; recent: { date: string; mark: ChildMark }[] };
  balance: number;
}

export interface RollCallRow {
  childId: string;
  fullName: string;
  nickname: string;
  gender: Gender;
  mark: ChildMark | null;
  note?: string;
  allergies?: string;
}

export interface RollCall {
  classId: string;
  className: string;
  date: string;
  isSchoolDay: boolean;
  rows: RollCallRow[];
}

// ---- Công việc ----

export type TaskStatus = "NEW" | "IN_PROGRESS" | "WAITING_APPROVAL" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  overdue: boolean;
  assignees: { id: string; fullName: string }[];
  createdByName: string;
  createdAt: string;
  checklist: { id: string; content: string; done: boolean }[];
  comments: { id: string; author: string; body: string; at: string }[];
  /** Người xem được chuyển sang các trạng thái này */
  allowedStatuses: TaskStatus[];
  canEdit: boolean;
}

export interface TaskFields {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeIds: string[];
  checklist?: string[];
}

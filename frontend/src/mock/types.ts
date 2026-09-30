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
  latestMeasurement?: Measurement & { status: string[] };
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

// ---- Học phí ----

export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID";

export interface InvoiceItem {
  id: string;
  code: string;
  childId: string;
  childName: string;
  className: string;
  month: string;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  dueDate: string;
  overdue: boolean;
}

export interface InvoiceDetail extends InvoiceItem {
  guardianName: string;
  guardianPhone: string;
  lines: { name: string; amount: number }[];
  payments: { id: string; date: string; amount: number; method: "CASH" | "TRANSFER" }[];
}

export interface FeeSummary {
  month: string;
  total: number;
  collected: number;
  outstanding: number;
  counts: Record<InvoiceStatus, number>;
}

export interface DebtItem {
  childId: string;
  childName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  months: string[];
  balance: number;
}

// ---- Thực đơn, cân đo ----

export interface DayMenu {
  date: string;
  breakfast: string;
  lunch: string[];
  snack: string;
}

export interface WeekMenu {
  id: string;
  weekStart: string;
  days: DayMenu[];
}

export interface Measurement {
  id: string;
  childId: string;
  date: string;
  heightCm: number;
  weightKg: number;
}

export interface GrowthRow {
  childId: string;
  fullName: string;
  gender: Gender;
  ageMonths: number;
  latest?: Measurement;
  status: string[];
}

/** Đường tham chiếu WHO (xấp xỉ) theo tháng tuổi: -2SD, trung vị, +2SD */
export interface ReferencePoint {
  ageMonths: number;
  low: number;
  median: number;
  high: number;
}

export interface GrowthChart {
  child: { id: string; fullName: string; gender: Gender; dob: string; className: string };
  measurements: (Measurement & { ageMonths: number })[];
  weightRef: ReferencePoint[];
  heightRef: ReferencePoint[];
  status: string[];
}

// ---- Báo cáo ----

export interface Dashboard {
  attendanceByDay: { date: string; rate: number }[];
  attendanceByClass: { className: string; rate: number }[];
  feesByMonth: { month: string; collected: number; outstanding: number }[];
  enrollmentByAge: { ageGroup: AgeGroup; count: number }[];
  nutrition: { label: string; count: number }[];
  staffLeaveByMonth: { month: string; days: number }[];
  tasks: { status: TaskStatus; count: number }[];
  kpis: { children: number; staff: number; attendanceRate: number; collectionRate: number };
}

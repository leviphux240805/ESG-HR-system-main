import type { components } from "@/api/schema";

type S = components["schemas"];

/** Khối theo mã nội bộ của bản demo (khớp `code` của danh mục khối). */
export type AgeGroup = "NHA_TRE" | "MAM" | "CHOI" | "LA";
/** P = có mặt · E = vắng có phép · A = vắng không phép */
export type ChildMark = "P" | "E" | "A";
export type Gender = "MALE" | "FEMALE";
export type TaskStatus = S["TaskItem"]["status"];
export type TaskPriority = S["TaskItem"]["priority"];

/** Thông tin trẻ lưu trong bản demo (một phụ huynh chính). */
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

export type DemoRole = "principal" | "vice" | "teacher";

export interface SchoolRec {
  id: string;
  code: string;
  name: string;
  address: string;
  phone?: string;
  /** Rỗng = đang hoạt động */
  active?: boolean;
}

/** Tài khoản đăng nhập của nhân viên (ngoài 3 tài khoản demo, vai trò của chúng nằm ở `users`). */
export interface AccountRec {
  id: string;
  staffId: string;
  email?: string;
  active: boolean;
  /** Mật khẩu do hiệu trưởng đặt, người dùng chưa tự đổi. */
  mustChangePassword?: boolean;
  roles: { role: string; schoolId: string; functionGroups?: string[] }[];
}

export type StaffRec = Omit<S["StaffDetail"], "permissions">;

export interface ClassRec {
  id: string;
  schoolId: string;
  name: string;
  ageGroup: AgeGroup;
  room: string;
  capacity: number;
  teacherIds: string[];
}

export interface ChildRec extends ChildFields {
  id: string;
  code: string;
  schoolId: string;
  enrolledOn: string;
}

export interface LeaveRec {
  id: string;
  schoolId: string;
  staffId: string;
  leaveCode: string;
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewerName?: string;
}

export interface SubstitutionRec {
  id: string;
  schoolId: string;
  date: string;
  classId: string;
  absentStaffId: string;
  staffId: string;
}

export interface TaskRec {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assigneeIds: string[];
  createdById: string;
  createdAt: string;
  checklist: { id: string; content: string; done: boolean }[];
  /** id file đính kèm (kho file demo) */
  comments: { id: string; author: string; body: string; at: string; files?: string[] }[];
  attachments?: { id: string; fileId: string }[];
}

export interface InvoiceRec {
  id: string;
  schoolId: string;
  childId: string;
  classId: string;
  /** "YYYY-MM-01" */
  periodMonth: string;
  invoiceNo?: string;
  status: S["InvoiceRow"]["status"];
  dueDate: string;
  issuedAt?: string;
  lines: S["InvoiceLineDto"][];
  payments: S["PaymentDto"][];
  carriedToId?: string;
  cancelReason?: string;
}

export type ChildFeeItemRec = S["ChildFeeItemDto"] & { childId: string };
export type ChildDiscountRec = S["ChildDiscountDto"] & { childId: string };

export type DishRec = Omit<S["DishDto"], "canEdit">;

export interface MenuRec {
  id: string;
  schoolId: string;
  ageGroupId?: string;
  weekStart: string;
  status: S["MenuWeekDto"]["status"];
  note?: string;
  publishedAt?: string;
}

export interface MenuItemRec {
  id: string;
  menuId: string;
  date: string;
  meal: S["MenuItemDto"]["meal"];
  dishId: string;
  orderNo: number;
  note?: string;
}

export type MeasurementRec = S["MeasurementDto"] & { schoolId: string; classId: string };
export type HealthLogRec = Omit<S["HealthLogDto"], "canEdit"> & { schoolId: string };
export type CheckupRec = S["CheckupDto"] & { schoolId: string };

export interface NotificationRec {
  id: string;
  staffId: string;
  title: string;
  body?: string;
  link?: string;
  createdAt: string;
  readAt?: string;
}

export interface DemoDB {
  version: number;
  /** Ngày sinh dữ liệu; khác hôm nay thì sinh lại để "Hôm nay" luôn có số liệu mới. */
  generatedOn: string;
  startDate: string;
  schools: SchoolRec[];
  accounts: AccountRec[];
  users: Record<DemoRole, { staffId: string; grants: { role: string; schoolId: string; functionGroups?: string[] }[] }>;
  staff: StaffRec[];
  contracts: Record<string, S["ContractDto"][]>;
  /** Thêm sau khi có dữ liệu demo cũ: khởi tạo rỗng khi dùng lần đầu (`??=`). */
  staffDocuments?: Record<string, S["StaffDocumentDto"][]>;
  salaryConfigs?: Record<string, S["SalaryConfigDto"][]>;
  assignments?: Record<string, S["AssignmentDto"][]>;
  changeRequests?: S["ChangeRequestDto"][];
  certificates: Record<string, S["CertificateDto"][]>;
  trainings: Record<string, S["TrainingDto"][]>;
  dependents: Record<string, S["DependentDto"][]>;
  classes: ClassRec[];
  children: ChildRec[];
  /** date → childId → mark */
  childAttendance: Record<string, Record<string, ChildMark>>;
  childNotes: Record<string, string>;
  /** staffId → date → mã công */
  staffDays: Record<string, Record<string, string>>;
  /** `${staffId}|${date}` → phút đi muộn */
  late: Record<string, number>;
  discrepancies: Record<string, { reason: string; suggested: string }>;
  cellNotes: Record<string, string>;
  /** `${schoolId}|${month}` */
  locks: Record<string, { lockedAt: string; lockedByName: string }>;
  leaves: LeaveRec[];
  substitutions: SubstitutionRec[];
  tasks: TaskRec[];
  schoolYears: S["SchoolYearDto"][];
  ageGroups: (S["AgeGroupDto"] & { code: AgeGroup })[];
  feeTypes: S["FeeTypeDto"][];
  feeSchedules: S["FeeScheduleDto"][];
  financeConfigs: S["FinanceConfigDto"][];
  feeItems: ChildFeeItemRec[];
  discounts: ChildDiscountRec[];
  invoices: InvoiceRec[];
  cashCategories: S["CashCategoryDto"][];
  cashEntries: S["CashEntryDto"][];
  dishes: DishRec[];
  menus: MenuRec[];
  menuItems: MenuItemRec[];
  measurements: MeasurementRec[];
  healthLogs: HealthLogRec[];
  checkups: CheckupRec[];
  notifications: NotificationRec[];
}

export const DB_VERSION = 6;
const STORAGE_KEY = "mnv.demo.db";

let current: DemoDB | null = null;

function load(generate: () => DemoDB, today: string): DemoDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDB;
      if (parsed.version === DB_VERSION && parsed.generatedOn === today) return parsed;
    }
  } catch {
    // dữ liệu hỏng hoặc trình duyệt chặn localStorage: sinh lại
  }
  return generate();
}

let generator: (() => DemoDB) | null = null;
let todayFn: () => string = () => "";

export function configureDb(generate: () => DemoDB, today: () => string) {
  generator = generate;
  todayFn = today;
}

export function db(): DemoDB {
  if (!current) current = load(generator!, todayFn());
  return current;
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // hết dung lượng hoặc bị chặn: vẫn giữ trong bộ nhớ đến khi tải lại trang
  }
}

/** Nút "Khôi phục dữ liệu demo". */
export function resetDb() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // bỏ qua
  }
  current = generator!();
}

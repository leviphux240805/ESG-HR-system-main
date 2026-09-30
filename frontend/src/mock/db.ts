import type { components } from "@/api/schema";
import type { AgeGroup, ChildFields, ChildMark, DayMenu, Measurement, TaskPriority, TaskStatus } from "@/api/contracts";

type S = components["schemas"];

export type DemoRole = "principal" | "vice" | "teacher";

export interface SchoolRec {
  id: string;
  code: string;
  name: string;
  address: string;
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
  comments: { id: string; author: string; body: string; at: string }[];
}

export interface InvoiceRec {
  id: string;
  code: string;
  schoolId: string;
  childId: string;
  month: string;
  dueDate: string;
  lines: { name: string; amount: number }[];
  payments: { id: string; date: string; amount: number; method: "CASH" | "TRANSFER" }[];
}

export interface MenuRec {
  id: string;
  schoolId: string;
  weekStart: string;
  days: DayMenu[];
}

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
  users: Record<DemoRole, { staffId: string; grants: { role: string; schoolId: string }[] }>;
  staff: StaffRec[];
  contracts: Record<string, S["ContractDto"][]>;
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
  invoices: InvoiceRec[];
  menus: MenuRec[];
  growth: Measurement[];
  notifications: NotificationRec[];
}

export const DB_VERSION = 2;
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

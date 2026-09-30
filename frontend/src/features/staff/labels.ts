import type { components } from "@/api/schema";
import type { StatusMeta } from "@/components/common/StatusBadge";

type S = components["schemas"];
export type Position = S["StaffListItem"]["position"];
export type StaffStatus = S["StaffListItem"]["status"];
export type Qualification = NonNullable<S["StaffDetail"]["qualification"]>;
export type Gender = NonNullable<S["StaffDetail"]["gender"]>;
export type ContractType = S["ContractDto"]["contractType"];

export const POSITION_LABELS: Record<Position, string> = {
  TEACHER: "Giáo viên",
  NANNY: "Bảo mẫu",
  COOK: "Cấp dưỡng",
  NURSE: "Nhân viên y tế",
  ACCOUNTANT: "Kế toán",
  SECURITY: "Bảo vệ",
  MANAGER: "Quản lý",
  OTHER: "Khác",
};

export const STAFF_STATUS: Record<StaffStatus, StatusMeta> = {
  ACTIVE: { label: "Đang làm", tone: "success" },
  TERMINATED: { label: "Đã nghỉ", tone: "neutral" },
};

export const QUALIFICATION_LABELS: Record<Qualification, string> = {
  HIGH_SCHOOL: "Trung học phổ thông",
  INTERMEDIATE: "Trung cấp",
  COLLEGE: "Cao đẳng",
  BACHELOR: "Đại học",
  MASTER: "Thạc sĩ",
  OTHER: "Khác",
};

export const GENDER_LABELS: Record<Gender, string> = { MALE: "Nam", FEMALE: "Nữ" };

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  PROBATION: "Thử việc",
  DEFINITE: "Xác định thời hạn",
  INDEFINITE: "Không xác định thời hạn",
  SERVICE: "Hợp đồng dịch vụ",
};

/** Danh sách lựa chọn cho Select/FilterBar. */
export const options = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));

export type SalaryMode = S["SalaryConfigDto"]["salaryMode"];
export type SalaryRegion = NonNullable<S["SalaryConfigDto"]["region"]>;

export const SALARY_MODE_LABELS: Record<SalaryMode, string> = {
  FIXED: "Lương cứng",
  COEFFICIENT: "Lương hệ số",
};

export const SALARY_REGION_LABELS: Record<SalaryRegion, string> = { I: "Vùng I", II: "Vùng II", III: "Vùng III", IV: "Vùng IV" };

/** Khóa phụ cấp backend chấp nhận (StaffActionDtos.ALLOWANCE_KEYS); seniorityPercent là %, còn lại là đồng/tháng. */
export const ALLOWANCE_LABELS = {
  lunch: "Ăn trưa",
  transport: "Đi lại",
  phone: "Điện thoại",
  responsibility: "Trách nhiệm",
  position: "Chức vụ",
  seniorityPercent: "Thâm niên (%)",
  other: "Khác",
} as const;

export type AllowanceKey = keyof typeof ALLOWANCE_LABELS;

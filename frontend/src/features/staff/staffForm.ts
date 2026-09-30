import { z } from "zod";
import type { components } from "@/api/schema";

type StaffFields = components["schemas"]["StaffFields"];
type StaffDetail = components["schemas"]["StaffDetail"];

const optionalText = z.string().trim().optional().default("");

/** Form hồ sơ nhân viên (dùng cho thêm mới và sửa). Chuỗi rỗng = không nhập. */
export const staffFormSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên"),
  dob: optionalText,
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  ethnicity: optionalText,
  citizenId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{12}$/.test(v), "Số CCCD gồm 12 chữ số")
    .default(""),
  citizenIdIssuedOn: optionalText,
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9 +().-]{9,20}$/.test(v), "Số điện thoại không hợp lệ")
    .default(""),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email không hợp lệ")
    .default(""),
  permProvinceCode: optionalText,
  permWardCode: optionalText,
  permAddressDetail: optionalText,
  sameAddress: z.boolean().default(true),
  currProvinceCode: optionalText,
  currWardCode: optionalText,
  currAddressDetail: optionalText,
  position: z.enum(["TEACHER", "NANNY", "COOK", "NURSE", "ACCOUNTANT", "SECURITY", "MANAGER", "OTHER"], {
    required_error: "Vui lòng chọn vị trí",
  }),
  qualification: z.enum(["HIGH_SCHOOL", "INTERMEDIATE", "COLLEGE", "BACHELOR", "MASTER", "OTHER"]).optional(),
  specialization: optionalText,
  socialInsuranceNo: optionalText,
  healthInsuranceNo: optionalText,
  personalTaxCode: optionalText,
  startDate: z.string().min(1, "Vui lòng chọn ngày vào làm"),
});

export type StaffFormValues = z.infer<typeof staffFormSchema>;

export const emptyStaffForm = (): StaffFormValues => ({
  fullName: "",
  dob: "",
  gender: undefined,
  ethnicity: "",
  citizenId: "",
  citizenIdIssuedOn: "",
  phone: "",
  email: "",
  permProvinceCode: "",
  permWardCode: "",
  permAddressDetail: "",
  sameAddress: true,
  currProvinceCode: "",
  currWardCode: "",
  currAddressDetail: "",
  position: undefined as unknown as StaffFormValues["position"],
  qualification: undefined,
  specialization: "",
  socialInsuranceNo: "",
  healthInsuranceNo: "",
  personalTaxCode: "",
  startDate: new Date().toISOString().slice(0, 10),
});

const orUndefined = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

/** Giá trị form → StaffFields gửi API (rỗng → không gửi). */
export function toStaffFields(v: StaffFormValues, photoFileId?: string): StaffFields {
  const curr = v.sameAddress
    ? { currProvinceCode: v.permProvinceCode, currWardCode: v.permWardCode, currAddressDetail: v.permAddressDetail }
    : { currProvinceCode: v.currProvinceCode, currWardCode: v.currWardCode, currAddressDetail: v.currAddressDetail };
  return {
    fullName: v.fullName.trim(),
    dob: orUndefined(v.dob),
    gender: v.gender,
    ethnicity: orUndefined(v.ethnicity),
    citizenId: orUndefined(v.citizenId),
    citizenIdIssuedOn: orUndefined(v.citizenIdIssuedOn),
    phone: orUndefined(v.phone),
    email: orUndefined(v.email),
    permProvinceCode: orUndefined(v.permProvinceCode),
    permWardCode: orUndefined(v.permWardCode),
    permAddressDetail: orUndefined(v.permAddressDetail),
    currProvinceCode: orUndefined(curr.currProvinceCode),
    currWardCode: orUndefined(curr.currWardCode),
    currAddressDetail: orUndefined(curr.currAddressDetail),
    position: v.position,
    qualification: v.qualification,
    specialization: orUndefined(v.specialization),
    socialInsuranceNo: orUndefined(v.socialInsuranceNo),
    healthInsuranceNo: orUndefined(v.healthInsuranceNo),
    personalTaxCode: orUndefined(v.personalTaxCode),
    photoFileId,
    startDate: v.startDate,
  };
}

/** Hồ sơ từ API → giá trị form (sửa hồ sơ). */
export function fromStaffDetail(d: StaffDetail): StaffFormValues {
  const same =
    (d.currProvinceCode ?? "") === (d.permProvinceCode ?? "") &&
    (d.currWardCode ?? "") === (d.permWardCode ?? "") &&
    (d.currAddressDetail ?? "") === (d.permAddressDetail ?? "");
  return {
    fullName: d.fullName,
    dob: d.dob ?? "",
    gender: d.gender,
    ethnicity: d.ethnicity ?? "",
    citizenId: d.citizenId ?? "",
    citizenIdIssuedOn: d.citizenIdIssuedOn ?? "",
    phone: d.phone ?? "",
    email: d.email ?? "",
    permProvinceCode: d.permProvinceCode ?? "",
    permWardCode: d.permWardCode ?? "",
    permAddressDetail: d.permAddressDetail ?? "",
    sameAddress: same,
    currProvinceCode: d.currProvinceCode ?? "",
    currWardCode: d.currWardCode ?? "",
    currAddressDetail: d.currAddressDetail ?? "",
    position: d.position,
    qualification: d.qualification,
    specialization: d.specialization ?? "",
    socialInsuranceNo: d.socialInsuranceNo ?? "",
    healthInsuranceNo: d.healthInsuranceNo ?? "",
    personalTaxCode: d.personalTaxCode ?? "",
    startDate: d.startDate,
  };
}

/** Vai trò tài khoản gợi ý theo vị trí công việc. */
export const SUGGESTED_ROLE: Record<StaffFormValues["position"], components["schemas"]["RoleAssignment"]["role"]> = {
  TEACHER: "TEACHER",
  NANNY: "TEACHER",
  COOK: "KITCHEN",
  NURSE: "NURSE",
  ACCOUNTANT: "ACCOUNTANT",
  SECURITY: "STAFF",
  MANAGER: "PRINCIPAL",
  OTHER: "STAFF",
};

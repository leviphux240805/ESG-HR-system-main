import { formatDate, formatMoney } from "@/lib/format";
import type { HistoryEvent } from "./api";
import { CONTRACT_TYPE_LABELS, type ContractType, GENDER_LABELS, POSITION_LABELS, QUALIFICATION_LABELS } from "./labels";

/** Tra cứu tên để mô tả sự kiện (cơ sở, loại giấy tờ theo id hoặc mã). */
export interface HistoryContext {
  schoolName: (id: string) => string | undefined;
  documentTypeName: (idOrCode: string) => string | undefined;
}

export interface EventDescription {
  title: string;
  details: string[];
}

type Data = Record<string, unknown> | null | undefined;

const STAFF_FIELD_LABELS: Record<string, string> = {
  fullName: "Họ tên",
  dob: "Ngày sinh",
  gender: "Giới tính",
  ethnicity: "Dân tộc",
  citizenId: "Số CCCD",
  citizenIdIssuedOn: "Ngày cấp CCCD",
  phone: "Số điện thoại",
  email: "Email",
  permProvinceCode: "Địa chỉ thường trú",
  permWardCode: "Địa chỉ thường trú",
  permAddressDetail: "Địa chỉ thường trú",
  currProvinceCode: "Địa chỉ hiện tại",
  currWardCode: "Địa chỉ hiện tại",
  currAddressDetail: "Địa chỉ hiện tại",
  position: "Vị trí",
  qualification: "Trình độ",
  specialization: "Chuyên ngành",
  socialInsuranceNo: "Số sổ BHXH",
  healthInsuranceNo: "Số thẻ BHYT",
  personalTaxCode: "Mã số thuế cá nhân",
  photoFileId: "Ảnh đại diện",
  startDate: "Ngày vào làm",
};

/** Trường chỉ báo "đã thay đổi", không hiện giá trị (mã địa giới, id tệp). */
const OPAQUE_FIELDS = new Set([
  "permProvinceCode",
  "permWardCode",
  "permAddressDetail",
  "currProvinceCode",
  "currWardCode",
  "currAddressDetail",
  "photoFileId",
]);

const DATE_FIELDS = new Set(["dob", "citizenIdIssuedOn", "startDate"]);

const ENUM_LABELS: Record<string, Record<string, string>> = {
  position: POSITION_LABELS,
  gender: GENDER_LABELS,
  qualification: QUALIFICATION_LABELS,
};

function fieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(trống)";
  if (DATE_FIELDS.has(key)) return formatDate(String(value));
  return ENUM_LABELS[key]?.[String(value)] ?? String(value);
}

/** Các dòng "Trường: cũ → mới" của lần sửa hồ sơ; địa chỉ và ảnh chỉ báo đã thay đổi. */
export function staffChanges(before: Data, after: Data): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const lines: string[] = [];
  const opaque = new Set<string>();
  for (const key of keys) {
    const a = before?.[key] ?? null;
    const b = after?.[key] ?? null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const label = STAFF_FIELD_LABELS[key];
    if (!label) continue;
    if (OPAQUE_FIELDS.has(key)) opaque.add(label);
    else lines.push(`${label}: ${fieldValue(key, a)} → ${fieldValue(key, b)}`);
  }
  for (const label of opaque) lines.push(`${label}: đã thay đổi`);
  return lines;
}

const VERB: Record<HistoryEvent["action"], string> = { CREATE: "Thêm", UPDATE: "Sửa", DELETE: "Xóa" };

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);

/** Mô tả một mục nhật ký bằng tiếng Việt cho tab Lịch sử. */
export function describeEvent(event: HistoryEvent, ctx: HistoryContext): EventDescription {
  const before = event.before as Data;
  const after = event.after as Data;
  const data = after ?? before ?? {};
  const verb = VERB[event.action];

  switch (event.entity) {
    case "staff":
      return event.action === "CREATE"
        ? { title: "Tạo hồ sơ", details: [] }
        : { title: "Cập nhật hồ sơ", details: staffChanges(before, after) };
    case "staff.contract": {
      const type = CONTRACT_TYPE_LABELS[data.contractType as ContractType];
      const no = str(data.contractNo);
      const period = [formatDate(str(data.startDate)), formatDate(str(data.endDate)) || "không thời hạn"].join(" – ");
      return {
        title: `${verb} hợp đồng`,
        details: [[type, no && `số ${no}`].filter(Boolean).join(", "), str(data.startDate) ? period : ""].filter(Boolean),
      };
    }
    case "staff.document": {
      const typeObj = data.type as { name?: string } | undefined;
      const name =
        typeObj?.name ??
        ctx.documentTypeName(String(data.documentType ?? data.documentTypeId ?? "")) ??
        "Giấy tờ";
      return { title: event.action === "DELETE" ? "Xóa giấy tờ" : "Tải lên giấy tờ", details: [name] };
    }
    case "staff.dependent":
      return { title: `${verb} người phụ thuộc`, details: [str(data.fullName) ?? ""].filter(Boolean) };
    case "staff.certificate":
      return { title: `${verb} chứng chỉ`, details: [str(data.name) ?? ""].filter(Boolean) };
    case "staff.training":
      return { title: `${verb} khóa đào tạo`, details: [str(data.courseName) ?? ""].filter(Boolean) };
    case "staff.salary": {
      const amount = data.baseSalary != null ? formatMoney(data.baseSalary as number) : str(String(data.coefficient ?? ""));
      return {
        title: "Điều chỉnh lương",
        details: [`Hiệu lực từ ${formatDate(str(data.effectiveFrom))}`, amount ? `Mức: ${amount}` : ""].filter(Boolean),
      };
    }
    case "staff.bank":
      return { title: "Cập nhật tài khoản ngân hàng", details: [] };
    case "staff.transfer": {
      const from = ctx.schoolName(String(before?.schoolId ?? "")) ?? "cơ sở cũ";
      const to = ctx.schoolName(String(after?.schoolId ?? "")) ?? "cơ sở mới";
      const details = [`Từ ${from} sang ${to}`, `Hiệu lực từ ${formatDate(str(after?.effectiveDate))}`];
      if (after?.applied === false) details.push("Chờ tới ngày hiệu lực");
      return { title: "Điều chuyển cơ sở", details };
    }
    case "staff.terminate":
      return {
        title: "Cho nghỉ việc",
        details: [`Ngày nghỉ: ${formatDate(str(after?.endDate))}`, str(after?.reason) ? `Lý do: ${after?.reason}` : ""].filter(
          Boolean,
        ),
      };
    default:
      return { title: `${verb} ${event.entity}`, details: [] };
  }
}

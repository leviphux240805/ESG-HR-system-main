/**
 * Đọc nội dung mã QR trên CCCD gắn chip / thẻ Căn cước. Định dạng (phân tách bằng "|"):
 *   số CCCD (12 số) | số CMND cũ (có thể trống) | HỌ TÊN | ngày sinh ddMMyyyy | giới tính | địa chỉ thường trú | ngày cấp ddMMyyyy
 * Địa chỉ trong QR là dạng cũ (còn quận/huyện) nên chỉ dùng để điền ô chi tiết.
 */
export interface CccdInfo {
  citizenId: string;
  oldId?: string;
  fullName: string;
  /** yyyy-MM-dd */
  dob?: string;
  gender?: "MALE" | "FEMALE";
  address?: string;
  /** yyyy-MM-dd */
  issuedOn?: string;
}

function toIsoDate(value: string | undefined): string | undefined {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(value?.trim() ?? "");
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  const valid = date.getUTCFullYear() === Number(yyyy) && date.getUTCMonth() === Number(mm) - 1 && date.getUTCDate() === Number(dd);
  return valid ? `${yyyy}-${mm}-${dd}` : undefined;
}

/** "NGUYỄN THỊ LAN" → "Nguyễn Thị Lan". */
export function titleCaseVi(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("vi") + word.slice(1))
    .join(" ");
}

function toGender(value: string | undefined): CccdInfo["gender"] {
  const v = value?.trim().toLocaleLowerCase("vi");
  if (v === "nam") return "MALE";
  if (v === "nữ" || v === "nu") return "FEMALE";
  return undefined;
}

/** Trả null nếu nội dung không phải QR CCCD (không có số 12 chữ số ở trường đầu hoặc thiếu họ tên). */
export function parseCccdQr(text: string): CccdInfo | null {
  const parts = text.split("|").map((p) => p.trim());
  const citizenId = parts[0];
  if (!/^\d{12}$/.test(citizenId ?? "") || !parts[2]) return null;
  return {
    citizenId,
    oldId: parts[1] || undefined,
    fullName: titleCaseVi(parts[2]),
    dob: toIsoDate(parts[3]),
    gender: toGender(parts[4]),
    address: parts[5] || undefined,
    issuedOn: toIsoDate(parts[6]),
  };
}

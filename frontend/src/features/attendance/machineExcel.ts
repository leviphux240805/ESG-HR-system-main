import * as XLSX from "xlsx";

/** Một ô chấm công đọc từ file máy: mã NV trên máy, ngày, giờ vào/ra dạng chữ ("07:58", "K"). */
export interface MachinePunchRow {
  machineCode: string;
  name: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
}

/**
 * Giá trị ô giờ → chữ: số Excel (phần ngày, 0,5 = 12:00) thành "HH:mm"; "V" (vắng) thành "K"; chữ khác giữ nguyên.
 * Giữ đúng thuật toán `formatTimeValue` của ESG HR (AttendanceUploadModal) để kết quả đối soát không đổi.
 */
export function formatTimeValue(value: unknown): string | null {
  if (!value) return null;
  if (value === "V") return "K";
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }
  if (typeof value === "string") return value;
  return String(value);
}

/**
 * Đọc file Excel máy chấm công (sheet đầu) theo cấu trúc ESG HR: dòng tiêu đề là dòng đầu tiên (trong 20 dòng) có hơn
 * 10 ô số 1–31 (không thấy thì dòng thứ 4); mã NV ở cột C, tên cột D; dữ liệu bắt đầu sau tiêu đề 2 dòng; giờ vào ở
 * dòng của NV, giờ ra ở dòng ngay dưới. `monthIndex` tính từ 0 (0 = tháng 1).
 *
 * Giữ nguyên thuật toán `parseExcelFile` cũ (test đối chiếu dùng chung file mẫu với backend).
 */
export function parseMachineWorkbook(data: ArrayBuffer | Uint8Array, year: number, monthIndex: number): MachinePunchRow[] {
  const workbook = XLSX.read(data, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  const records: MachinePunchRow[] = [];

  let headerRow = -1;
  for (let r = range.s.r; r <= 20; r++) {
    let matchCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number" && cell.v > 0 && cell.v <= 31) matchCount++;
    }
    if (matchCount > 10) {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) headerRow = 3;

  const dayColumns: { [day: number]: number } = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell && !isNaN(parseInt(cell.v))) dayColumns[parseInt(cell.v)] = c;
  }

  for (let r = headerRow + 2; r <= range.e.r; r++) {
    const codeCell = worksheet[XLSX.utils.encode_cell({ r, c: 2 })];
    if (!codeCell || !codeCell.v) continue;
    const machineCode = String(codeCell.v).trim();
    const nameCell = worksheet[XLSX.utils.encode_cell({ r, c: 3 })];
    const name = nameCell ? String(nameCell.v).trim() : "Unknown";

    for (const [day, col] of Object.entries(dayColumns)) {
      const dayNum = parseInt(day);
      const workDate = new Date(year, monthIndex, dayNum);
      if (workDate.getMonth() !== monthIndex) continue;
      const dateStr = `${workDate.getFullYear()}-${String(workDate.getMonth() + 1).padStart(2, "0")}-${String(workDate.getDate()).padStart(2, "0")}`;

      const checkInCell = worksheet[XLSX.utils.encode_cell({ r, c: col })];
      const checkOutCell = worksheet[XLSX.utils.encode_cell({ r: r + 1, c: col })];
      const checkIn = checkInCell && checkInCell.v !== "" ? formatTimeValue(checkInCell.v) : null;
      let checkOut = checkOutCell && checkOutCell.v !== "" ? formatTimeValue(checkOutCell.v) : null;
      // Ô "V" gộp hai dòng: giờ vào "K", giờ ra trống → cả hai là "K"
      if (checkIn === "K" && !checkOut) checkOut = "K";
      if (checkIn || checkOut) records.push({ machineCode, name, workDate: dateStr, checkIn, checkOut });
    }
  }
  return records;
}

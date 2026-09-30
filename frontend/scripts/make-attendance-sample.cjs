/**
 * Sinh file Excel máy chấm công GIẢ LẬP tháng 9/2026 đúng cấu trúc ESG HR đọc (xem features/attendance/machineExcel.ts),
 * dùng cho test đối chiếu khi chưa có file thật. Dữ liệu cố định (chạy lại ra cùng nội dung):
 *   node scripts/make-attendance-sample.cjs
 * Mã NV 101–106 là mã chấm công của nhân viên seed Cơ sở A; 999 là mã không có trong hệ thống.
 */
const path = require("node:path");
const XLSX = require("xlsx");

const YEAR = 2026;
const MONTH = 9; // tháng 9
const DAYS = 30;
const HOLIDAYS = new Set([1, 2]); // 1–2/9 Quốc khánh

const weekday = (day) => new Date(Date.UTC(YEAR, MONTH - 1, day)).getUTCDay(); // 0 = CN
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Ngày làm việc bình thường: T2–T7 (trừ lễ); T7 về trưa. */
function normalDay(day, variant) {
  if (weekday(day) === 0 || HOLIDAYS.has(day)) return null;
  const minute = String(20 + ((day * 7 + variant) % 9)).padStart(2, "0"); // 07:20–07:28
  return { in: `07:${minute}`, out: weekday(day) === 6 ? "11:35" : `17:0${day % 10}` };
}

const time = (hh, mm) => (hh * 60 + mm) / (24 * 60); // số Excel

const EMPLOYEES = [
  { code: "101", name: "Hiệu Trưởng A", overrides: {} },
  {
    code: "102",
    name: "Giáo Viên A",
    // Muộn nhẹ (≤ 15 phút) lần 1–3 không tính, từ lần 4 tính; muộn 16 phút luôn tính
    overrides: {
      3: { in: "07:40", out: "17:00" },
      4: { in: "07:45", out: "17:00" },
      7: { in: "07:31", out: "17:00" },
      8: { in: "07:44", out: "17:00" },
      9: { in: "07:46", out: "17:00" },
      10: { in: "07:31", out: "17:00" },
    },
  },
  {
    code: "103",
    name: "Y Tế A",
    overrides: {
      10: { in: "07:20", out: null }, // thiếu giờ về, vào buổi sáng
      11: { in: "13:30", out: null }, // thiếu giờ về, vào ca chiều
      12: { in: "07:25", out: "14:00" }, // thứ Bảy về 14:00: không sai lệch
      14: { in: "11:45", out: null }, // thiếu giờ về, vào giờ nghỉ trưa
      15: { in: "V", out: null }, // vắng (ô gộp)
      16: { in: "07:25", out: "12:30" }, // về trưa ngày thường → gợi ý 1/2K
      17: { in: "07:25", out: "15:00" }, // đúng mốc chiều sớm
      18: { in: "07:25", out: "15:01" }, // qua mốc: không sai lệch
    },
  },
  {
    code: "104",
    name: "Kế Toán A",
    numeric: true, // giờ dạng số Excel
    overrides: {
      21: null, // nghỉ phép (không chấm máy), HR ghi P
      22: null, // nghỉ không lương, HR ghi K
      23: { in: "07:26", out: "17:03" }, // có mặt nhưng HR ghi O
    },
  },
  {
    code: "105",
    name: "Nguyễn Thị Lan",
    overrides: {
      21: { in: "V", out: null }, // máy vắng, HR ghi P
      22: { in: "V", out: null }, // máy vắng, HR ghi K
      23: { in: "07:25", out: "12:00" }, // về trưa, HR ghi 1/2P
      24: { in: "07:25", out: "12:00" }, // về trưa, chưa chấm tay
      25: { in: "07:30", out: "17:00" }, // đúng giờ
    },
  },
  {
    code: "106",
    name: "Trần Thị Mai",
    overrides: {
      1: { in: "07:28", out: "11:40" }, // đi làm ngày lễ
      29: { in: "08:10", out: "17:00" }, // muộn 40 phút
    },
  },
  { code: "999", name: "Không Có Trong Hệ Thống", overrides: {}, onlyDays: [3, 4] },
];

const rows = [["BẢNG CHẤM CÔNG CHI TIẾT (DỮ LIỆU GIẢ LẬP)"], [`Tháng ${String(MONTH).padStart(2, "0")}/${YEAR}`], []];
const days = Array.from({ length: DAYS }, (_, i) => i + 1);
rows.push(["STT", "Phòng ban", "Mã NV", "Họ tên", ...days]);
rows.push(["", "", "", "", ...days.map((d) => WEEKDAY_LABELS[weekday(d)])]);

EMPLOYEES.forEach((emp, index) => {
  const inRow = [index + 1, "Cơ sở A", emp.code, emp.name];
  const outRow = [null, null, null, null];
  for (const day of days) {
    let cell = day in emp.overrides ? emp.overrides[day] : normalDay(day, index);
    if (emp.onlyDays && !emp.onlyDays.includes(day)) cell = null;
    const value = (v) => {
      if (!v) return null;
      if (emp.numeric && v.includes(":")) {
        const [h, m] = v.split(":").map(Number);
        return time(h, m);
      }
      return v;
    };
    inRow.push(cell ? value(cell.in) : null);
    outRow.push(cell ? value(cell.out) : null);
  }
  rows.push(inRow, outRow);
});

const sheet = XLSX.utils.aoa_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Chấm công");
const target = path.resolve(__dirname, "../../docs/mau/may-cham-cong-gia-lap-2026-09.xlsx");
XLSX.writeFile(workbook, target);
console.log("Đã ghi", target);

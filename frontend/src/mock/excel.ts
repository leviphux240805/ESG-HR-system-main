import * as XLSX from "xlsx";
import { FileBody } from "./router";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** File Excel một bảng: dòng tiêu đề, dòng trống, tên cột, dữ liệu (như ExcelTable của backend). */
export function sheetFile(title: string, sheetName: string, header: string[], rows: (string | number)[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[title], [], header, ...rows]), sheetName);
  return new FileBody(XLSX.write(book, { type: "array", bookType: "xlsx" }), XLSX_TYPE);
}

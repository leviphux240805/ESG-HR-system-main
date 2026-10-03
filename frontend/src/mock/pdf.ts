import type { components } from "@/api/schema";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";

type InvoiceDetail = components["schemas"]["InvoiceDetail"];
type Payslip = components["schemas"]["Payslip"];

// PDF của bản demo không cần thư viện: vẽ phiếu lên canvas (font hệ thống, đủ dấu tiếng Việt), nhúng ảnh JPEG vào
// một trang PDF A5 dọc viết tay theo đặc tả PDF 1.4.

const PAGE_W = 420; // A5 dọc, đơn vị pt
const PAGE_H = 595;
const SCALE = 2.5; // điểm ảnh / pt để chữ nét khi in

/** Một trang PDF chứa ảnh JPEG phủ kín trang. */
export function jpegPdf(jpeg: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body.forEach(push);
    push("\nendobj\n");
  };
  const content = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im0 Do Q`;

  push("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  object(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(5, [
    enc.encode(`<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    enc.encode("\nendstream"),
  ]);
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

interface Drawer {
  font: (size: number, bold?: boolean) => void;
  text: (s: string, x: number, y: number, align?: CanvasTextAlign) => void;
  line: (y: number) => void;
  /** Dòng "nhãn ……… số tiền" căn hai bên; trả y của dòng tiếp theo */
  row: (label: string, value: string, y: number, bold?: boolean) => number;
  width: number;
  height: number;
}

/** Vẽ một trang A5 dọc lên canvas rồi đóng gói thành PDF (bản demo, cần trình duyệt). */
function canvasPdf(draw: (d: Drawer) => void): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const g = canvas.getContext("2d")!;
  g.scale(SCALE, SCALE);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, PAGE_W, PAGE_H);
  g.fillStyle = "#111";
  const d: Drawer = {
    width: PAGE_W,
    height: PAGE_H,
    font: (size, bold = false) => void (g.font = `${bold ? "bold " : ""}${size}px Arial, sans-serif`),
    text: (str, x, y, align = "left") => {
      g.textAlign = align;
      g.fillText(str, x, y);
    },
    line: (y) => g.fillRect(28, y, PAGE_W - 56, 0.6),
    row: (label, value, y, bold = false) => {
      d.font(10, bold);
      d.text(label, 28, y);
      d.text(value, PAGE_W - 28, y, "right");
      return y + 20;
    },
  };
  draw(d);
  d.font(9);
  g.fillStyle = "#666";
  d.text("Bản demo – dữ liệu mẫu", PAGE_W / 2, PAGE_H - 28, "center");
  const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
  return jpegPdf(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), canvas.width, canvas.height);
}

const header = (d: Drawer, school: string, title: string, subtitle: string) => {
  d.font(10, true);
  d.text(school, 28, 40);
  d.font(16, true);
  d.text(title, d.width / 2, 78, "center");
  d.font(10);
  d.text(subtitle, d.width / 2, 96, "center");
};

/** Phiếu thu học phí dạng PDF (bản demo). */
export function invoicePdf(detail: InvoiceDetail, schoolName: string): Uint8Array {
  const inv = detail.invoice;
  return canvasPdf((d) => {
    header(d, schoolName, "PHIẾU THU HỌC PHÍ", `Số: ${inv.invoiceNo ?? "(nháp)"} · ${formatMonth(inv.periodMonth)}`);
    d.text(`Trẻ: ${inv.childName} (${inv.childCode})`, 28, 126);
    d.text(`Lớp: ${inv.className ?? "—"}`, 28, 142);
    if (inv.dueDate) d.text(`Hạn nộp: ${formatDate(inv.dueDate)}`, d.width - 28, 142, "right");
    let y = d.row("Khoản thu", "Số tiền", 172, true) - 14;
    d.line(y);
    y += 20;
    for (const l of detail.lines) y = d.row(l.description, formatMoney(l.amount), y);
    d.line(y - 12);
    y = d.row("Tổng phải thu", formatMoney(inv.amountDue), y + 8);
    y = d.row("Đã thu", formatMoney(inv.amountPaid), y);
    d.row("Còn phải nộp", formatMoney(inv.balance), y, true);
  });
}

/** Phiếu lương dạng PDF (bản demo). */
export function payslipPdf(p: Payslip, allowanceLabel: (key: string) => string): Uint8Array {
  const minus = (v: number) => (v ? `−${formatMoney(v)}` : formatMoney(0));
  return canvasPdf((d) => {
    header(d, p.schoolName, "PHIẾU LƯƠNG", formatMonth(p.month));
    d.text(`Họ tên: ${p.fullName}`, 28, 126);
    d.text(`Mã NV: ${p.staffCode}`, d.width - 28, 126, "right");
    d.text(`Công: ${p.workDays} / ${p.standardWorkDays}`, 28, 142);
    let y = d.row("Lương theo công", formatMoney(p.salaryByWork), 172);
    for (const [key, value] of Object.entries(p.allowances)) y = d.row(`Phụ cấp ${allowanceLabel(key)}`, formatMoney(value), y);
    if (p.bonus) y = d.row("Thưởng", formatMoney(p.bonus), y);
    if (p.fines) y = d.row("Phạt", minus(p.fines), y);
    d.line(y - 12);
    y = d.row("Tổng thu nhập", formatMoney(p.grossSalary), y + 8, true);
    y = d.row("BHXH", minus(p.socialInsurance), y);
    y = d.row("BHYT", minus(p.healthInsurance), y);
    y = d.row("BHTN", minus(p.unemploymentInsurance), y);
    y = d.row(`Thu nhập tính thuế (${p.dependentCount} người phụ thuộc)`, formatMoney(p.taxableIncome), y);
    y = d.row("Thuế TNCN", minus(p.pit), y);
    d.line(y - 12);
    d.row("THỰC LĨNH", formatMoney(p.netSalary), y + 8, true);
  });
}

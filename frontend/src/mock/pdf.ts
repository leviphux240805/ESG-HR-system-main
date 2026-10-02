import type { components } from "@/api/schema";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";

type InvoiceDetail = components["schemas"]["InvoiceDetail"];

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

/** Phiếu thu học phí dạng PDF (bản demo); cần trình duyệt có canvas. */
export function invoicePdf(detail: InvoiceDetail, schoolName: string): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const g = canvas.getContext("2d")!;
  g.scale(SCALE, SCALE);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, PAGE_W, PAGE_H);
  g.fillStyle = "#111";
  const font = (size: number, bold = false) => (g.font = `${bold ? "bold " : ""}${size}px Arial, sans-serif`);
  const text = (s: string, x: number, y: number, align: CanvasTextAlign = "left") => {
    g.textAlign = align;
    g.fillText(s, x, y);
  };
  const line = (y: number) => {
    g.fillRect(28, y, PAGE_W - 56, 0.6);
  };

  const inv = detail.invoice;
  font(10, true);
  text(schoolName, 28, 40);
  font(16, true);
  text("PHIẾU THU HỌC PHÍ", PAGE_W / 2, 78, "center");
  font(10);
  text(`Số: ${inv.invoiceNo ?? "(nháp)"} · ${formatMonth(inv.periodMonth)}`, PAGE_W / 2, 96, "center");
  text(`Trẻ: ${inv.childName} (${inv.childCode})`, 28, 126);
  text(`Lớp: ${inv.className ?? "—"}`, 28, 142);
  if (inv.dueDate) text(`Hạn nộp: ${formatDate(inv.dueDate)}`, PAGE_W - 28, 142, "right");

  let y = 172;
  font(10, true);
  text("Khoản thu", 28, y);
  text("Số tiền", PAGE_W - 28, y, "right");
  line(y + 6);
  font(10);
  for (const l of detail.lines) {
    y += 20;
    text(l.description, 28, y);
    text(formatMoney(l.amount), PAGE_W - 28, y, "right");
  }
  line(y + 8);
  const totals: [string, number][] = [
    ["Tổng phải thu", inv.amountDue],
    ["Đã thu", inv.amountPaid],
    ["Còn phải nộp", inv.balance],
  ];
  for (const [label, value] of totals) {
    y += 20;
    font(10, label === "Còn phải nộp");
    text(label, 28, y);
    text(formatMoney(value), PAGE_W - 28, y, "right");
  }
  font(9);
  g.fillStyle = "#666";
  text("Bản demo – dữ liệu mẫu", PAGE_W / 2, PAGE_H - 28, "center");

  const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
  const jpeg = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return jpegPdf(jpeg, canvas.width, canvas.height);
}

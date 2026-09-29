import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// ============= EMAIL CONFIG =============
const SALARY_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .table td { padding: 12px 8px; border-bottom: 1px solid #eee; }
    .table td:first-child { color: #666; }
    .table td:last-child { text-align: right; font-weight: 500; }
    .total-row { background: #f8f9fa; }
    .total-row td { font-weight: bold; font-size: 1.1em; color: #667eea; border-bottom: none; }
    .negative { color: #e53e3e; }
    .footer { padding: 16px 24px; background: #f8f9fa; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Phiếu Lương Tháng {{month}}/{{year}}</h1>
    </div>
    <div class="content">
      <p>Xin chào <strong>{{employeeName}}</strong>,</p>
      <p>Dưới đây là chi tiết lương của bạn trong tháng này:</p>
      <table class="table">
        <tr><td>Ngày công chuẩn:</td><td>{{standardWorkDays}} ngày</td></tr>
        <tr><td>Ngày công thực tế:</td><td>{{totalWorkDays}} ngày</td></tr>
        <tr><td>Lương cơ bản:</td><td>{{baseSalary}}</td></tr>
        <tr><td>Phụ cấp:</td><td>{{allowances}}</td></tr>
        <tr><td>Thưởng:</td><td>{{bonus}}</td></tr>
        {{#if hasFines}}<tr class="negative"><td>Khấu trừ:</td><td>- {{fines}}</td></tr>{{/if}}
        <tr class="total-row"><td>TỔNG THỰC NHẬN:</td><td>{{totalSalary}}</td></tr>
      </table>
      <p>Cảm ơn bạn đã đóng góp cho công ty!</p>
    </div>
    <div class="footer"><p>Ensogo HR Team</p></div>
  </div>
</body>
</html>
`;

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean>,
): string {
  let result = template;
  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      return data[key] ? content : "";
    },
  );
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      String(value),
    );
  }
  return result;
}

interface PayrollRecord {
  id: string;
  month: number;
  year: number;
  standard_work_days: number;
  total_work_days: number;
  base_salary: number;
  allowances: number;
  bonus: number;
  fines: number;
  total_salary: number;
  email_sent_at?: string;
  employee?: { name: string; email: string };
}

// ============= HANDLER =============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { payrollIds } = req.body as { payrollIds: string[] };
    if (!payrollIds?.length)
      return res.status(400).json({ error: "No payroll IDs provided" });

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    );

    const { data: records, error: dbError } = await supabase
      .from("payroll_records")
      .select(`*, employee:employees(name, email)`)
      .in("id", payrollIds);

    if (dbError) {
      console.error("Database error:", dbError);
      return res.status(500).json({ error: "Failed to fetch payroll data" });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const results: { id: string; status: string; error?: string }[] = [];

    for (const record of (records || []) as PayrollRecord[]) {
      if (!record.employee?.email) {
        results.push({ id: record.id, status: "skipped", error: "No email" });
        continue;
      }

      const htmlContent = renderTemplate(SALARY_EMAIL_TEMPLATE, {
        month: record.month,
        year: record.year,
        employeeName: record.employee.name || "Nhân viên",
        standardWorkDays: record.standard_work_days,
        totalWorkDays: record.total_work_days,
        baseSalary: formatVND(record.base_salary),
        allowances: formatVND(record.allowances),
        bonus: formatVND(record.bonus),
        hasFines: record.fines > 0,
        fines: formatVND(record.fines),
        totalSalary: formatVND(record.total_salary),
      });

      try {
        await transporter.sendMail({
          from: `"Ensogo HR" <${process.env.SMTP_USER}>`,
          to: record.employee.email,
          subject: `Phiếu Lương Tháng ${record.month}/${record.year} - ${record.employee.name}`,
          html: htmlContent,
        });

        // Update DB with sent time
        await supabase
          .from("payroll_records")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", record.id);

        results.push({ id: record.id, status: "success" });
      } catch (emailErr) {
        results.push({
          id: record.id,
          status: "error",
          error: emailErr instanceof Error ? emailErr.message : "Unknown error",
        });
      }
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

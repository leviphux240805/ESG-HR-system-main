import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Email template for salary payslip
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
        <tr>
          <td>Ngày công chuẩn:</td>
          <td>{{standardWorkDays}} ngày</td>
        </tr>
        <tr>
          <td>Ngày công thực tế:</td>
          <td>{{totalWorkDays}} ngày</td>
        </tr>
        <tr>
          <td>Lương cơ bản:</td>
          <td>{{baseSalary}}</td>
        </tr>
        <tr>
          <td>Phụ cấp:</td>
          <td>{{allowances}}</td>
        </tr>
        <tr>
          <td>Thưởng:</td>
          <td>{{bonus}}</td>
        </tr>
        {{#if hasFines}}
        <tr class="negative">
          <td>Khấu trừ:</td>
          <td>- {{fines}}</td>
        </tr>
        {{/if}}
        <tr class="total-row">
          <td>TỔNG THỰC NHẬN:</td>
          <td>{{totalSalary}}</td>
        </tr>
      </table>

      <p>Cảm ơn bạn đã đóng góp cho công ty!</p>
    </div>
    <div class="footer">
      <p>Ensogo HR Team</p>
    </div>
  </div>
</body>
</html>
`;

// Format number as VND
function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Simple template rendering (replace {{variable}} with values)
function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean>,
): string {
  let result = template;

  // Handle {{#if condition}}...{{/if}} blocks
  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      return data[key] ? content : "";
    },
  );

  // Replace {{variable}} placeholders
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      String(value),
    );
  }

  return result;
}

// Create transporter
function createTransporter(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Payroll record type (from database)
export interface PayrollRecord {
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
  employee?: {
    name: string;
    email: string;
  };
}

// Send salary email
export async function sendSalaryEmail(
  record: PayrollRecord,
): Promise<{ success: boolean; error?: string }> {
  const transporter = createTransporter();

  if (!record.employee?.email) {
    return { success: false, error: "No email address" };
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
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Send test email
export async function sendTestEmail(
  to: string,
): Promise<{ success: boolean; error?: string }> {
  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: `"Ensogo HR Test" <${process.env.SMTP_USER}>`,
      to,
      subject: "Test Email from Ensogo HR",
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from Ensogo HR system.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

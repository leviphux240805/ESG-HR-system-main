import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * File cũ từ ESG HR còn gọi Supabase, sẽ viết lại ở giai đoạn 2–4 (xem docs/tien-do.md).
 * Tạm hạ no-explicit-any xuống cảnh báo cho riêng các file này; chuyển đổi xong file nào thì xóa khỏi danh sách.
 */
const legacyFiles = [
  "api/**/*.ts",
  "src/components/attendance/AttendanceConfigModal.tsx",
  "src/components/attendance/AttendanceUploadModal.tsx",
  "src/components/employees/DependentModal.tsx",
  "src/components/employees/EmployeeModal.tsx",
  "src/components/employees/shared/CCCDUploadModal.tsx",
  "src/hooks/useAttendanceData.ts",
  "src/hooks/useEmployee.ts",
  "src/lib/attendanceReconciliation.ts",
  "src/pages/Employees.tsx",
  "src/pages/Payroll.tsx",
];

export default tseslint.config(
  { ignores: ["dist", "src/api/schema.d.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: legacyFiles,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);

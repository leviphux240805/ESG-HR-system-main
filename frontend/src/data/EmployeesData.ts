import { Payslip } from "@/types";

// Mock payroll periods
export const payrollPeriods = [
  "Tháng 12 2024",
  "Tháng 11 2024",
  "Tháng 10 2024",
  "Tháng 9 2024",
  "Tháng 8 2024",
];

// Mock payslips data
export const payslips: Payslip[] = [
  {
    id: "PS001",
    employeeId: "EMP001",
    employeeName: "Nguyễn Văn An",
    period: "Tháng 12 2024",
    grossAmount: 25000000,
    netAmount: 21250000,
    status: "paid",
    paidDate: "2024-12-25",
  },
  {
    id: "PS002",
    employeeId: "EMP002",
    employeeName: "Trần Thị Bình",
    period: "Tháng 12 2024",
    grossAmount: 18000000,
    netAmount: 15300000,
    status: "pending",
  },
  {
    id: "PS003",
    employeeId: "EMP003",
    employeeName: "Lê Văn Cường",
    period: "Tháng 12 2024",
    grossAmount: 22000000,
    netAmount: 18700000,
    status: "paid",
    paidDate: "2024-12-25",
  },
  {
    id: "PS004",
    employeeId: "EMP004",
    employeeName: "Phạm Thị Dung",
    period: "Tháng 12 2024",
    grossAmount: 20000000,
    netAmount: 17000000,
    status: "pending",
  },
  {
    id: "PS005",
    employeeId: "EMP005",
    employeeName: "Hoàng Văn Em",
    period: "Tháng 12 2024",
    grossAmount: 28000000,
    netAmount: 23800000,
    status: "paid",
    paidDate: "2024-12-25",
  },
  {
    id: "PS006",
    employeeId: "EMP001",
    employeeName: "Nguyễn Văn An",
    period: "Tháng 11 2024",
    grossAmount: 25000000,
    netAmount: 21250000,
    status: "paid",
    paidDate: "2024-11-25",
  },
  {
    id: "PS007",
    employeeId: "EMP002",
    employeeName: "Trần Thị Bình",
    period: "Tháng 11 2024",
    grossAmount: 18000000,
    netAmount: 15300000,
    status: "paid",
    paidDate: "2024-11-25",
  },
];

// Mock employees for attendance
export const mockEmployeesForAttendance = [
  { id: 1, employeeID: "EMP001", name: "Nguyễn Văn An", department: "Kỹ thuật", position: "Lập trình viên" },
  { id: 2, employeeID: "EMP002", name: "Trần Thị Bình", department: "Nhân sự", position: "Trưởng phòng" },
  { id: 3, employeeID: "EMP003", name: "Lê Văn Cường", department: "Marketing", position: "Chuyên viên" },
  { id: 4, employeeID: "EMP004", name: "Phạm Thị Dung", department: "Kế toán", position: "Kế toán viên" },
  { id: 5, employeeID: "EMP005", name: "Hoàng Văn Em", department: "Kỹ thuật", position: "Team Lead" },
];

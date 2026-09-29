import {
  DollarSign,
  Users,
  Calendar,
  AlertCircle,
  TrendingUp,
  Eye,
  Briefcase,
  Cake,
  CalendarDays,
} from "lucide-react";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployee";
import { usePayrollData } from "@/hooks/usePayrollData";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { employees, loading: employeesLoading } = useEmployees();

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Fetch payroll data for current month to show financial stats
  // Defaulting standard work days to 26 for estimation
  const { payrollRecords, isLoading: payrollLoading } = usePayrollData(
    currentYear,
    currentMonth,
    26,
  );

  const stats = useMemo(() => {
    // 1. Total Employees
    const totalEmployees = employees.length;

    // 2. Estimated Salary (Total Base Salary of all employees)
    // We use base_salary from employees table as a quick estimate
    const totalBaseSalary = employees.reduce(
      (sum, emp) => sum + (emp.base_salary || 0),
      0,
    );

    // 3. Payroll Status for current month
    // If payroll records exist, use that total. Otherwise use estimated base.
    const currentPayrollTotal =
      payrollRecords.length > 0
        ? payrollRecords.reduce((sum, record) => sum + record.total_salary, 0)
        : totalBaseSalary;

    // 4. Missing Vital Info
    // Count employees missing key fields: citizen_id, phone, bank_account_no
    const missingInfoCount = employees.filter(
      (emp) => !emp.citizen_id || !emp.phone || !emp.bank_account_no,
    ).length;

    // 5. Department Data for Chart
    const deptMap = new Map<string, number>();
    employees.forEach((emp) => {
      const dept = emp.department || "Chưa phân loại";
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    // Convert to array and handle empty department case
    const departmentData = Array.from(deptMap.entries()).map(
      ([name, value]) => ({
        name: name === "" ? "Khác" : name,
        value,
      }),
    );

    // 6. Salary Range Data
    const ranges = {
      under10m: 0,
      between10and20m: 0,
      over20m: 0,
    };

    employees.forEach((emp) => {
      const salary = emp.base_salary || 0;
      if (salary < 10000000) ranges.under10m++;
      else if (salary < 20000000) ranges.between10and20m++;
      else ranges.over20m++;
    });

    const salaryData = [
      { name: "< 10M", value: ranges.under10m },
      { name: "10M - 20M", value: ranges.between10and20m },
      { name: "> 20M", value: ranges.over20m },
    ];

    // 7. Upcoming Birthdays (Current Month)
    const birthdays = employees
      .filter((emp) => {
        if (!emp.dob) return false;
        const dobDate = new Date(emp.dob);
        return dobDate.getMonth() === currentMonth;
      })
      .map((emp) => ({
        name: emp.name,
        day: new Date(emp.dob!).getDate(),
        dept: emp.department,
      }))
      .sort((a, b) => a.day - b.day);

    // 8. Expiring Contracts (Next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const expiringContracts = employees
      .filter((emp) => {
        if (!emp.end_date) return false;
        const end = new Date(emp.end_date);
        return end >= today && end <= thirtyDaysFromNow;
      })
      .map((emp) => ({
        name: emp.name,
        date: new Date(emp.end_date!).toLocaleDateString("vi-VN"),
        dept: emp.department,
      }));

    return {
      totalEmployees,
      financialTotal: currentPayrollTotal,
      missingInfoCount,
      isDraft: payrollRecords.length === 0,
      departmentData,
      salaryData,
      birthdays,
      expiringContracts,
    };
  }, [employees, payrollRecords, currentMonth, today]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const metrics = [
    {
      title: "Tổng Dự Toán Lương",
      value: formatCurrency(stats.financialTotal),
      change: stats.isDraft ? "Dự kiến" : "Thực tế",
      changeType: "neutral",
      icon: DollarSign,
      description: `Tháng ${currentMonth + 1}/${currentYear}`,
    },
    {
      title: "Nhân Sự",
      value: stats.totalEmployees.toString(),
      change: "Đang hoạt động",
      changeType: "positive",
      icon: Users,
      description: "Tổng số nhân viên",
    },
    {
      title: "Thông Tin Thiếu",
      value: stats.missingInfoCount.toString(),
      change: stats.missingInfoCount > 0 ? "Cần cập nhật" : "Đầy đủ",
      changeType: stats.missingInfoCount > 0 ? "negative" : "positive",
      icon: AlertCircle,
      description: "Nhân viên thiếu CCCD/SĐT/TK NH",
    },
  ];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bảng điều khiển
          </h1>
          <p className="text-muted-foreground mt-1">
            Tổng quan tình hình nhân sự tháng {currentMonth + 1}/{currentYear}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric, index) => (
            <div
              key={metric.title}
              className="metric-card animate-slide-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {metric.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.description}
                  </p>
                </div>
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    metric.changeType === "negative"
                      ? "bg-red-100 text-red-600"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <metric.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    metric.changeType === "positive" && "text-green-600",
                    metric.changeType === "negative" && "text-red-600",
                    metric.changeType === "neutral" && "text-blue-600",
                  )}
                >
                  {metric.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Distribution */}
          <div className="bg-card rounded-xl card-shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Phân Bổ Phòng Ban</h3>
                <p className="text-sm text-muted-foreground">
                  Số lượng nhân viên theo bộ phận
                </p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.departmentData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar dataKey="value" name="Nhân viên" radius={[4, 4, 0, 0]}>
                    {stats.departmentData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Salary Range Distribution */}
          <div className="bg-card rounded-xl card-shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Phân Bổ Mức Lương</h3>
                <p className="text-sm text-muted-foreground">
                  Thống kê theo mức lương cơ bản
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salaryData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="Nhân viên"
                    fill="#8884d8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Info Lists Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Birthdays */}
          <div className="bg-card rounded-xl card-shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pink-100 rounded-lg">
                <Cake className="w-5 h-5 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold">
                Sinh Nhật Tháng {currentMonth + 1}
              </h3>
            </div>
            <div className="space-y-4">
              {stats.birthdays.length > 0 ? (
                stats.birthdays.map((emp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-xs">
                        {emp.day}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.dept}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium bg-background px-2 py-1 rounded border">
                      {emp.day}/{currentMonth + 1}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Không có sinh nhật nào trong tháng này
                </p>
              )}
            </div>
          </div>

          {/* Expiring Contracts */}
          <div className="bg-card rounded-xl card-shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CalendarDays className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold">
                Hợp Đồng Hết Hạn (30 ngày)
              </h3>
            </div>
            <div className="space-y-4">
              {stats.expiringContracts.length > 0 ? (
                stats.expiringContracts.map((emp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg border border-orange-100"
                  >
                    <div>
                      <p className="font-medium text-sm">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.dept}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-orange-600">
                        Hết hạn: {emp.date}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Không có hợp đồng nào sắp hết hạn
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Employee Overview */}
        <div
          className="bg-card rounded-xl card-shadow animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Nhân Viên Mới
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Danh sách 5 nhân viên gần đây nhất
                </p>
              </div>
              <button
                onClick={() => navigate("/employees")}
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                Xem Tất Cả
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {employeesLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Đang tải...
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                      ID
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                      Họ Tên
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                      Email
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                      Số điện thoại
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                      Phòng Ban
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                      Lương Cơ Bản
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.slice(0, 5).map((employee, index) => (
                    <tr
                      key={employee.id}
                      className="hover:bg-muted/30 transition-colors animate-slide-in"
                      style={{ animationDelay: `${400 + index * 50}ms` }}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-foreground">
                          {employee.employeeID}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {employee.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {employee.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">
                          {employee.email || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">
                          {employee.phone || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">
                          {employee.department}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(employee.base_salary || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground"
                      >
                        Chưa có dữ liệu nhân viên
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

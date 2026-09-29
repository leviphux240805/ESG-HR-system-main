import { useState } from "react";
import { Search, Plus, Eye, Trash2 } from "lucide-react";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { EditableCell } from "@/components/employees/EditableCell";
import { EmployeeModal } from "@/components/employees/EmployeeModal";
import { ConfirmModal } from "@/components/employees/shared/ConfirmModal";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/hooks/useEmployee";
import { Employee } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Employees() {
  const {
    employees,
    loading,
    error,
    updateName,
    updateBaseSalary,
    updateAllowance,
    deleteEmployee,
    updateEmployee,
  } = useEmployees();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);

  const filteredEmployees = employees.filter(
    (emp) =>
      (emp.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (emp.department?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (emp.employeeID?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  const handleSaveEmployee = async (formData: any) => {
    if (!selectedEmployee) return;

    const updateData = {
      // === Tab 1: Personal Info ===
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      dob: formData.dateOfBirth || null,
      gender: formData.gender,
      citizen_id: formData.legal?.cccdNumber || null,
      // Address - Permanent
      perm_province: formData.permanentAddress?.perm_province || null,
      perm_district: formData.permanentAddress?.perm_district || null,
      perm_detail: formData.permanentAddress?.perm_detail || null,
      // Address - Current
      is_same_address: formData.currentAddress?.sameAsPermanent,
      curr_province: formData.currentAddress?.province || null,
      curr_district: formData.currentAddress?.district || null,
      curr_detail: formData.currentAddress?.detail || null,

      // === Tab 2: Labor Records ===
      contract_number: formData.laborContract?.contractNumber || null,
      department: formData.department || null,
      position: formData.position || null,
      level: formData.level || null,

      // === Tab 3: Salary Config ===
      salary_mode: formData.salaryConfig?.mode,
      salary_region: formData.salaryConfig?.region,
      base_salary: formData.salaryConfig?.baseSalary,
      salary_coefficient: formData.salaryConfig?.coefficient,
      // Allowances
      allowance_lunch: Number(formData.salaryConfig?.allowanceLunch || 0),
      allowance_transport: Number(
        formData.salaryConfig?.allowanceTransport || 0,
      ),
      allowance_phone: Number(formData.salaryConfig?.allowancePhone || 0),
      allowance_responsibility: Number(
        formData.salaryConfig?.allowanceResponsibility || 0,
      ),
      allowance_position: Number(formData.salaryConfig?.allowancePosition || 0),
      allowance_seniority_percent: Number(
        formData.salaryConfig?.allowanceSeniority || 0,
      ),
      allowance_other: Number(formData.salaryConfig?.allowanceOther || 0),
      // Bonus & Commission
      bonus_amount: Number(formData.salaryConfig?.bonusAmount || 0),
      commission_rate: Number(formData.salaryConfig?.commissionRate || 0),
      other_support: Number(formData.salaryConfig?.otherSupport || 0),
      // Payment & Bank
      payment_method: formData.salaryConfig?.paymentMethod || null,
      bank_name: formData.salaryConfig?.bankName || null,
      bank_account_no: formData.salaryConfig?.accountNumber || null,
      bank_account_holder: formData.salaryConfig?.accountHolder || null,

      // === Tab 4: Insurance & Tax ===
      social_insurance_no: formData.socialInsurance?.bhxhNumber || null,
      // is_verified_bhxh removed
      bhxh_status: formData.socialInsurance?.bhxhStatus || null,
      bhyt_status: formData.socialInsurance?.bhytStatus || null,
      bhtn_status: formData.socialInsurance?.bhtnStatus || null,
      insurance_contribution_amount:
        formData.socialInsurance?.contributionAmount || null,
      insurance_contribution_period:
        formData.socialInsurance?.contributionPeriod || null,
      health_insurance_card_id: formData.healthInsurance?.cardNumber || null,
      medical_province_id: formData.healthInsurance?.kcbProvince || null,
      medical_hospital_id: formData.healthInsurance?.kcbHospital || null,

      // === Tab 5: Skills & Development ===
      education_level: formData.skillsDevelopment?.educationLevel || null,
      work_experience: formData.skillsDevelopment?.workExperience || null,
      kpi_results: formData.skillsDevelopment?.kpiResults || null,
      idp_plan: formData.skillsDevelopment?.idpPlan || null,

      // === Tab 6: Work Time & Leave ===
      standard_working_hours:
        formData.workTimeLeave?.standardWorkingHours || null,
      actual_working_days: formData.workTimeLeave?.actualWorkingDays || null,
      annual_leave_days: formData.workTimeLeave?.annualLeaveDays || null,
      sick_leave_days: formData.workTimeLeave?.sickLeaveDays || null,
      maternity_leave_days: formData.workTimeLeave?.maternityLeaveDays || null,
      unpaid_leave_days: formData.workTimeLeave?.unpaidLeaveDays || null,
    };

    await updateEmployee(selectedEmployee.id, updateData);

    // Update local selected employee state to reflect changes immediately in the open modal
    setSelectedEmployee((prev) => (prev ? { ...prev, ...updateData } : null));
  };

  // const handleDelete = (id: string) => {
  //   setEmployees((prev) => prev.filter((emp) => emp.id !== id));
  //   toast.success("Employee deleted successfully");
  // };

  const confirmDeleteEmployee = async () => {
    if (deleteEmployeeId) {
      await deleteEmployee(deleteEmployeeId);
      setDeleteEmployeeId(null);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nhân viên</h1>
            <p className="text-muted-foreground mt-1">
              Quản lý lực lượng lao động của tổ chức bạn
            </p>
          </div>
          {/* <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Thêm nhân viên
          </Button> */}
        </div>

        {/* Search & Filters */}
        <div className="bg-card rounded-xl card-shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, phòng ban hoặc ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md pl-11 pr-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-card rounded-xl card-shadow overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {filteredEmployees.length}
              </span>{" "}
              nhân viên được tìm thấy
              <span className="mx-2">·</span>
              <span className="text-xs">
                Nhấp đúp vào Tên hoặc Lương để chỉnh sửa
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                </div>
                <p className="text-muted-foreground">
                  Đang tải dữ liệu nhân viên...
                </p>
              </div>
            ) : (
              <>
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
                      <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((employee, index) => (
                      <tr
                        key={employee.id}
                        className="hover:bg-muted/30 transition-colors animate-slide-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-foreground">
                            {employee.employeeID}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <EditableCell
                            value={employee.name}
                            onSave={(value) => updateName(employee.id, value)}
                            className="text-sm font-medium text-foreground"
                          />
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
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleViewDetails(employee)}
                                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Xem chi tiết</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() =>
                                    setDeleteEmployeeId(employee.id)
                                  }
                                  className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Xóa</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredEmployees.length === 0 && !loading && (
                  <div className="p-12 text-center">
                    <p className="text-muted-foreground">
                      Không tìm thấy nhân viên phù hợp với tìm kiếm của bạn.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Employee Details Modal */}
        <EmployeeModal
          employee={selectedEmployee}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSave={handleSaveEmployee}
        />

        <ConfirmModal
          open={!!deleteEmployeeId}
          onOpenChange={(open) => !open && setDeleteEmployeeId(null)}
          onConfirm={confirmDeleteEmployee}
          title="Xóa nhân viên"
          description="Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác."
          confirmText="Xóa"
          variant="destructive"
        />
      </div>
    </AuthenticatedLayout>
  );
}

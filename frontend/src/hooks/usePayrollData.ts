import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface EmployeeWithSalary {
  id: string;
  employeeID: string;
  name: string;
  email?: string;
  base_salary: number;
  allowance_lunch: number;
  allowance_transport: number;
  allowance_phone: number;
  allowance_responsibility: number;
  allowance_other: number;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  total_work_days: number;
  standard_work_days: number;
  base_salary: number;
  allowances: number;
  bonus: number;
  fines: number;
  total_salary: number;
  status: "draft" | "final";
  is_paid: boolean;
  payment_date: string | null;
  email_sent_at: string | null;
  updated_at?: string;
  employee?: EmployeeWithSalary;
}

interface UsePayrollDataReturn {
  employees: EmployeeWithSalary[];
  payrollRecords: PayrollRecord[];
  isLoading: boolean;
  isCalculating: boolean;
  calculatePayroll: (
    stdWorkDays: number,
    emps?: EmployeeWithSalary[],
  ) => Promise<boolean>;
  updatePayrollField: (
    id: string,
    employeeId: string,
    field: "bonus" | "fines" | "base_salary",
    value: number,
  ) => Promise<boolean>;
  markAsPaid: (ids: string[]) => Promise<boolean>;
  finalizePayroll: () => Promise<boolean>;
  refetch: () => Promise<{
    employees: EmployeeWithSalary[];
    payrollRecords: PayrollRecord[];
  }>;
}

function calculateTotalAllowances(emp: EmployeeWithSalary): number {
  return (
    (emp.allowance_lunch || 0) +
    (emp.allowance_transport || 0) +
    (emp.allowance_phone || 0) +
    (emp.allowance_responsibility || 0) +
    (emp.allowance_other || 0)
  );
}

export function usePayrollData(
  year: number,
  month: number,
  standardWorkDays: number,
): UsePayrollDataReturn {
  const [employees, setEmployees] = useState<EmployeeWithSalary[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const monthDateStr = useMemo(
    () => `${year}-${String(month + 1).padStart(2, "0")}-01`,
    [year, month],
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch employees with salary info
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select(
          "id, employeeID, name, email, base_salary, allowance_lunch, allowance_transport, allowance_phone, allowance_responsibility, allowance_other",
        )
        .order("name");

      if (empError) throw empError;
      setEmployees(empData || []);

      // 2. Fetch payroll records for the month
      const { data: payrollData, error: payrollError } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("month", month + 1)
        .eq("year", year);

      if (payrollError) throw payrollError;

      // 3. Fetch attendance summaries for the month (for auto-sync)
      const monthDateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const { data: summaries, error: summaryError } = await supabase
        .from("attendance_monthly_summaries")
        .select("employee_id, total_work")
        .eq("month_date", monthDateStr);

      if (summaryError)
        console.error("Error fetching summaries for sync:", summaryError);

      // 4. Auto-Sync Logic
      // Check for discrepancies between Payroll (Draft) and Attendance Summary
      const summaryMap = new Map(
        (summaries || []).map((s) => [s.employee_id, s.total_work || 0]),
      );

      const recordsToUpdate: Partial<PayrollRecord>[] = [];
      let hasUpdates = false;

      // Map current payroll data to easily update it
      let currentRecords = payrollData || [];

      if (summaries && summaries.length > 0) {
        currentRecords = currentRecords.map((record) => {
          // Only check Draft records
          if (record.status !== "final") {
            const latestWorkDays = summaryMap.get(record.employee_id);

            // If we have attendance data and it differs from payroll record
            if (
              latestWorkDays !== undefined &&
              latestWorkDays !== record.total_work_days
            ) {
              hasUpdates = true;

              // Recalculate
              const newWorkDays = latestWorkDays;
              const workRatio =
                record.standard_work_days > 0
                  ? newWorkDays / record.standard_work_days
                  : 0;
              const calculatedBase = Math.round(record.base_salary * workRatio);
              const newTotalSalary =
                calculatedBase +
                record.allowances +
                record.bonus -
                record.fines;

              const updatedRecord = {
                ...record,
                total_work_days: newWorkDays,
                total_salary: newTotalSalary,
                updated_at: new Date().toISOString(),
              };

              // Prepare for DB update
              recordsToUpdate.push({
                id: record.id,
                employee_id: record.employee_id,
                month: record.month,
                year: record.year,
                total_work_days: newWorkDays,
                total_salary: newTotalSalary,
                updated_at: new Date().toISOString(),
              });

              return updatedRecord;
            }
          }
          return record;
        });
      }

      // 5. Apply updates to DB if needed
      if (hasUpdates && recordsToUpdate.length > 0) {
        // We use upsert for specific fields or update in loop.
        // Supabase upsert is good for batches if PK is provided.
        const { error: updateError } = await supabase
          .from("payroll_records")
          .upsert(recordsToUpdate, { onConflict: "id" });

        if (updateError) {
          console.error("Auto-sync failed:", updateError);
          toast.error("Lỗi đồng bộ dữ liệu công tự động");
        } else {
          // Optional: notify user or just silently update?
          // User requested "automatic", so silent is usually better, strictly speaking.
          // But a small toast might be nice for transparency.
          // toast.info("Đã cập nhật dữ liệu công mới nhất");
        }
      }

      // 6. Attach employee data to payroll records (using potentially updated records)
      const recordsWithEmployee = currentRecords.map((record) => ({
        ...record,
        employee: empData?.find((e) => e.id === record.employee_id),
      }));

      setPayrollRecords(recordsWithEmployee);
      return { employees: empData || [], payrollRecords: recordsWithEmployee };
    } catch (err) {
      console.error("Error fetching payroll data:", err);
      toast.error("Lỗi tải dữ liệu lương");
      return { employees: [], payrollRecords: [] };
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-calculate on load if no records exist
  useEffect(() => {
    const init = async () => {
      const { employees: emps, payrollRecords: records } = await fetchData();
      if (records.length === 0 && emps.length > 0 && standardWorkDays > 0) {
        await calculatePayroll(standardWorkDays, emps);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, standardWorkDays]);

  const calculatePayroll = useCallback(
    async (
      stdWorkDays: number,
      emps?: EmployeeWithSalary[],
    ): Promise<boolean> => {
      setIsCalculating(true);
      try {
        const employeeList = emps || employees;
        if (!employeeList.length) return false;

        // Fetch attendance summaries for the month
        const { data: summaries } = await supabase
          .from("attendance_monthly_summaries")
          .select("employee_id, total_work")
          .eq("month_date", monthDateStr);

        const summaryMap = new Map(
          (summaries || []).map((s) => [s.employee_id, s.total_work || 0]),
        );

        const upsertData = employeeList.map((emp) => {
          const totalWorkDays = summaryMap.get(emp.id) || 0;
          const workRatio = stdWorkDays > 0 ? totalWorkDays / stdWorkDays : 0;
          const baseSalary = emp.base_salary || 0;
          const allowances = calculateTotalAllowances(emp);
          const calculatedBase = Math.round(baseSalary * workRatio);
          const totalSalary = calculatedBase + allowances;

          return {
            employee_id: emp.id,
            month: month + 1,
            year: year,
            total_work_days: totalWorkDays,
            standard_work_days: stdWorkDays,
            base_salary: baseSalary,
            allowances: allowances,
            bonus: 0,
            fines: 0,
            total_salary: totalSalary,
            status: "draft",
            is_paid: false,
          };
        });

        const { error } = await supabase
          .from("payroll_records")
          .upsert(upsertData, { onConflict: "employee_id,month,year" });

        if (error) throw error;

        await fetchData();
        toast.success("Đã tính lương!");
        return true;
      } catch (err) {
        console.error("Error calculating payroll:", err);
        toast.error("Lỗi tính lương");
        return false;
      } finally {
        setIsCalculating(false);
      }
    },
    [employees, month, year, monthDateStr, fetchData],
  );

  const updatePayrollField = useCallback(
    async (
      id: string,
      employeeId: string,
      field: "bonus" | "fines" | "base_salary",
      value: number,
    ): Promise<boolean> => {
      try {
        const record = payrollRecords.find((r) => r.id === id);
        if (!record) return false;

        // Recalculate total salary
        let newBonus = record.bonus;
        let newFines = record.fines;
        let newBaseSalary = record.base_salary;

        if (field === "bonus") newBonus = value;
        if (field === "fines") newFines = value;
        if (field === "base_salary") newBaseSalary = value;

        const workRatio =
          record.standard_work_days > 0
            ? record.total_work_days / record.standard_work_days
            : 0;
        const calculatedBase = Math.round(newBaseSalary * workRatio);
        const newTotalSalary =
          calculatedBase + record.allowances + newBonus - newFines;

        const { error } = await supabase
          .from("payroll_records")
          .update({
            [field]: value,
            total_salary: newTotalSalary,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) throw error;

        // If updating base_salary, also update the employees table
        if (field === "base_salary") {
          await supabase
            .from("employees")
            .update({ base_salary: value })
            .eq("id", employeeId);
        }

        await fetchData();
        return true;
      } catch (err) {
        console.error("Error updating payroll field:", err);
        toast.error("Lỗi cập nhật");
        return false;
      }
    },
    [payrollRecords, fetchData],
  );

  const markAsPaid = useCallback(
    async (ids: string[]): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("payroll_records")
          .update({
            is_paid: true,
            payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);

        if (error) throw error;

        await fetchData();
        toast.success(`Đã đánh dấu ${ids.length} phiếu lương đã thanh toán!`);
        return true;
      } catch (err) {
        console.error("Error marking as paid:", err);
        toast.error("Lỗi đánh dấu thanh toán");
        return false;
      }
    },
    [fetchData],
  );

  const finalizePayroll = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("payroll_records")
        .update({ status: "final", updated_at: new Date().toISOString() })
        .eq("month", month + 1)
        .eq("year", year);

      if (error) throw error;

      await fetchData();
      toast.success("Đã chốt bảng lương!");
      return true;
    } catch (err) {
      console.error("Error finalizing payroll:", err);
      toast.error("Lỗi chốt lương");
      return false;
    }
  }, [month, year, fetchData]);

  return {
    employees,
    payrollRecords,
    isLoading,
    isCalculating,
    calculatePayroll,
    updatePayrollField,
    markAsPaid,
    finalizePayroll,
    refetch: fetchData,
  };
}

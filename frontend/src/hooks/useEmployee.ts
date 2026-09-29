import { useEffect, useState, useCallback } from "react"; // 1. Import useCallback
import { supabase } from "@/lib/supabase";
import { Employee } from "@/types";
import { toast } from "sonner";

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("employeeID", { ascending: true });

      if (error) throw error;

      setEmployees(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const backupOldEmployees = () => {
    const originalEmployees = [...employees];
    return originalEmployees;
  };

  const updateName = async (id: string, newName: string) => {
    const originalEmployees = backupOldEmployees();

    try {
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === id ? { ...emp, name: newName } : emp))
      );

      const { error } = await supabase
        .from("employees")
        .update({ name: newName })
        .eq("id", id);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi: " + err.message);
      setEmployees(originalEmployees);
    }
  };

  const updateBaseSalary = async (id: string, newBaseSalary: number) => {
    const originalEmployees = backupOldEmployees();

    try {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === id ? { ...emp, base_salary: newBaseSalary } : emp
        )
      );
      const { error } = await supabase
        .from("employees")
        .update({ base_salary: newBaseSalary })
        .eq("id", id);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi: " + err.message);
      setEmployees(originalEmployees);
    }
  };

  const updateAllowance = async (id: string, newAllowance: number) => {
    const originalEmployees = backupOldEmployees();

    try {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === id ? { ...emp, allowance: newAllowance } : emp
        )
      );
      const { error } = await supabase
        .from("employees")
        .update({ allowance: newAllowance })
        .eq("id", id)
        .select();

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi: " + err.message);
      setEmployees(originalEmployees);
    }
  };

  const deleteEmployee = async (id: string) => {
    const originalEmployees = backupOldEmployees();

    try {
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      const { error } = await supabase.from("employees").delete().eq("id", id);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi: " + err.message);
      setEmployees(originalEmployees);
    }
  };

  const updateEmployee = async (id: string, updatedData: Partial<Employee>) => {
    const originalEmployees = backupOldEmployees();

    try {
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === id ? { ...emp, ...updatedData } : emp))
      );

      const { error } = await supabase
        .from("employees")
        .update(updatedData)
        .eq("id", id);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi: " + err.message);
      setEmployees(originalEmployees);
    }
  };

  const getSalaryHistory = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from("salary_adjustments")
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_date", { ascending: false });

      if (error) throw error;
      
      // Map DB fields to frontend interface
      return data.map(item => ({
        id: item.id,
        effectiveDate: item.effective_date,
        previousSalary: item.previous_salary,
        newSalary: item.new_salary,
        reason: item.reason
      }));
    } catch (err: any) {
      console.error("Error fetching salary history:", err);
      return [];
    }
  };

  const updateSalaryWithHistory = async (
    id: string, 
    oldSalary: number, 
    newSalary: number, 
    effectiveDate: string, 
    reason: string
  ) => {
    const originalEmployees = backupOldEmployees();

    try {
      // 1. Update local state for immediate feedback
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === id ? { ...emp, base_salary: newSalary } : emp
        )
      );

      // 2. Update employees table
      const { error: empError } = await supabase
        .from("employees")
        .update({ base_salary: newSalary })
        .eq("id", id);

      if (empError) throw empError;

      // 3. Insert into salary_adjustments
      const { error: histError } = await supabase
        .from("salary_adjustments")
        .insert({
          employee_id: id,
          previous_salary: oldSalary,
          new_salary: newSalary,
          effective_date: effectiveDate,
          reason: reason
        });

      if (histError) throw histError;

      toast.success("Cập nhật lương thành công");
      return true;
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi: " + err.message);
      setEmployees(originalEmployees);
      return false;
    }
  };

  const getDependents = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("employee_id", employeeId);

      if (error) throw error;

      return data.map((d) => ({
        id: d.id,
        name: d.name,
        relationship: d.relationship,
        dateOfBirth: d.date_of_birth,
        idNumber: d.id_number,
      }));
    } catch (err: any) {
      toast.error("Lỗi tải người phụ thuộc: " + err.message);
      return [];
    }
  };

  const addDependent = async (
    employeeId: string,
    dependent: {
      name: string;
      relationship: string;
      dateOfBirth: string;
      idNumber: string;
    }
  ) => {
    try {
      const { data, error } = await supabase
        .from("dependents")
        .insert({
          employee_id: employeeId,
          name: dependent.name,
          relationship: dependent.relationship,
          date_of_birth: dependent.dateOfBirth,
          id_number: dependent.idNumber,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Thêm người phụ thuộc thành công");
      return data;
    } catch (err: any) {
      toast.error("Lỗi thêm người phụ thuộc: " + err.message);
      return null;
    }
  };

  const deleteDependent = async (id: string) => {
    try {
      const { error } = await supabase.from("dependents").delete().eq("id", id);
      if (error) throw error;
      toast.success("Xóa người phụ thuộc thành công");
      return true;
    } catch (err: any) {
      toast.error("Lỗi xóa người phụ thuộc: " + err.message);
      return false;
    }
  };


  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees,
    updateName,
    updateBaseSalary,
    updateAllowance,
    deleteEmployee,
    updateEmployee,
    getSalaryHistory,
    updateSalaryWithHistory,
    getDependents,
    addDependent,
    deleteDependent,
  };
};

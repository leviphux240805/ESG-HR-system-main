import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  employeeFormSchema,
  EmployeeFormData,
} from "@/components/employees/schemas/employeeFormSchema";
import { Employee } from "@/types";

export function useEmployeeForm(employee: Employee | null, isOpen: boolean) {
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: employee?.name ?? "",
      employeeID: employee?.employeeID ?? "",
      email: employee?.email ?? "",
      phone: employee?.phone ?? "",
      dateOfBirth: employee?.dob ?? "",
      gender: employee?.gender ?? null,
      position: employee?.position ?? "",
      level: employee?.level ?? "",
      department: employee?.department ?? "",
      permanentAddress: {
        perm_province: employee?.perm_province ?? "",
        perm_district: employee?.perm_district ?? "",
        perm_detail: employee?.perm_detail ?? "",
      },
      currentAddress: {
        sameAsPermanent: employee?.is_same_address ?? false,
        province: employee?.curr_province ?? "",
        district: employee?.curr_district ?? "",
        ward: employee?.curr_ward ?? "",
        detail: employee?.curr_detail ?? "",
      },
      laborContract: {
        contractNumber: employee?.contract_number ?? "",
        contractFile: employee?.labor_contract_file ?? null,
        startDate: employee?.start_date ?? "",
        endDate: employee?.end_date ?? "",
        acceptanceDecisionFile: employee?.acceptance_decision_file ?? null,
        appointmentDecisionFile: employee?.appointment_decision_file ?? null,
        transferDecisionFile: employee?.transfer_decision_file ?? null,
        terminationDecisionFile: employee?.termination_decision_file ?? null,
        ndaFile: employee?.nda_file ?? null,
        nonCompeteFile: employee?.non_compete_file ?? null,
      },
      socialInsurance: {
        bhxhNumber: employee?.social_insurance_no ?? "",
        verified: employee?.is_verified_bhxh ?? false,
        bhxhStatus: employee?.bhxh_status ?? "",
        bhytStatus: employee?.bhyt_status ?? "",
        bhtnStatus: employee?.bhtn_status ?? "",
        contributionAmount: employee?.insurance_contribution_amount ?? 0,
        contributionPeriod: employee?.insurance_contribution_period ?? "",
      },
      healthInsurance: {
        cardNumber: employee?.health_insurance_card_id ?? "",
        kcbProvince: employee?.medical_province_id ?? "",
        kcbHospital: employee?.medical_hospital_id ?? "",
      },
      legal: {
        cccdNumber: employee?.citizen_id ?? "",
        contractNo: employee?.contract_date ?? "",
      },
      salaryConfig: {
        mode: employee?.salary_mode ?? "Lương Cứng",
        region: employee?.salary_region ?? "I",
        baseSalary: employee?.base_salary ?? 0,
        coefficient: employee?.salary_coefficient ?? 0,
        allowanceLunch: employee?.allowance_lunch ?? 0,
        allowanceTransport: employee?.allowance_transport ?? 0,
        allowancePhone: employee?.allowance_phone ?? 0,
        allowanceResponsibility: employee?.allowance_responsibility ?? 0,
        allowancePosition: employee?.allowance_position ?? 0,
        allowanceSeniority: employee?.allowance_seniority_percent ?? 0,
        allowanceOther: employee?.allowance_other ?? 0,
        bonusAmount: employee?.bonus_amount ?? 0,
        commissionRate: employee?.commission_rate ?? 0,
        otherSupport: employee?.other_support ?? 0,
        paymentMethod: employee?.payment_method ?? "",
        bankName: employee?.bank_name ?? "",
        accountNumber: employee?.bank_account_no ?? "",
        accountHolder: employee?.bank_account_holder ?? "",
      },
      skillsDevelopment: {
        educationLevel: employee?.education_level ?? "",
        workExperience: employee?.work_experience ?? "",
        kpiResults: employee?.kpi_results ?? "",
        idpPlan: employee?.idp_plan ?? "",
      },
      workTimeLeave: {
        standardWorkingHours: employee?.standard_working_hours ?? 0,
        actualWorkingDays: employee?.actual_working_days ?? 0,
        annualLeaveDays: employee?.annual_leave_days ?? 0,
        sickLeaveDays: employee?.sick_leave_days ?? 0,
        maternityLeaveDays: employee?.maternity_leave_days ?? 0,
        unpaidLeaveDays: employee?.unpaid_leave_days ?? 0,
      },
    },
  });

  useEffect(() => {
    if (employee && isOpen) {
      form.reset({
        name: employee?.name ?? "",
        employeeID: employee?.employeeID ?? "",
        email: employee?.email ?? "",
        phone: employee?.phone ?? "",
        dateOfBirth: employee?.dob ?? "",
        gender: employee?.gender ?? null,
        position: employee?.position ?? "",
        level: employee?.level ?? "",
        department: employee?.department ?? "",
        permanentAddress: {
          perm_province: employee?.perm_province ?? "",
          perm_district: employee?.perm_district ?? "",
          perm_detail: employee?.perm_detail ?? "",
        },
        currentAddress: {
          sameAsPermanent: employee?.is_same_address ?? false,
          province: employee?.curr_province ?? "",
          district: employee?.curr_district ?? "",
          ward: employee?.curr_ward ?? "",
          detail: employee?.curr_detail ?? "",
        },
        laborContract: {
          contractNumber: employee?.contract_number ?? "",
          contractFile: employee?.labor_contract_file ?? null,
          startDate: employee?.start_date ?? "",
          endDate: employee?.end_date ?? "",
          acceptanceDecisionFile: employee?.acceptance_decision_file ?? null,
          appointmentDecisionFile: employee?.appointment_decision_file ?? null,
          transferDecisionFile: employee?.transfer_decision_file ?? null,
          terminationDecisionFile: employee?.termination_decision_file ?? null,
          ndaFile: employee?.nda_file ?? null,
          nonCompeteFile: employee?.non_compete_file ?? null,
        },
        legal: {
          cccdNumber: employee?.citizen_id ?? "",
          contractNo: employee?.contract_date ?? "",
        },
        socialInsurance: {
          bhxhNumber: employee?.social_insurance_no ?? "",
          verified: employee?.is_verified_bhxh ?? false,
          bhxhStatus: employee?.bhxh_status ?? "",
          bhytStatus: employee?.bhyt_status ?? "",
          bhtnStatus: employee?.bhtn_status ?? "",
          contributionAmount: employee?.insurance_contribution_amount ?? 0,
          contributionPeriod: employee?.insurance_contribution_period ?? "",
        },
        healthInsurance: {
          cardNumber: employee?.health_insurance_card_id ?? "",
          kcbProvince: employee?.medical_province_id ?? "",
          kcbHospital: employee?.medical_hospital_id ?? "",
        },
        salaryConfig: {
          mode: employee?.salary_mode ?? "Lương Cứng",
          region: employee?.salary_region ?? "I",
          baseSalary: employee?.base_salary ?? 0,
          coefficient: employee?.salary_coefficient ?? 0,
          allowanceLunch: employee?.allowance_lunch ?? 0,
          allowanceTransport: employee?.allowance_transport ?? 0,
          allowancePhone: employee?.allowance_phone ?? 0,
          allowanceResponsibility: employee?.allowance_responsibility ?? 0,
          allowancePosition: employee?.allowance_position ?? 0,
          allowanceSeniority: employee?.allowance_seniority_percent ?? 0,
          allowanceOther: employee?.allowance_other ?? 0,
          bonusAmount: employee?.bonus_amount ?? 0,
          commissionRate: employee?.commission_rate ?? 0,
          otherSupport: employee?.other_support ?? 0,
          paymentMethod: employee?.payment_method ?? "",
          bankName: employee?.bank_name ?? "",
          accountNumber: employee?.bank_account_no ?? "",
          accountHolder: employee?.bank_account_holder ?? "",
        },
        skillsDevelopment: {
          educationLevel: employee?.education_level ?? "",
          workExperience: employee?.work_experience ?? "",
          kpiResults: employee?.kpi_results ?? "",
          idpPlan: employee?.idp_plan ?? "",
        },
        workTimeLeave: {
          standardWorkingHours: employee?.standard_working_hours ?? 0,
          actualWorkingDays: employee?.actual_working_days ?? 0,
          annualLeaveDays: employee?.annual_leave_days ?? 0,
          sickLeaveDays: employee?.sick_leave_days ?? 0,
          maternityLeaveDays: employee?.maternity_leave_days ?? 0,
          unpaidLeaveDays: employee?.unpaid_leave_days ?? 0,
        },
      });
    }
  }, [employee, isOpen, form]);

  return form;
}

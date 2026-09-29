// File attachment type for documents
export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  type: string;
}

// Dependent for tax deductions
export interface Dependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string;
  idNumber: string;
}

// Salary adjustment history
export interface SalaryAdjustment {
  id: string;
  effectiveDate: string;
  previousSalary: number;
  newSalary: number;
  reason: string;
}

// Training record
export interface TrainingRecord {
  id: string;
  courseName: string;
  provider: string;
  startDate: string;
  endDate: string;
  result: string;
  certificate?: FileAttachment;
}

// Certificate/Qualification
export interface Certificate {
  id: string;
  name: string;
  issuedBy: string;
  issueDate: string;
  expiryDate?: string;
  file?: FileAttachment;
}

export interface Employee {
  id: string;
  created_at: string;
  employeeID: string;
  name: string;
  email: string;
  phone: string | null;
  dob?: string | null;
  gender?: "Nam" | "Nữ" | null;
  ethnicity?: string | null;
  citizen_id?: string | null;
  citizen_id_file?: FileAttachment | null;
  is_active?: boolean;
  department?: string | null;
  position?: string | null;
  level?: string | null;
  contract_date?: string | null;
  contract_number?: string | null;
  
  // Address - Permanent
  perm_province?: string | null;
  perm_district?: string | null;
  perm_ward?: string | null;
  perm_detail?: string | null;
  
  // Address - Current
  is_same_address?: boolean;
  curr_province?: string | null;
  curr_district?: string | null;
  curr_ward?: string | null;
  curr_detail?: string | null;
  
  // Labor Records (Tab II)
  labor_contract_file?: FileAttachment | null;
  start_date?: string | null;
  end_date?: string | null;
  acceptance_decision_file?: FileAttachment | null;
  appointment_decision_file?: FileAttachment | null;
  transfer_decision_file?: FileAttachment | null;
  termination_decision_file?: FileAttachment | null;
  nda_file?: FileAttachment | null;
  non_compete_file?: FileAttachment | null;
  
  // Insurance (Tab IV)
  social_insurance_no?: string | null;
  is_verified_bhxh?: boolean;
  bhxh_status?: string | null;
  bhyt_status?: string | null;
  bhtn_status?: string | null;
  insurance_contribution_amount?: number | null;
  insurance_contribution_period?: string | null;
  labor_increase_file?: FileAttachment | null;
  labor_decrease_file?: FileAttachment | null;
  
  // Health Insurance
  health_insurance_card_id?: string | null;
  medical_province_id?: string | null;
  medical_hospital_id?: string | null;
  
  // Tax
  dependents?: Dependent[];
  tax_settlement_file?: FileAttachment | null;
  insurance_tax_docs?: FileAttachment[];
  
  // Salary Config (Tab III)
  salary_mode: "Lương Cứng" | "Lương Hệ Số";
  base_salary?: number | null;
  salary_coefficient?: number | null;
  salary_region?: "I" | "II" | "III" | "IV" | "V" | null;
  
  // Allowances
  allowance_lunch?: number | null;
  allowance_transport?: number | null;
  allowance_phone?: number | null;
  allowance_responsibility?: number | null;
  allowance_position?: number | null;
  allowance_seniority_percent?: number | null;
  allowance_other?: number | null;
  
  // Bonuses & Benefits
  bonus_amount?: number | null;
  commission_rate?: number | null;
  other_support?: number | null;
  payment_method?: string | null;
  
  // Banking
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_holder?: string | null;
  
  // Salary History
  salary_adjustments?: SalaryAdjustment[];
  timesheet_files?: FileAttachment[];
  payslip_files?: FileAttachment[];
  
  // Skills & Development (Tab V)
  education_level?: string | null;
  education_files?: FileAttachment[];
  certificates?: Certificate[];
  work_experience?: string | null;
  kpi_results?: string | null;
  training_records?: TrainingRecord[];
  idp_plan?: string | null;
  
  // Work Time & Leave (Tab VI)
  standard_working_hours?: number | null;
  actual_working_days?: number | null;
  annual_leave_days?: number | null;
  sick_leave_days?: number | null;
  maternity_leave_days?: number | null;
  unpaid_leave_days?: number | null;
  violation_files?: FileAttachment[];
  discipline_files?: FileAttachment[];
  
  // Safety & Compliance (Tab VII)
  health_checkup_files?: FileAttachment[];
  accident_report_files?: FileAttachment[];
  safety_record_files?: FileAttachment[];
  company_policy_acknowledgment_file?: FileAttachment | null;
  fire_safety_files?: FileAttachment[];
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  grossAmount: number;
  netAmount: number;
  status: "paid" | "pending";
  paidDate?: string;
}

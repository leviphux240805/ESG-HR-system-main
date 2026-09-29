import { z } from "zod";

export const employeeFormSchema = z.object({
  // Basic Info
  name: z.string().min(1, "Họ và Tên là bắt buộc"),
  employeeID: z.string().optional(),
  dateOfBirth: z.string(),
  gender: z.string().min(1, "Giới tính là bắt buộc"),
  nationality: z.string().optional(),
  ethnicity: z.string().optional(),
  workplace: z.string().optional(),
  position: z.string().optional(),
  level: z.string().optional(),
  department: z.string().optional(),
  email: z.string(),
  phone: z.string(),

  permanentAddress: z
    .object({
      perm_province: z.string().optional(),
      perm_district: z.string().optional(),
      perm_ward: z.string().optional(),
      perm_detail: z.string().optional(),
    })
    .optional(),

  currentAddress: z
    .object({
      province: z.string().optional(),
      district: z.string().optional(),
      ward: z.string().optional(),
      detail: z.string().optional(),
      sameAsPermanent: z.boolean().optional(),
    })
    .optional(),

  // Labor Records
  laborContract: z
    .object({
      contractNumber: z.string().optional(),
      contractFile: z.any().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      acceptanceDecisionFile: z.any().optional(),
      appointmentDecisionFile: z.any().optional(),
      transferDecisionFile: z.any().optional(),
      terminationDecisionFile: z.any().optional(),
      ndaFile: z.any().optional(),
      nonCompeteFile: z.any().optional(),
    })
    .optional(),

  // Insurance
  socialInsurance: z
    .object({
      bhxhNumber: z.string().optional(),
      verified: z.boolean().optional(),
      verifiedDate: z.string().optional(),
      bhxhStatus: z.string().optional(),
      bhytStatus: z.string().optional(),
      bhtnStatus: z.string().optional(),
      contributionAmount: z.union([z.number(), z.string()]).optional(),
      contributionPeriod: z.string().optional(),
      laborIncreaseFile: z.any().optional(),
      laborDecreaseFile: z.any().optional(),
    })
    .optional(),

  healthInsurance: z
    .object({
      cardNumber: z.string().optional(),
      kcbProvince: z.string().optional(),
      kcbHospital: z.string().optional(),
    })
    .optional(),

  legal: z
    .object({
      contractNo: z.string().optional(),
      signDate: z.string().optional(),
      cccdNumber: z
        .string()
        .min(1, "Số Căn cước Công dân là bắt buộc!")
        .max(12),
    })
    .optional(),

  // Salary Config
  salaryConfig: z
    .object({
      mode: z.enum(["Lương Cứng", "Lương Hệ Số"]),
      baseSalary: z.union([z.number(), z.string()]).optional(),
      coefficient: z.union([z.number(), z.string()]).optional(),
      region: z.enum(["I", "II", "III", "IV", "V"]),
      positionRatio: z.union([z.number(), z.string()]).optional(),
      seniorityPercent: z.union([z.number(), z.string()]).optional(),
      allowanceLunch: z.union([z.number(), z.string()]).optional(),
      allowanceTransport: z.union([z.number(), z.string()]).optional(),
      allowancePhone: z.union([z.number(), z.string()]).optional(),
      allowanceResponsibility: z.union([z.number(), z.string()]).optional(),
      allowancePosition: z.union([z.number(), z.string()]).optional(),
      allowanceSeniority: z.union([z.number(), z.string()]).optional(),
      allowanceOther: z.union([z.number(), z.string()]).optional(),
      bonusAmount: z.union([z.number(), z.string()]).optional(),
      commissionRate: z.union([z.number(), z.string()]).optional(),
      otherSupport: z.union([z.number(), z.string()]).optional(),
      paymentMethod: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
    })
    .optional(),

  // Skills & Development
  skillsDevelopment: z
    .object({
      educationLevel: z.string().optional(),
      educationFiles: z.any().optional(),
      certificates: z.any().optional(),
      workExperience: z.string().optional(),
      kpiResults: z.string().optional(),
      trainingRecords: z.any().optional(),
      idpPlan: z.string().optional(),
    })
    .optional(),

  // Work Time & Leave
  workTimeLeave: z
    .object({
      standardWorkingHours: z.union([z.number(), z.string()]).optional(),
      actualWorkingDays: z.union([z.number(), z.string()]).optional(),
      annualLeaveDays: z.union([z.number(), z.string()]).optional(),
      sickLeaveDays: z.union([z.number(), z.string()]).optional(),
      maternityLeaveDays: z.union([z.number(), z.string()]).optional(),
      unpaidLeaveDays: z.union([z.number(), z.string()]).optional(),
      violationFiles: z.any().optional(),
      disciplineFiles: z.any().optional(),
    })
    .optional(),

  // Safety & Compliance
  safetyCompliance: z
    .object({
      healthCheckupFiles: z.any().optional(),
      accidentReportFiles: z.any().optional(),
      safetyRecordFiles: z.any().optional(),
      companyPolicyAcknowledgment: z.any().optional(),
      fireSafetyFiles: z.any().optional(),
    })
    .optional(),
});

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;

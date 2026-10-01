import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FormSheet } from "@/components/common/FormSheet";
import { getAllBanks } from "@/data/bankData";
import type { StaffDetail } from "@/api";
import { AddressFields, useAddressData } from "../AddressFields";
import { submitChangeRequest } from "@/api";
import { SelectField, TextField } from "./fields";

interface Props {
  staff: StaffDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const text = z.string().trim().default("");

// ---- liên hệ

const contactSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9 +().-]{9,20}$/.test(v), "Số điện thoại không hợp lệ")
    .default(""),
  permProvinceCode: text,
  permWardCode: text,
  permAddressDetail: z.string().trim().max(300).default(""),
  currProvinceCode: text,
  currWardCode: text,
  currAddressDetail: z.string().trim().max(300).default(""),
});
type ContactValues = z.infer<typeof contactSchema>;

/** Đề xuất đổi SĐT/địa chỉ; ban giám hiệu duyệt rồi mới ghi vào hồ sơ. */
export function ContactRequestSheet({ staff, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const provinces = useAddressData();
  const initial = (): ContactValues => ({
    phone: staff.phone ?? "",
    permProvinceCode: staff.permProvinceCode ?? "",
    permWardCode: staff.permWardCode ?? "",
    permAddressDetail: staff.permAddressDetail ?? "",
    currProvinceCode: staff.currProvinceCode ?? "",
    currWardCode: staff.currWardCode ?? "",
    currAddressDetail: staff.currAddressDetail ?? "",
  });
  const form = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: initial() });
  useEffect(() => {
    if (open) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở
  }, [open]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Đề xuất đổi số điện thoại, địa chỉ"
      description="Thay đổi được ghi vào hồ sơ sau khi ban giám hiệu duyệt."
      form={form}
      submitLabel="Gửi đề xuất"
      successMessage="Đã gửi đề xuất, vui lòng chờ duyệt."
      onSubmit={async (v) => {
        await submitChangeRequest(v);
        await queryClient.invalidateQueries({ queryKey: ["me", "change-requests"] });
      }}
    >
      <TextField form={form} name="phone" label="Số điện thoại" inputMode="numeric" />
      <p className="text-sm font-medium pt-2">Địa chỉ thường trú</p>
      <AddressFields form={form} prefix="perm" provinces={provinces} />
      <p className="text-sm font-medium pt-2">Địa chỉ hiện tại</p>
      <AddressFields form={form} prefix="curr" provinces={provinces} />
    </FormSheet>
  );
}

// ---- ngân hàng

const bankSchema = z.object({
  bankName: z.string().trim().min(1, "Vui lòng chọn ngân hàng").max(100),
  bankAccountNo: z.string().trim().regex(/^[0-9]{6,30}$/, "Số tài khoản chỉ gồm chữ số"),
  bankAccountHolder: z.string().trim().min(1, "Vui lòng nhập chủ tài khoản").max(200),
});
type BankValues = z.infer<typeof bankSchema>;

/** Đề xuất đổi tài khoản nhận lương; hiệu trưởng hoặc kế toán duyệt. */
export function BankRequestSheet({ staff, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const banks = useQuery({ queryKey: ["banks"], queryFn: getAllBanks, staleTime: Infinity, enabled: open });
  const initial = (): BankValues => ({
    bankName: staff.bank?.bankName ?? "",
    bankAccountNo: staff.bank?.bankAccountNo ?? "",
    bankAccountHolder: staff.bank?.bankAccountHolder ?? staff.fullName.toLocaleUpperCase("vi-VN"),
  });
  const form = useForm<BankValues>({ resolver: zodResolver(bankSchema), defaultValues: initial() });
  useEffect(() => {
    if (open) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở
  }, [open]);

  const options = (banks.data ?? []).map((b) => ({ value: b.shortName, label: `${b.shortName} – ${b.name}` }));
  const current = form.watch("bankName");
  if (current && !options.some((o) => o.value === current)) options.unshift({ value: current, label: current });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Đề xuất đổi tài khoản nhận lương"
      description="Thay đổi được áp dụng sau khi hiệu trưởng hoặc kế toán duyệt."
      form={form}
      submitLabel="Gửi đề xuất"
      successMessage="Đã gửi đề xuất, vui lòng chờ duyệt."
      onSubmit={async (v) => {
        await submitChangeRequest(v);
        await queryClient.invalidateQueries({ queryKey: ["me", "change-requests"] });
      }}
    >
      <SelectField form={form} name="bankName" label="Ngân hàng" required options={options} placeholder={banks.isLoading ? "Đang tải..." : "Chọn ngân hàng"} />
      <TextField form={form} name="bankAccountNo" label="Số tài khoản" inputMode="numeric" required />
      <TextField form={form} name="bankAccountHolder" label="Chủ tài khoản" required />
    </FormSheet>
  );
}

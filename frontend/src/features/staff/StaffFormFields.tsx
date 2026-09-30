import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressFields, useAddressData } from "./AddressFields";
import { GENDER_LABELS, options, POSITION_LABELS, QUALIFICATION_LABELS } from "./labels";
import type { StaffFormValues } from "./staffForm";
import { checkStaffDuplicates } from "./api";

type TextField = Exclude<
  keyof StaffFormValues,
  "gender" | "position" | "qualification" | "sameAddress"
>;

function TextInput({
  form,
  name,
  label,
  type = "text",
  required,
  onBlur,
  disabled,
  inputMode,
}: {
  form: UseFormReturn<StaffFormValues>;
  name: TextField;
  label: string;
  type?: string;
  required?: boolean;
  onBlur?: () => void;
  disabled?: boolean;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              type={type}
              inputMode={inputMode}
              disabled={disabled}
              className="min-h-11"
              onBlur={() => {
                field.onBlur();
                onBlur?.();
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EnumSelect<K extends string>({
  form,
  name,
  label,
  labels,
  required,
  disabled,
}: {
  form: UseFormReturn<StaffFormValues>;
  name: "gender" | "position" | "qualification";
  label: string;
  labels: Record<K, string>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </FormLabel>
          <Select value={(field.value as string) ?? ""} onValueChange={field.onChange} disabled={disabled}>
            <FormControl>
              <SelectTrigger className="min-h-11" aria-label={label}>
                <SelectValue placeholder={`Chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options(labels).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

interface Props {
  form: UseFormReturn<StaffFormValues>;
  /** Hồ sơ đang sửa (bỏ qua chính nó khi kiểm tra trùng). */
  staffId?: string;
  disabled?: boolean;
  /** Ô chọn cơ sở (trang thêm mới) đặt trong phần Công việc. */
  schoolField?: ReactNode;
}

/**
 * Các ô nhập hồ sơ nhân viên: thông tin cá nhân, địa chỉ (tỉnh + phường/xã), công việc. Rời ô CCCD/SĐT/email thì
 * kiểm tra trùng toàn chuỗi và báo ngay dưới ô.
 */
export function StaffFormFields({ form, staffId, disabled, schoolField }: Props) {
  const provinces = useAddressData();
  const sameAddress = form.watch("sameAddress");

  const checkDuplicate = async (field: "citizenId" | "phone" | "email") => {
    const value = form.getValues(field)?.trim();
    if (!value || form.getFieldState(field).invalid) return;
    try {
      const issues = await checkStaffDuplicates({ [field]: value, excludeStaffId: staffId });
      const issue = issues.find((i) => i.field === field);
      if (issue) form.setError(field, { type: "duplicate", message: issue.message });
    } catch {
      // Kiểm tra trùng chỉ để báo sớm; khi lưu backend vẫn kiểm tra lại
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Thông tin cá nhân">
        <TextInput form={form} name="fullName" label="Họ và tên" required disabled={disabled} />
        <TextInput form={form} name="dob" label="Ngày sinh" type="date" disabled={disabled} />
        <EnumSelect form={form} name="gender" label="Giới tính" labels={GENDER_LABELS} disabled={disabled} />
        <TextInput form={form} name="ethnicity" label="Dân tộc" disabled={disabled} />
        <TextInput form={form} name="citizenId" label="Số CCCD" inputMode="numeric" disabled={disabled} onBlur={() => checkDuplicate("citizenId")} />
        <TextInput form={form} name="citizenIdIssuedOn" label="Ngày cấp CCCD" type="date" disabled={disabled} />
        <TextInput form={form} name="phone" label="Số điện thoại" inputMode="tel" disabled={disabled} onBlur={() => checkDuplicate("phone")} />
        <TextInput form={form} name="email" label="Email" inputMode="email" disabled={disabled} onBlur={() => checkDuplicate("email")} />
      </Section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Địa chỉ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium">Thường trú</p>
          <AddressFields form={form} prefix="perm" provinces={provinces} disabled={disabled} />
          <FormField
            control={form.control}
            name="sameAddress"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={disabled} />
                </FormControl>
                <FormLabel className="font-normal">Địa chỉ hiện tại giống thường trú</FormLabel>
              </FormItem>
            )}
          />
          {!sameAddress && (
            <>
              <p className="text-sm font-medium">Hiện tại</p>
              <AddressFields form={form} prefix="curr" provinces={provinces} disabled={disabled} />
            </>
          )}
        </CardContent>
      </Card>

      <Section title="Công việc">
        {schoolField}
        <EnumSelect form={form} name="position" label="Vị trí" labels={POSITION_LABELS} required disabled={disabled} />
        <TextInput form={form} name="startDate" label="Ngày vào làm" type="date" required disabled={disabled} />
        <EnumSelect form={form} name="qualification" label="Trình độ" labels={QUALIFICATION_LABELS} disabled={disabled} />
        <TextInput form={form} name="specialization" label="Chuyên ngành" disabled={disabled} />
      </Section>
    </div>
  );
}

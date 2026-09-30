import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FormSheet } from "@/components/common/FormSheet";
import { SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { type ChildDetail, type ChildFields, saveChild, useClasses } from "@/api";

const schema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên trẻ."),
  nickname: z.string().trim().max(30),
  gender: z.enum(["MALE", "FEMALE"], { message: "Chọn giới tính." }),
  dob: z.string().min(1, "Chọn ngày sinh."),
  classId: z.string().min(1, "Chọn lớp."),
  guardianName: z.string().trim().min(2, "Nhập tên phụ huynh."),
  guardianRelation: z.string().trim().min(1, "Nhập quan hệ."),
  guardianPhone: z.string().trim().regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0."),
  address: z.string().trim().max(200),
  allergies: z.string().trim().max(200).optional(),
  healthNote: z.string().trim().max(500).optional(),
});

type Values = z.infer<typeof schema>;

const EMPTY: Values = { fullName: "", nickname: "", gender: "FEMALE", dob: "", classId: "", guardianName: "", guardianRelation: "Mẹ", guardianPhone: "", address: "", allergies: "", healthNote: "" };

function toValues(child?: ChildDetail | null, classId?: string): Values {
  if (!child) return { ...EMPTY, classId: classId ?? "" };
  return {
    fullName: child.fullName,
    nickname: child.nickname,
    gender: child.gender,
    dob: child.dob,
    classId: child.classId,
    guardianName: child.guardianName,
    guardianRelation: child.guardianRelation,
    guardianPhone: child.guardianPhone,
    address: child.address,
    allergies: child.allergies ?? "",
    healthNote: child.healthNote ?? "",
  };
}

/** Thêm/sửa hồ sơ trẻ. */
export function ChildSheet({ open, onOpenChange, child, defaultClassId }: { open: boolean; onOpenChange: (o: boolean) => void; child?: ChildDetail | null; defaultClassId?: string }) {
  const queryClient = useQueryClient();
  const classes = useClasses();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(child, defaultClassId) });

  useEffect(() => {
    if (open) form.reset(toValues(child, defaultClassId));
  }, [open, child, defaultClassId, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={child ? "Sửa hồ sơ trẻ" : "Thêm trẻ"}
      form={form}
      successMessage={child ? "Đã lưu hồ sơ trẻ." : "Đã thêm trẻ."}
      onSubmit={async (values) => {
        const body = { ...values, allergies: values.allergies || undefined, healthNote: values.healthNote || undefined } as ChildFields;
        await saveChild(child?.id ?? null, body);
        await Promise.all([queryClient.invalidateQueries({ queryKey: ["children"] }), queryClient.invalidateQueries({ queryKey: ["classes"] })]);
      }}
    >
      <TextField form={form} name="fullName" label="Họ và tên" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField form={form} name="nickname" label="Tên gọi ở nhà" />
        <SelectField form={form} name="gender" label="Giới tính" required options={[{ value: "FEMALE", label: "Nữ" }, { value: "MALE", label: "Nam" }]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField form={form} name="dob" label="Ngày sinh" type="date" required />
        <SelectField form={form} name="classId" label="Lớp" required options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
      </div>
      <TextField form={form} name="guardianName" label="Phụ huynh" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField form={form} name="guardianRelation" label="Quan hệ" required />
        <TextField form={form} name="guardianPhone" label="Số điện thoại" inputMode="numeric" required />
      </div>
      <TextField form={form} name="address" label="Địa chỉ" />
      <TextField form={form} name="allergies" label="Dị ứng" placeholder="Ví dụ: dị ứng hải sản" />
      <TextAreaField form={form} name="healthNote" label="Lưu ý sức khỏe" />
    </FormSheet>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FormSheet } from "@/components/common/FormSheet";
import { SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { AddressFields, useAddressData } from "@/features/staff/AddressFields";
import { type ChildDetail, type ChildProfileRequest, createChild, updateChild, useClasses } from "@/api";

const todayIso = () => new Date().toLocaleDateString("sv-SE");

const optional = (max: number) => z.string().trim().max(max).default("");

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Vui lòng nhập họ tên trẻ."),
    nickname: optional(50),
    gender: z.enum(["MALE", "FEMALE"], { message: "Chọn giới tính." }),
    dob: z.string().min(1, "Chọn ngày sinh."),
    provinceCode: optional(5),
    wardCode: optional(10),
    addressDetail: optional(300),
    allergyNote: optional(500),
    healthNote: optional(1000),
    // Chỉ khi thêm mới: lớp, ngày nhập học, phụ huynh chính
    isNew: z.boolean(),
    classId: optional(40),
    enrolledAt: optional(10),
    guardianName: optional(200),
    guardianRelation: optional(50),
    guardianPhone: z.string().trim().default(""),
  })
  .superRefine((v, ctx) => {
    if (!v.isNew) return;
    if (!v.enrolledAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["enrolledAt"], message: "Chọn ngày nhập học." });
    if (v.guardianName.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianName"], message: "Nhập tên phụ huynh." });
    if (!v.guardianRelation) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianRelation"], message: "Nhập quan hệ." });
    if (v.guardianPhone && !/^0\d{9}$/.test(v.guardianPhone))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianPhone"], message: "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0." });
  });

type Values = z.infer<typeof schema>;

function toValues(child?: ChildDetail | null, classId?: string): Values {
  const item = child?.item;
  return {
    fullName: item?.fullName ?? "",
    nickname: item?.nickname ?? "",
    gender: item?.gender ?? "FEMALE",
    dob: item?.dob ?? "",
    provinceCode: child?.provinceCode ?? "",
    wardCode: child?.wardCode ?? "",
    addressDetail: child?.addressDetail ?? "",
    allergyNote: item?.allergyNote ?? "",
    healthNote: child?.healthNote ?? "",
    isNew: !child,
    classId: classId ?? "",
    enrolledAt: todayIso(),
    guardianName: "",
    guardianRelation: "Mẹ",
    guardianPhone: "",
  };
}

const orUndefined = (v: string) => v || undefined;

function toProfile(v: Values, child?: ChildDetail | null): ChildProfileRequest {
  return {
    fullName: v.fullName,
    nickname: orUndefined(v.nickname),
    gender: v.gender,
    dob: v.dob,
    provinceCode: orUndefined(v.provinceCode),
    wardCode: orUndefined(v.wardCode),
    addressDetail: orUndefined(v.addressDetail),
    allergyNote: orUndefined(v.allergyNote),
    healthNote: orUndefined(v.healthNote),
    // Giữ nguyên các trường không có trên form
    personalId: child?.personalId,
    healthInsuranceNo: child?.healthInsuranceNo,
    photoFileId: child?.photo?.id,
  };
}

/** Thêm trẻ (kèm lớp, phụ huynh chính) hoặc sửa thông tin hồ sơ trẻ. */
export function ChildSheet({ open, onOpenChange, child, defaultClassId }: { open: boolean; onOpenChange: (o: boolean) => void; child?: ChildDetail | null; defaultClassId?: string }) {
  const queryClient = useQueryClient();
  const classes = useClasses();
  const provinces = useAddressData();
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
      onSubmit={async (v) => {
        if (child) {
          await updateChild(child.item.id, toProfile(v, child));
        } else {
          await createChild({
            profile: toProfile(v),
            enrolledAt: v.enrolledAt,
            classId: orUndefined(v.classId),
            guardians: [{ fullName: v.guardianName, relationship: v.guardianRelation, phone: orUndefined(v.guardianPhone), primary: true, canPickUp: true }],
          });
        }
        await Promise.all([queryClient.invalidateQueries({ queryKey: ["children"] }), queryClient.invalidateQueries({ queryKey: ["classes"] })]);
      }}
    >
      <TextField form={form} name="fullName" label="Họ và tên" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField form={form} name="nickname" label="Tên gọi ở nhà" />
        <SelectField form={form} name="gender" label="Giới tính" required options={[{ value: "FEMALE", label: "Nữ" }, { value: "MALE", label: "Nam" }]} />
      </div>
      <TextField form={form} name="dob" label="Ngày sinh" type="date" required />
      {!child && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SelectField form={form} name="classId" label="Lớp" options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <TextField form={form} name="enrolledAt" label="Ngày nhập học" type="date" required />
          </div>
          <TextField form={form} name="guardianName" label="Phụ huynh" required />
          <div className="grid grid-cols-2 gap-3">
            <TextField form={form} name="guardianRelation" label="Quan hệ" required />
            <TextField form={form} name="guardianPhone" label="Số điện thoại" inputMode="numeric" />
          </div>
        </>
      )}
      <AddressFields form={form} prefix="" provinces={provinces} />
      <TextField form={form} name="allergyNote" label="Dị ứng" placeholder="Ví dụ: dị ứng hải sản" />
      <TextAreaField form={form} name="healthNote" label="Lưu ý sức khỏe" />
    </FormSheet>
  );
}

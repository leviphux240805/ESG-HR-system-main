import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { applyApiErrors } from "@/api";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/navigation";
import { type StaffDetail, updateStaff } from "@/api";
import { addressText, useAddressData } from "../AddressFields";
import { GENDER_LABELS, POSITION_LABELS, QUALIFICATION_LABELS } from "../labels";
import { StaffFormFields } from "../StaffFormFields";
import { fromStaffDetail, staffFormSchema, type StaffFormValues, toStaffFields } from "../staffForm";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
      </CardContent>
    </Card>
  );
}

function EditForm({ staff, onDone }: { staff: StaffDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<StaffFormValues>({ resolver: zodResolver(staffFormSchema), defaultValues: fromStaffDetail(staff) });
  const save = useMutation({
    // Giữ ảnh hiện tại: ảnh đổi bằng nút riêng ở đầu trang
    mutationFn: (values: StaffFormValues) => updateStaff(staff.id, toStaffFields(values, staff.photoFileId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Đã lưu hồ sơ.");
      onDone();
    },
    onError: (error) => applyApiErrors(error, form),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <StaffFormFields
          form={form}
          staffId={staff.id}
          schoolField={
            <div className="space-y-2">
              <Label>Cơ sở</Label>
              <p className="min-h-11 flex items-center text-sm">{staff.schoolName} (đổi bằng "Điều chuyển")</p>
            </div>
          }
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onDone} disabled={save.isPending}>
            Hủy
          </Button>
          <Button type="submit" className="min-h-11" disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {save.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Tab "Thông tin cá nhân": xem; người có quyền sửa bấm "Sửa thông tin" để sửa ngay trong tab. */
export function InfoTab({ staff }: { staff: StaffDetail }) {
  const [editing, setEditing] = useState(false);
  const provinces = useAddressData();

  if (editing) return <EditForm staff={staff} onDone={() => setEditing(false)} />;

  const perm = addressText(provinces, staff.permProvinceCode, staff.permWardCode, staff.permAddressDetail);
  const curr = addressText(provinces, staff.currProvinceCode, staff.currWardCode, staff.currAddressDetail);

  return (
    <div className="space-y-4">
      {staff.permissions.canEdit && staff.status === "ACTIVE" && (
        <div className="flex justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Sửa thông tin
          </Button>
        </div>
      )}
      <Section title="Thông tin cá nhân">
        <Field label="Họ và tên">{staff.fullName}</Field>
        <Field label="Ngày sinh">{formatDate(staff.dob)}</Field>
        <Field label="Giới tính">{staff.gender && GENDER_LABELS[staff.gender]}</Field>
        <Field label="Dân tộc">{staff.ethnicity}</Field>
        <Field label="Số CCCD">{staff.citizenId}</Field>
        <Field label="Ngày cấp CCCD">{formatDate(staff.citizenIdIssuedOn)}</Field>
      </Section>
      <Section title="Liên hệ">
        <Field label="Số điện thoại">{staff.phone}</Field>
        <Field label="Email">{staff.email}</Field>
        <Field label="Địa chỉ thường trú">{perm}</Field>
        <Field label="Địa chỉ hiện tại">{curr}</Field>
      </Section>
      <Section title="Công việc">
        <Field label="Mã nhân viên">{staff.staffCode}</Field>
        <Field label="Cơ sở">{staff.schoolName}</Field>
        <Field label="Vị trí">{POSITION_LABELS[staff.position]}</Field>
        <Field label="Ngày vào làm">{formatDate(staff.startDate)}</Field>
        <Field label="Trình độ">{staff.qualification && QUALIFICATION_LABELS[staff.qualification]}</Field>
        <Field label="Chuyên ngành">{staff.specialization}</Field>
        <Field label="Mã chấm công">{staff.machineCode}</Field>
        {staff.status === "TERMINATED" && (
          <>
            <Field label="Ngày nghỉ việc">{formatDate(staff.endDate)}</Field>
            <Field label="Lý do nghỉ">{staff.terminationReason}</Field>
          </>
        )}
      </Section>
      <Section title="Tài khoản đăng nhập">
        {staff.account ? (
          <>
            <Field label="Email đăng nhập">{staff.account.email}</Field>
            <Field label="Vai trò">{staff.account.roles.map((r) => ROLE_LABELS[r]).join(", ")}</Field>
            <Field label="Trạng thái">{staff.account.active ? "Đang hoạt động" : "Đã khóa"}</Field>
          </>
        ) : (
          <Field label="Tài khoản">Chưa có tài khoản đăng nhập</Field>
        )}
      </Section>
    </div>
  );
}

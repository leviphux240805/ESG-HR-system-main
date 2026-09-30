import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { z } from "zod";
import { deleteDependent, saveDependent } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSheet } from "@/components/common/FormSheet";
import { formatDate, formatMonth } from "@/lib/format";
import { type DependentDto, type StaffDetail, updateStaff, useDependents } from "@/api";
import { fromStaffDetail, toStaffFields } from "../staffForm";
import { TextField } from "./fields";
import { RecordCard } from "./RecordCard";

// ---- số BHXH, BHYT, MST

const numbersSchema = z.object({
  socialInsuranceNo: z.string().trim().max(20, "Tối đa 20 ký tự").default(""),
  healthInsuranceNo: z.string().trim().max(20, "Tối đa 20 ký tự").default(""),
  personalTaxCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{10}(-\d{3})?$|^\d{12}$/.test(v), "Mã số thuế gồm 10 hoặc 12 chữ số")
    .default(""),
});
type NumbersValues = z.infer<typeof numbersSchema>;

function NumbersSheet({ staff, open, onOpenChange }: { staff: StaffDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const initial = (): NumbersValues => ({
    socialInsuranceNo: staff.socialInsuranceNo ?? "",
    healthInsuranceNo: staff.healthInsuranceNo ?? "",
    personalTaxCode: staff.personalTaxCode ?? "",
  });
  const form = useForm<NumbersValues>({ resolver: zodResolver(numbersSchema), defaultValues: initial() });
  useEffect(() => {
    if (open) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở
  }, [open]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bảo hiểm & thuế"
      form={form}
      successMessage="Đã lưu."
      onSubmit={async (v) => {
        // PUT /staff/{id} nhận đủ trường hồ sơ: giữ nguyên các trường khác, chỉ thay 3 số này
        await updateStaff(staff.id, { ...toStaffFields(fromStaffDetail(staff), staff.photoFileId), ...emptyToUndefined(v) });
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <TextField form={form} name="socialInsuranceNo" label="Số sổ BHXH" inputMode="numeric" />
      <TextField form={form} name="healthInsuranceNo" label="Số thẻ BHYT" />
      <TextField form={form} name="personalTaxCode" label="Mã số thuế cá nhân" inputMode="numeric" />
    </FormSheet>
  );
}

function emptyToUndefined<T extends Record<string, string>>(v: T) {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? undefined : x])) as { [K in keyof T]?: string };
}

// ---- người phụ thuộc

const monthValue = z.string().regex(/^\d{4}-\d{2}$/, "Chọn tháng");
const dependentSchema = z
  .object({
    fullName: z.string().trim().min(1, "Vui lòng nhập họ tên").max(200),
    relationship: z.string().trim().min(1, "Vui lòng nhập quan hệ").max(50),
    dob: z.string().default(""),
    idNumber: z.string().trim().max(20).default(""),
    fromMonth: monthValue,
    toMonth: z.union([monthValue, z.literal("")]).default(""),
  })
  .refine((v) => !v.toMonth || v.toMonth >= v.fromMonth, { path: ["toMonth"], message: "Tháng kết thúc phải sau tháng bắt đầu" });
type DependentValues = z.infer<typeof dependentSchema>;

const toDependentValues = (d?: DependentDto): DependentValues => ({
  fullName: d?.fullName ?? "",
  relationship: d?.relationship ?? "",
  dob: d?.dob ?? "",
  idNumber: d?.idNumber ?? "",
  fromMonth: d?.fromMonth?.slice(0, 7) ?? "",
  toMonth: d?.toMonth?.slice(0, 7) ?? "",
});

function DependentSheet({
  staff,
  dependent,
  open,
  onOpenChange,
}: {
  staff: StaffDetail;
  dependent?: DependentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<DependentValues>({ resolver: zodResolver(dependentSchema), defaultValues: toDependentValues(dependent) });
  useEffect(() => {
    if (open) form.reset(toDependentValues(dependent));
  }, [open, dependent, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={dependent ? "Sửa người phụ thuộc" : "Thêm người phụ thuộc"}
      description="Người phụ thuộc được tính giảm trừ gia cảnh khi tính thuế TNCN từ tháng bắt đầu."
      form={form}
      successMessage="Đã lưu người phụ thuộc."
      onSubmit={async (v) => {
        const body = {
          fullName: v.fullName,
          relationship: v.relationship,
          dob: v.dob || undefined,
          idNumber: v.idNumber || undefined,
          fromMonth: `${v.fromMonth}-01`,
          toMonth: v.toMonth ? `${v.toMonth}-01` : undefined,
        };
        if (dependent) {
          await saveDependent(staff.id, dependent.id, body);
        } else {
          await saveDependent(staff.id, null, body);
        }
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <TextField form={form} name="fullName" label="Họ và tên" required />
      <TextField form={form} name="relationship" label="Quan hệ" required placeholder="Con, cha, mẹ…" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="dob" label="Ngày sinh" type="date" />
        <TextField form={form} name="idNumber" label="Số CCCD/giấy khai sinh" />
        <TextField form={form} name="fromMonth" label="Giảm trừ từ tháng" type="month" required />
        <TextField form={form} name="toMonth" label="Đến tháng" type="month" description="Bỏ trống nếu chưa kết thúc." />
      </div>
    </FormSheet>
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-0.5">{children || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

/** Tab "Bảo hiểm & thuế": số BHXH/BHYT/MST và người phụ thuộc (giảm trừ gia cảnh). */
export function InsuranceTab({ staff }: { staff: StaffDetail }) {
  const queryClient = useQueryClient();
  const dependents = useDependents(staff.id);
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [editing, setEditing] = useState<{ dependent?: DependentDto } | null>(null);
  const canEdit = staff.permissions.canEdit && staff.status === "ACTIVE";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Bảo hiểm & thuế</CardTitle>
          {canEdit && (
            <Button variant="outline" className="min-h-11" onClick={() => setEditingNumbers(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Sửa
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Row label="Số sổ BHXH">{staff.socialInsuranceNo}</Row>
            <Row label="Số thẻ BHYT">{staff.healthInsuranceNo}</Row>
            <Row label="Mã số thuế cá nhân">{staff.personalTaxCode}</Row>
          </dl>
        </CardContent>
      </Card>

      <RecordCard
        title="Người phụ thuộc"
        addLabel="Thêm người phụ thuộc"
        emptyText="Chưa khai báo người phụ thuộc."
        canEdit={canEdit}
        query={dependents}
        columns={[
          { header: "Họ tên", cell: (d) => <span className="font-medium">{d.fullName}</span> },
          { header: "Quan hệ", cell: (d) => d.relationship },
          { header: "Ngày sinh", cell: (d) => formatDate(d.dob) },
          { header: "Số giấy tờ", cell: (d) => d.idNumber ?? "" },
          {
            header: "Giảm trừ",
            className: "whitespace-nowrap",
            cell: (d) => `${formatMonth(d.fromMonth)} – ${d.toMonth ? formatMonth(d.toMonth) : "nay"}`,
          },
        ]}
        onAdd={() => setEditing({})}
        onEdit={(d) => setEditing({ dependent: d })}
        describe={(d) => `Người phụ thuộc ${d.fullName}`}
        onDelete={async (d) => {
          await deleteDependent(staff.id, d.id);
          await queryClient.invalidateQueries({ queryKey: ["staff"] });
        }}
      />

      <NumbersSheet staff={staff} open={editingNumbers} onOpenChange={setEditingNumbers} />
      <DependentSheet
        staff={staff}
        dependent={editing?.dependent}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}

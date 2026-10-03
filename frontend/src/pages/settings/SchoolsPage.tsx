import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, School } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { useAuth } from "@/contexts/AuthContext";
import { TextField } from "@/features/staff/profile/fields";
import { AddressFields, addressText, useAddressData } from "@/features/staff/AddressFields";
import { type SchoolDto, saveSchool, setSchoolActive, useSchools } from "@/api";
import { groupSchools } from "@/lib/schoolHierarchy";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã trường")
    .max(20, "Mã trường tối đa 20 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã trường chỉ gồm chữ, số, gạch ngang, gạch dưới"),
  name: z.string().trim().min(1, "Vui lòng nhập tên trường").max(200, "Tên trường tối đa 200 ký tự"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9 +().-]{9,20}$/.test(v), "Số điện thoại không hợp lệ"),
  licenseNo: z.string().trim().max(50, "Số giấy phép tối đa 50 ký tự"),
  permProvinceCode: z.string().optional(),
  permWardCode: z.string().optional(),
  permAddressDetail: z.string().trim().max(300, "Địa chỉ tối đa 300 ký tự").optional(),
});
type SchoolForm = z.infer<typeof schema>;

/** Trường của tổ chức: hiệu trưởng tạo trường (tự thành hiệu trưởng trường mới), sửa thông tin, ngừng hoặc mở lại. */
export default function SchoolsPage() {
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();
  const query = useSchools();
  const provinces = useAddressData();
  const [editing, setEditing] = useState<SchoolDto | "new" | null>(null);
  const [toggling, setToggling] = useState<SchoolDto | null>(null);
  const form = useForm<SchoolForm>({ resolver: zodResolver(schema) });

  const open = (item: SchoolDto | "new") => {
    const s = item === "new" ? null : item;
    form.reset({
      code: s?.code ?? "",
      name: s?.name ?? "",
      phone: s?.phone ?? "",
      licenseNo: s?.licenseNo ?? "",
      permProvinceCode: s?.provinceCode ?? "",
      permWardCode: s?.wardCode ?? "",
      permAddressDetail: s?.addressDetail ?? "",
    });
    setEditing(item);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schools"] });
    // Danh sách trường trên header lấy từ /me
    await refreshMe();
  };

  const renderSchool = (s: SchoolDto) => (
    <Card key={s.id} className={s.active ? undefined : "opacity-70"}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">
              {s.code}{s.type === "BRANCH" ? " · Phân hiệu" : " · Trường chính"}
              {s.phone && ` · ${s.phone}`}
            </p>
          </div>
          <Badge variant={s.active ? "secondary" : "outline"}>{s.active ? "Đang hoạt động" : "Đã ngừng"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{addressText(provinces, s.provinceCode, s.wardCode, s.addressDetail) || "Chưa có địa chỉ"}</p>
        {s.canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => open(s)}>
              <Pencil className="w-4 h-4 mr-2" /> Sửa
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setToggling(s)}>
              {s.active ? "Ngừng hoạt động" : "Mở lại"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (query.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trường"
        description="Các trường bạn quản lý. Trường mới thuộc tổ chức của bạn và bạn là hiệu trưởng của trường đó."
        actions={
          <Button className="min-h-11" onClick={() => open("new")}>
            <Plus className="w-4 h-4 mr-2" /> Thêm trường
          </Button>
        }
      />
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <EmptyState icon={School} title="Chưa có trường" description="Bấm “Thêm trường” để tạo trường đầu tiên." />
      ) : (
        <div className="space-y-4">
          {groupSchools(query.data!).map(({ school, branches }) => (
            <section key={school.id} className="space-y-3">
              {renderSchool(school)}
              {branches.length > 0 && (
                <div className="ml-4 space-y-3 border-l-2 border-muted pl-3 sm:ml-6 sm:pl-4">
                  {branches.map(renderSchool)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm trường" : "Sửa trường"}
        form={form}
        onSubmit={async (v) => {
          await saveSchool(editing === "new" || !editing ? null : editing.id, {
            code: v.code,
            name: v.name,
            phone: v.phone || undefined,
            licenseNo: v.licenseNo || undefined,
            provinceCode: v.permProvinceCode || undefined,
            wardCode: v.permWardCode || undefined,
            addressDetail: v.permAddressDetail || undefined,
          });
          await refresh();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField form={form} name="code" label="Mã trường" required />
          <TextField form={form} name="phone" label="Điện thoại" inputMode="numeric" />
        </div>
        <TextField form={form} name="name" label="Tên trường" required />
        <TextField form={form} name="licenseNo" label="Số giấy phép hoạt động" />
        <AddressFields form={form} prefix="perm" provinces={provinces} />
      </FormSheet>
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.active ? `Ngừng hoạt động ${toggling.name}?` : `Mở lại ${toggling?.name}?`}
        description={
          toggling?.active
            ? "Dữ liệu được giữ nguyên nhưng không ai chọn được trường này cho tới khi mở lại."
            : "Mọi người có vai trò ở trường này dùng lại được."
        }
        confirmText={toggling?.active ? "Ngừng hoạt động" : "Mở lại"}
        variant={toggling?.active ? "destructive" : "default"}
        onConfirm={async () => {
          await setSchoolActive(toggling!.id, !toggling!.active);
          toast.success(toggling!.active ? "Đã ngừng trường." : "Đã mở lại trường.");
          await refresh();
        }}
      />
    </div>
  );
}

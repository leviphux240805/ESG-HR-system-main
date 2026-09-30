import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { api, unwrap } from "@/api/client";
import { applyApiErrors } from "@/api/formErrors";
import { uploadFile } from "@/api/files";
import type { components } from "@/api/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { ROLE_LABELS } from "@/lib/navigation";
import { addStaffDocument, useDocumentTypes } from "@/features/staff/api";
import { CccdScanDialog, type CccdScanResult } from "@/features/staff/CccdScanDialog";
import { StaffFormFields } from "@/features/staff/StaffFormFields";
import { emptyStaffForm, staffFormSchema, type StaffFormValues, SUGGESTED_ROLE, toStaffFields } from "@/features/staff/staffForm";

type RoleCode = components["schemas"]["RoleAssignment"]["role"];

/** Vai trò gán nhanh khi tạo nhân viên (cấp cơ sở + kế toán); vai trò cấp chuỗi gán ở trang Tài khoản. */
const ACCOUNT_ROLES: RoleCode[] = ["PRINCIPAL", "TEACHER", "NURSE", "KITCHEN", "ACCOUNTANT", "STAFF"];

export default function StaffCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const { schoolId: selectedSchool, schools, isAllSchools, canChooseAll } = useCurrentSchool();
  const documentTypes = useDocumentTypes();

  const form = useForm<StaffFormValues>({ resolver: zodResolver(staffFormSchema), defaultValues: emptyStaffForm() });
  const [schoolId, setSchoolId] = useState<string | undefined>(selectedSchool ?? (schools.length === 1 ? schools[0].id : undefined));
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [cccd, setCccd] = useState<CccdScanResult | null>(null);
  const [createAccount, setCreateAccount] = useState(false);
  const [accountRole, setAccountRole] = useState<RoleCode | undefined>(undefined);

  const canCreateAccounts = !!me?.roles.some((r) => !r.schoolId && (r.role === "OWNER" || r.role === "CHAIN_ADMIN"));
  const position = form.watch("position");
  const role = accountRole ?? (position ? SUGGESTED_ROLE[position] : undefined);

  const applyScan = (result: CccdScanResult) => {
    setCccd(result);
    const info = result.info;
    if (!info) return;
    const set = (name: keyof StaffFormValues, value: string | undefined) => {
      if (value) form.setValue(name, value as never, { shouldValidate: true, shouldDirty: true });
    };
    set("citizenId", info.citizenId);
    set("fullName", info.fullName);
    set("dob", info.dob);
    set("gender", info.gender);
    set("citizenIdIssuedOn", info.issuedOn);
    // Địa chỉ trên thẻ là dạng cũ (còn quận/huyện): chỉ điền ô chi tiết, người dùng chọn lại tỉnh + phường/xã
    set("permAddressDetail", info.address);
    toast.success("Đã điền thông tin từ CCCD. Hãy chọn lại tỉnh và phường/xã theo địa giới mới.");
  };

  /** Lưu ảnh 2 mặt CCCD làm giấy tờ của nhân viên vừa tạo (lỗi không làm hỏng việc tạo hồ sơ). */
  const uploadCccdImages = async (staffId: string, staffSchool: string) => {
    const pairs: [File | null, string][] = [
      [cccd?.front ?? null, "CCCD_MAT_TRUOC"],
      [cccd?.back ?? null, "CCCD_MAT_SAU"],
    ];
    for (const [file, code] of pairs) {
      const type = documentTypes.data?.find((t) => t.code === code);
      if (!file || !type) continue;
      try {
        const stored = await uploadFile(file, staffSchool);
        await addStaffDocument(staffId, { documentTypeId: type.id, fileId: stored.id, issuedDate: cccd?.info?.issuedOn });
      } catch {
        toast.warning(`Chưa lưu được ảnh ${type.name}. Bạn có thể tải lại ở tab Giấy tờ.`);
      }
    }
  };

  const create = useMutation({
    mutationFn: async (values: StaffFormValues) => {
      const created = unwrap(
        await api.POST("/api/v1/staff", {
          body: {
            schoolId,
            fields: toStaffFields(values),
            account: createAccount && role
              ? { roles: [{ role, schoolId }] }
              : undefined,
          },
        }),
      );
      await uploadCccdImages(created.id, created.schoolId);
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`Đã thêm nhân viên ${created.fullName} (${created.staffCode}).`);
      navigate(`/nhan-su/${created.id}`);
    },
    onError: (error) => applyApiErrors(error, form, { stripPrefix: "fields." }),
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!schoolId) {
      setSchoolError("Vui lòng chọn cơ sở");
      return;
    }
    if (createAccount && !values.email) {
      form.setError("email", { type: "manual", message: "Cần email để tạo tài khoản đăng nhập" }, { shouldFocus: true });
      return;
    }
    create.mutate(values);
  });

  const schoolField =
    canChooseAll && isAllSchools ? (
      <div className="space-y-2">
        <Label>
          Cơ sở<span className="text-destructive ml-0.5">*</span>
        </Label>
        <Select value={schoolId ?? ""} onValueChange={(v) => { setSchoolId(v); setSchoolError(null); }}>
          <SelectTrigger className="min-h-11" aria-label="Cơ sở làm việc">
            <SelectValue placeholder="Chọn cơ sở" />
          </SelectTrigger>
          <SelectContent>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {schoolError && <p className="text-sm font-medium text-destructive">{schoolError}</p>}
      </div>
    ) : (
      <div className="space-y-2">
        <Label>Cơ sở</Label>
        <p className="min-h-11 flex items-center text-sm">{schools.find((s) => s.id === schoolId)?.name ?? "—"}</p>
      </div>
    );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Thêm nhân viên"
        breadcrumbs={[{ label: "Nhân sự", to: "/nhan-su" }, { label: "Thêm nhân viên" }]}
        actions={
          <Button type="button" variant="outline" onClick={() => setScanOpen(true)} className="min-h-11">
            <ScanLine className="w-4 h-4 mr-2" /> Quét CCCD
          </Button>
        }
      />
      {cccd && (cccd.front || cccd.back) && (
        <p className="mb-4 text-sm text-muted-foreground">
          Ảnh CCCD ({[cccd.front && "mặt trước", cccd.back && "mặt sau"].filter(Boolean).join(", ")}) sẽ được lưu vào giấy tờ của nhân viên.
        </p>
      )}

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <StaffFormFields form={form} schoolField={schoolField} />

          {canCreateAccounts && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tài khoản đăng nhập</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={createAccount} onCheckedChange={(v) => setCreateAccount(v === true)} />
                  Tạo tài khoản đăng nhập và gửi email mời đặt mật khẩu (dùng email ở trên)
                </label>
                {createAccount && (
                  <div className="space-y-2 max-w-sm">
                    <Label>Vai trò</Label>
                    <Select value={role ?? ""} onValueChange={(v) => setAccountRole(v as RoleCode)}>
                      <SelectTrigger className="min-h-11" aria-label="Vai trò tài khoản">
                        <SelectValue placeholder="Chọn vai trò" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Vai trò áp dụng tại cơ sở làm việc của nhân viên.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/nhan-su")} className="min-h-11">
              Hủy
            </Button>
            <Button type="submit" disabled={create.isPending} className="min-h-11">
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {create.isPending ? "Đang lưu..." : "Thêm nhân viên"}
            </Button>
          </div>
        </form>
      </Form>

      <CccdScanDialog open={scanOpen} onOpenChange={setScanOpen} onApply={applyScan} />
    </div>
  );
}

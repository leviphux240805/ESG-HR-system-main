import { useEffect, useState } from "react";
import { type FieldValues, type UseFormReturn, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { z } from "zod";
import { api, unwrap } from "@/api/client";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSheet } from "@/components/common/FormSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ROLE_LABELS } from "@/lib/navigation";
import { TextField } from "@/features/staff/profile/fields";
import type { AccountItem, RoleCode } from "./api";
import { ROLE_SCOPE, type RoleRow, roleRowErrors, toAccountRoles } from "./roles";

const CHAIN = "__chain__";

const rolesField = z
  .array(z.custom<RoleRow>())
  .min(1, "Cần ít nhất một vai trò")
  .superRefine((rows, ctx) => {
    roleRowErrors(rows).forEach((message, index) => {
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index], message });
    });
  });

/** Các dòng "vai trò + cơ sở"; vai trò toàn chuỗi không chọn cơ sở, kế toán chọn toàn chuỗi hoặc một cơ sở. */
function RolesEditor<T extends FieldValues>({ form }: { form: UseFormReturn<T> }) {
  const { me } = useAuth();
  const { schools } = useCurrentSchool();
  const f = form as unknown as UseFormReturn<{ roles: RoleRow[] }>;
  const rows = f.watch("roles");
  const isOwner = !!me?.roles.some((r) => r.role === "OWNER");
  const roleOptions = (Object.keys(ROLE_LABELS) as RoleCode[]).filter((r) => r !== "OWNER" || isOwner);
  const errors = f.formState.errors.roles as unknown as ({ message?: string } | undefined)[] & { message?: string };

  const update = (index: number, patch: Partial<RoleRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    f.setValue("roles", next, { shouldDirty: true, shouldValidate: f.formState.isSubmitted });
  };

  return (
    <div className="space-y-2">
      <Label>
        Vai trò<span className="text-destructive ml-0.5">*</span>
      </Label>
      {rows.map((row, index) => {
        const scope = row.role ? ROLE_SCOPE[row.role] : "SCHOOL";
        return (
          <div key={index} className="space-y-1" data-testid={`role-row-${index}`}>
            <div className="flex gap-2">
              <Select
                value={row.role}
                onValueChange={(value) =>
                  update(index, { role: value as RoleCode, schoolId: ROLE_SCOPE[value as RoleCode] === "CHAIN" ? "" : row.schoolId })
                }
              >
                <SelectTrigger className="min-h-11 flex-1" aria-label={`Vai trò ${index + 1}`}>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={row.schoolId || (scope === "SCHOOL" ? "" : CHAIN)}
                onValueChange={(value) => update(index, { schoolId: value === CHAIN ? "" : value })}
                disabled={scope === "CHAIN"}
              >
                <SelectTrigger className="min-h-11 flex-1" aria-label={`Cơ sở ${index + 1}`}>
                  <SelectValue placeholder="Chọn cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  {scope !== "SCHOOL" && <SelectItem value={CHAIN}>Toàn chuỗi</SelectItem>}
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => f.setValue("roles", rows.filter((_, i) => i !== index), { shouldDirty: true })}
                disabled={rows.length === 1}
                aria-label={`Bỏ vai trò ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {errors?.[index]?.message && <p className="text-sm font-medium text-destructive">{errors[index]!.message}</p>}
          </div>
        );
      })}
      {errors?.message && <p className="text-sm font-medium text-destructive">{errors.message}</p>}
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => f.setValue("roles", [...rows, { role: "", schoolId: "" }], { shouldDirty: true })}
      >
        <Plus className="w-4 h-4 mr-2" /> Thêm vai trò
      </Button>
    </div>
  );
}

// ---- chọn hồ sơ nhân viên

interface PickedStaff {
  id: string;
  label: string;
}

/** Tìm hồ sơ nhân viên (theo cơ sở đang chọn) để gắn với tài khoản. */
function StaffPicker({ value, onChange }: { value: PickedStaff | null; onChange: (staff: PickedStaff | null) => void }) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const results = useQuery({
    queryKey: ["staff", "picker", debounced],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/staff", { params: { query: { q: debounced, size: 8, status: "ACTIVE" } } })).items,
    enabled: !value && debounced.trim().length >= 2,
  });

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 min-h-11">
        <span className="flex-1 text-sm">{value.label}</span>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => onChange(null)} aria-label="Bỏ gắn hồ sơ">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã NV, SĐT" aria-label="Tìm hồ sơ nhân viên" className="min-h-11" />
      {results.data && results.data.length > 0 && (
        <ul className="rounded-md border divide-y" aria-label="Kết quả tìm hồ sơ">
          {results.data.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full text-left px-3 min-h-11 text-sm hover:bg-accent"
                onClick={() => onChange({ id: s.id, label: `${s.fullName} (${s.staffCode}) · ${s.schoolName}` })}
              >
                {s.fullName} <span className="text-muted-foreground">({s.staffCode}) · {s.schoolName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.data && results.data.length === 0 && <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ.</p>}
    </div>
  );
}

// ---- tạo tài khoản

const createSchema = z
  .object({
    email: z.string().trim().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[0-9 +().-]{9,20}$/.test(v), "Số điện thoại không hợp lệ")
      .default(""),
    fullName: z.string().trim().max(200).default(""),
    staff: z.custom<PickedStaff | null>().default(null),
    roles: rolesField,
  })
  .refine((v) => !!v.staff || v.fullName !== "", { path: ["fullName"], message: "Nhập họ tên hoặc gắn hồ sơ nhân viên" });
type CreateValues = z.infer<typeof createSchema>;

const emptyCreate = (): CreateValues => ({ email: "", phone: "", fullName: "", staff: null, roles: [{ role: "", schoolId: "" }] });

export function CreateAccountSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: emptyCreate() });
  useEffect(() => {
    if (open) form.reset(emptyCreate());
  }, [open, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tạo tài khoản"
      description="Người dùng nhận email mời tự đặt mật khẩu (link hiệu lực 7 ngày)."
      form={form}
      submitLabel="Tạo và gửi email mời"
      successMessage="Đã tạo tài khoản và gửi email mời."
      onSubmit={async (v) => {
        unwrap(
          await api.POST("/api/v1/accounts", {
            body: {
              email: v.email,
              phone: v.phone || undefined,
              fullName: v.fullName || undefined,
              staffId: v.staff?.id,
              roles: toAccountRoles(v.roles),
            },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }}
    >
      <FormField
        control={form.control}
        name="staff"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Hồ sơ nhân viên</FormLabel>
            <StaffPicker value={field.value} onChange={field.onChange} />
            <FormMessage />
          </FormItem>
        )}
      />
      <TextField form={form} name="fullName" label="Họ tên" description="Bỏ trống khi đã gắn hồ sơ nhân viên." />
      <TextField form={form} name="email" label="Email đăng nhập" required />
      <TextField form={form} name="phone" label="Số điện thoại đăng nhập" inputMode="numeric" />
      <RolesEditor form={form} />
    </FormSheet>
  );
}

// ---- sửa vai trò

const rolesSchema = z.object({ roles: rolesField });
type RolesValues = z.infer<typeof rolesSchema>;

export function EditRolesSheet({ account, onClose }: { account: AccountItem | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const initial = (): RolesValues => ({
    roles: (account?.roles ?? []).map((r) => ({ role: r.role, schoolId: r.schoolId ?? "" })),
  });
  const form = useForm<RolesValues>({ resolver: zodResolver(rolesSchema), defaultValues: initial() });
  useEffect(() => {
    if (account) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở tài khoản khác
  }, [account]);

  return (
    <FormSheet
      open={account !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Vai trò"
      description={account ? `${account.fullName} – ${account.email}` : undefined}
      form={form}
      successMessage="Đã lưu vai trò."
      onSubmit={async (v) => {
        unwrap(
          await api.PUT("/api/v1/accounts/{id}/roles", {
            params: { path: { id: account!.id } },
            body: { roles: toAccountRoles(v.roles) },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }}
    >
      <RolesEditor form={form} />
    </FormSheet>
  );
}

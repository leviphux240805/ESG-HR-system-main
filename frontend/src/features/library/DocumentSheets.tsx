import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, unwrap } from "@/api/client";
import type { StoredFile } from "@/api/files";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/common/FileUpload";
import { FormSheet } from "@/components/common/FormSheet";
import { SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { ROLE_LABELS } from "@/lib/navigation";
import { type FolderDto, type LibraryDocumentItem, type LibraryRole } from "./api";
import { foldersForScope, type PublishScope } from "./scope";

const ROLES = Object.keys(ROLE_LABELS) as LibraryRole[];
const NO_FOLDER = "none";
const CHAIN = "chain";

const baseSchema = z
  .object({
    scope: z.string().min(1, "Vui lòng chọn phạm vi"),
    folder: z.string().default(NO_FOLDER),
    title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(300),
    docNumber: z.string().trim().max(50).default(""),
    issuedDate: z.string().default(""),
    effectiveTo: z.string().default(""),
    visibleRoles: z.array(z.string()).default([]),
    requireAck: z.boolean().default(false),
    file: z.custom<StoredFile | null>().default(null),
    note: z.string().trim().max(500).default(""),
  })
  .refine((v) => !v.issuedDate || !v.effectiveTo || v.effectiveTo >= v.issuedDate, {
    path: ["effectiveTo"],
    message: "Ngày hết hiệu lực phải sau ngày ban hành",
  });
type Values = z.infer<typeof baseSchema>;

/** Ban hành mới thì bắt buộc có tệp; sửa thông tin thì không có ô tệp. */
const createSchema = baseSchema.refine((v) => !!v.file, { path: ["file"], message: "Vui lòng tải tệp văn bản lên" });

const scopeValue = (schoolId: string | null | undefined) => schoolId ?? CHAIN;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderDto[];
  scopes: PublishScope[];
  /** Có = sửa văn bản (không đổi phạm vi, tệp đổi bằng phiên bản mới). */
  document?: LibraryDocumentItem;
  /** Thư mục đang mở khi ban hành. */
  defaultFolderId?: string;
}

/** Ban hành văn bản mới (phiên bản 1) hoặc sửa thông tin văn bản. */
export function DocumentFormSheet({ open, onOpenChange, folders, scopes, document, defaultFolderId }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const editing = !!document;

  const initial = (): Values => {
    const folder = defaultFolderId ? folders.find((f) => f.id === defaultFolderId) : undefined;
    const scope = document
      ? scopeValue(document.schoolId)
      : folder
        ? scopeValue(folder.schoolId)
        : scopes.length === 1
          ? scopeValue(scopes[0].schoolId)
          : "";
    return {
      scope,
      folder: document?.folderId ?? (folder?.canManage ? folder.id : NO_FOLDER),
      title: document?.title ?? "",
      docNumber: document?.docNumber ?? "",
      issuedDate: document?.issuedDate ?? "",
      effectiveTo: document?.effectiveTo ?? "",
      visibleRoles: document?.visibleRoles ?? [],
      requireAck: document?.requireAck ?? false,
      file: null,
      note: "",
    };
  };
  const form = useForm<Values>({ resolver: zodResolver(editing ? baseSchema : createSchema), defaultValues: initial() });
  useEffect(() => {
    if (open) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở
  }, [open]);

  const scope = form.watch("scope");
  const schoolId = scope === CHAIN ? null : scope || null;
  const folderOptions = [
    { value: NO_FOLDER, label: "Không xếp thư mục" },
    ...foldersForScope(folders, schoolId).map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Sửa thông tin văn bản" : "Ban hành văn bản"}
      description={editing ? "Tệp văn bản đổi bằng “Phiên bản mới”." : undefined}
      form={form}
      submitLabel={editing ? "Lưu" : "Ban hành"}
      successMessage={editing ? "Đã lưu văn bản." : "Đã ban hành văn bản."}
      onSubmit={async (v) => {
        const common = {
          folderId: v.folder === NO_FOLDER ? undefined : v.folder,
          title: v.title,
          docNumber: v.docNumber || undefined,
          issuedDate: v.issuedDate || undefined,
          effectiveTo: v.effectiveTo || undefined,
          visibleRoles: v.visibleRoles as LibraryRole[],
          requireAck: v.requireAck,
        };
        if (document) {
          unwrap(await api.PUT("/api/v1/library/documents/{id}", { params: { path: { id: document.id } }, body: common }));
          await queryClient.invalidateQueries({ queryKey: ["library"] });
          return;
        }
        const created = unwrap(
          await api.POST("/api/v1/library/documents", {
            body: { ...common, schoolId: schoolId ?? undefined, fileId: v.file!.id, note: v.note || undefined },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["library"] });
        navigate(`/tai-lieu/${created.document.id}`);
      }}
    >
      {!editing && (
        <SelectField
          form={form}
          name="scope"
          label="Phạm vi"
          required
          options={scopes.map((s) => ({ value: scopeValue(s.schoolId), label: s.label }))}
        />
      )}
      <SelectField form={form} name="folder" label="Thư mục" options={folderOptions} />
      <TextField form={form} name="title" label="Tiêu đề" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="docNumber" label="Số hiệu" placeholder="12/2026/QĐ-HS" />
        <TextField form={form} name="issuedDate" label="Ngày ban hành" type="date" />
        <TextField form={form} name="effectiveTo" label="Hiệu lực đến" type="date" description="Bỏ trống nếu không thời hạn." />
      </div>
      <FormField
        control={form.control}
        name="visibleRoles"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Vai trò được xem</FormLabel>
            <FormDescription>Không chọn = mọi vai trò trong phạm vi.</FormDescription>
            <div className="grid grid-cols-2 gap-1">
              {ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm min-h-11">
                  <Checkbox
                    checked={field.value.includes(role)}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? [...field.value, role] : field.value.filter((r) => r !== role))
                    }
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="requireAck"
        render={({ field }) => (
          <FormItem className="flex items-start justify-between gap-4 rounded-md border p-3 space-y-0">
            <div>
              <FormLabel>Yêu cầu xác nhận đã đọc</FormLabel>
              <FormDescription>Nhân viên trong phạm vi phải bấm “Tôi đã đọc”; bạn xem được ai chưa đọc và nhắc lại.</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Yêu cầu xác nhận đã đọc" />
            </FormControl>
          </FormItem>
        )}
      />
      {!editing && (
        <>
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem>
                <FileUpload
                  label="Tệp văn bản"
                  required
                  schoolId={schoolId ?? undefined}
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <TextAreaField form={form} name="note" label="Ghi chú phiên bản" />
        </>
      )}
    </FormSheet>
  );
}

// ---- phiên bản mới

const versionSchema = z.object({
  file: z.custom<StoredFile | null>().refine((f) => !!f, "Vui lòng tải tệp lên"),
  note: z.string().trim().max(500).default(""),
  requireReack: z.boolean().default(true),
});
type VersionValues = z.infer<typeof versionSchema>;

export function VersionSheet({
  document,
  open,
  onOpenChange,
}: {
  document: LibraryDocumentItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<VersionValues>({ resolver: zodResolver(versionSchema), defaultValues: { file: null, note: "", requireReack: true } });
  useEffect(() => {
    if (open) form.reset({ file: null, note: "", requireReack: true });
  }, [open, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Phiên bản mới (v${document.currentVersionNo + 1})`}
      description="Các phiên bản cũ vẫn được giữ và tải được."
      form={form}
      submitLabel="Tải lên"
      successMessage="Đã thêm phiên bản mới."
      onSubmit={async (v) => {
        unwrap(
          await api.POST("/api/v1/library/documents/{id}/versions", {
            params: { path: { id: document.id } },
            body: { fileId: v.file!.id, note: v.note || undefined, requireReack: document.requireAck && v.requireReack },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["library"] });
      }}
    >
      <FormField
        control={form.control}
        name="file"
        render={({ field }) => (
          <FormItem>
            <FileUpload label="Tệp" required schoolId={document.schoolId} value={field.value} onChange={field.onChange} />
            <FormMessage />
          </FormItem>
        )}
      />
      <TextAreaField form={form} name="note" label="Nội dung sửa đổi" />
      {document.requireAck && (
        <FormField
          control={form.control}
          name="requireReack"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
              </FormControl>
              <FormLabel className="font-normal">Yêu cầu mọi người xác nhận lại phiên bản này</FormLabel>
            </FormItem>
          )}
        />
      )}
    </FormSheet>
  );
}

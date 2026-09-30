import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/common/FormSheet";
import { addStaffDocument, type DocumentTypeDto, type FileRef, type StaffDetail } from "../api";
import { AttachmentField } from "./AttachmentField";

const schema = z
  .object({
    documentTypeId: z.string().min(1, "Vui lòng chọn loại giấy tờ"),
    file: z.custom<FileRef | null>().refine((f) => !!f, "Vui lòng tải tệp lên"),
    issuedDate: z.string().default(""),
    expiryDate: z.string().default(""),
    note: z.string().trim().max(500).default(""),
  })
  .refine((v) => !v.issuedDate || !v.expiryDate || v.expiryDate > v.issuedDate, {
    path: ["expiryDate"],
    message: "Ngày hết hạn phải sau ngày cấp",
  });

type Values = z.infer<typeof schema>;

interface Props {
  staff: StaffDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Loại giấy tờ được chọn. */
  types: DocumentTypeDto[];
  /** Chọn sẵn loại (tải phiên bản mới). */
  presetTypeId?: string;
}

/** Tải lên giấy tờ: mỗi lần tải là một phiên bản mới của loại đó, bản cũ vẫn giữ. */
export function DocumentSheet({ staff, open, onOpenChange, types, presetTypeId }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { documentTypeId: "", file: null, issuedDate: "", expiryDate: "", note: "" },
  });

  useEffect(() => {
    if (open) form.reset({ documentTypeId: presetTypeId ?? "", file: null, issuedDate: "", expiryDate: "", note: "" });
  }, [open, presetTypeId, form]);

  const typeId = form.watch("documentTypeId");
  const type = types.find((t) => t.id === typeId);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={presetTypeId ? `Phiên bản mới: ${type?.name ?? ""}` : "Tải lên giấy tờ"}
      description="Bản cũ vẫn được giữ trong lịch sử phiên bản."
      form={form}
      submitLabel="Tải lên"
      successMessage="Đã lưu giấy tờ."
      onSubmit={async (v) => {
        await addStaffDocument(staff.id, {
          documentTypeId: v.documentTypeId,
          fileId: v.file!.id,
          issuedDate: v.issuedDate || undefined,
          expiryDate: type?.hasExpiry && v.expiryDate ? v.expiryDate : undefined,
          note: v.note || undefined,
        });
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <FormField
        control={form.control}
        name="documentTypeId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Loại giấy tờ<span className="text-destructive ml-0.5">*</span>
            </FormLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={!!presetTypeId}>
              <FormControl>
                <SelectTrigger className="min-h-11" aria-label="Loại giấy tờ">
                  <SelectValue placeholder="Chọn loại giấy tờ" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="file"
        render={({ field }) => (
          <FormItem>
            <AttachmentField label="Tệp" required staffId={staff.id} schoolId={staff.schoolId} value={field.value} onChange={field.onChange} />
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="issuedDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày cấp</FormLabel>
              <FormControl>
                <Input type="date" className="min-h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {type?.hasExpiry && (
          <FormField
            control={form.control}
            name="expiryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày hết hạn</FormLabel>
                <FormControl>
                  <Input type="date" className="min-h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ghi chú</FormLabel>
            <FormControl>
              <Textarea rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormSheet>
  );
}

import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { deleteCertificate, deleteTraining, saveCertificate, saveTraining } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { FormSheet } from "@/components/common/FormSheet";
import { formatDate } from "@/lib/format";
import { type CertificateDto, type FileRef, type StaffDetail, type TrainingDto, useCertificates, useTrainings } from "@/api";
import { QUALIFICATION_LABELS } from "../labels";
import { AttachmentField } from "./AttachmentField";
import { ExpiryBadge } from "./DocumentsTab";
import { TextField } from "./fields";
import { FileLink, FilePreviewDialog } from "./FilePreviewDialog";
import { RecordCard } from "./RecordCard";

const fileField = z.custom<FileRef | null>().default(null);

// ---- chứng chỉ

const certificateSchema = z
  .object({
    name: z.string().trim().min(1, "Vui lòng nhập tên chứng chỉ").max(200),
    issuedBy: z.string().trim().max(200).default(""),
    issueDate: z.string().default(""),
    expiryDate: z.string().default(""),
    file: fileField,
  })
  .refine((v) => !v.issueDate || !v.expiryDate || v.expiryDate > v.issueDate, {
    path: ["expiryDate"],
    message: "Ngày hết hạn phải sau ngày cấp",
  });
type CertificateValues = z.infer<typeof certificateSchema>;

const toCertificateValues = (c?: CertificateDto): CertificateValues => ({
  name: c?.name ?? "",
  issuedBy: c?.issuedBy ?? "",
  issueDate: c?.issueDate ?? "",
  expiryDate: c?.expiryDate ?? "",
  file: c?.file ?? null,
});

// ---- đào tạo

const trainingSchema = z
  .object({
    courseName: z.string().trim().min(1, "Vui lòng nhập tên khóa học").max(200),
    provider: z.string().trim().max(200).default(""),
    startDate: z.string().default(""),
    endDate: z.string().default(""),
    result: z.string().trim().max(200).default(""),
    file: fileField,
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "Ngày kết thúc phải sau ngày bắt đầu",
  });
type TrainingValues = z.infer<typeof trainingSchema>;

const toTrainingValues = (t?: TrainingDto): TrainingValues => ({
  courseName: t?.courseName ?? "",
  provider: t?.provider ?? "",
  startDate: t?.startDate ?? "",
  endDate: t?.endDate ?? "",
  result: t?.result ?? "",
  file: t?.file ?? null,
});

const blank = (v: string) => (v === "" ? undefined : v);

interface SheetProps<T> {
  staff: StaffDetail;
  row?: T;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ô tệp đính kèm trong FormField (giá trị là FileRef đã tải lên). */
const attachment =
  (staff: StaffDetail, initial?: FileRef | null) =>
  ({ field }: { field: { value: FileRef | null; onChange: (file: FileRef | null) => void } }) => (
    <FormItem>
      <AttachmentField label="Bản scan (PDF/ảnh)" staffId={staff.id} schoolId={staff.schoolId} value={field.value} onChange={field.onChange} initial={initial} />
      <FormMessage />
    </FormItem>
  );

function CertificateSheet({ staff, row, open, onOpenChange }: SheetProps<CertificateDto>) {
  const queryClient = useQueryClient();
  const form = useForm<CertificateValues>({ resolver: zodResolver(certificateSchema), defaultValues: toCertificateValues(row) });
  useEffect(() => {
    if (open) form.reset(toCertificateValues(row));
  }, [open, row, form]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Sửa chứng chỉ" : "Thêm chứng chỉ"}
      form={form}
      successMessage="Đã lưu chứng chỉ."
      onSubmit={async (v) => {
        const body = { name: v.name, issuedBy: blank(v.issuedBy), issueDate: blank(v.issueDate), expiryDate: blank(v.expiryDate), fileId: v.file?.id };
        if (row) {
          await saveCertificate(staff.id, row.id, body);
        } else {
          await saveCertificate(staff.id, null, body);
        }
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <TextField form={form} name="name" label="Tên chứng chỉ" required placeholder="Chứng chỉ bồi dưỡng CBQL, sơ cấp cứu…" />
      <TextField form={form} name="issuedBy" label="Nơi cấp" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="issueDate" label="Ngày cấp" type="date" />
        <TextField form={form} name="expiryDate" label="Ngày hết hạn" type="date" description="Bỏ trống nếu không có hạn." />
      </div>
      <FormField control={form.control} name="file" render={attachment(staff, row?.file)} />
    </FormSheet>
  );
}

function TrainingSheet({ staff, row, open, onOpenChange }: SheetProps<TrainingDto>) {
  const queryClient = useQueryClient();
  const form = useForm<TrainingValues>({ resolver: zodResolver(trainingSchema), defaultValues: toTrainingValues(row) });
  useEffect(() => {
    if (open) form.reset(toTrainingValues(row));
  }, [open, row, form]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Sửa khóa đào tạo" : "Thêm khóa đào tạo"}
      form={form}
      successMessage="Đã lưu khóa đào tạo."
      onSubmit={async (v) => {
        const body = {
          courseName: v.courseName,
          provider: blank(v.provider),
          startDate: blank(v.startDate),
          endDate: blank(v.endDate),
          result: blank(v.result),
          fileId: v.file?.id,
        };
        if (row) {
          await saveTraining(staff.id, row.id, body);
        } else {
          await saveTraining(staff.id, null, body);
        }
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <TextField form={form} name="courseName" label="Tên khóa học" required />
      <TextField form={form} name="provider" label="Đơn vị tổ chức" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="startDate" label="Từ ngày" type="date" />
        <TextField form={form} name="endDate" label="Đến ngày" type="date" />
      </div>
      <TextField form={form} name="result" label="Kết quả" placeholder="Đạt, Giỏi…" />
      <FormField control={form.control} name="file" render={attachment(staff, row?.file)} />
    </FormSheet>
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-0.5">{children || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

/** Tab "Trình độ": trình độ chuyên môn, chứng chỉ (có hạn), khóa đào tạo. */
export function QualificationsTab({ staff }: { staff: StaffDetail }) {
  const queryClient = useQueryClient();
  const certificates = useCertificates(staff.id);
  const trainings = useTrainings(staff.id);
  const [certificate, setCertificate] = useState<{ row?: CertificateDto } | null>(null);
  const [training, setTraining] = useState<{ row?: TrainingDto } | null>(null);
  const [preview, setPreview] = useState<FileRef | null>(null);
  const canEdit = staff.permissions.canEdit && staff.status === "ACTIVE";
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff"] });
  const fileCell = (file?: FileRef | null) =>
    file ? (
      <div className="max-w-[14rem]">
        <FileLink staffId={staff.id} file={file} onPreview={setPreview} />
      </div>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trình độ chuyên môn</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label="Trình độ">{staff.qualification && QUALIFICATION_LABELS[staff.qualification]}</Row>
            <Row label="Chuyên ngành">{staff.specialization}</Row>
          </dl>
          {canEdit && <p className="text-xs text-muted-foreground mt-3">Sửa trình độ ở tab Thông tin cá nhân.</p>}
        </CardContent>
      </Card>

      <RecordCard
        title="Chứng chỉ"
        addLabel="Thêm chứng chỉ"
        emptyText="Chưa có chứng chỉ."
        canEdit={canEdit}
        query={certificates}
        columns={[
          { header: "Tên", cell: (c) => <span className="font-medium">{c.name}</span> },
          { header: "Nơi cấp", cell: (c) => c.issuedBy ?? "" },
          { header: "Ngày cấp", cell: (c) => formatDate(c.issueDate) },
          {
            header: "Hết hạn",
            className: "whitespace-nowrap",
            cell: (c) =>
              c.expiryDate ? (
                <div className="flex items-center gap-2">
                  {formatDate(c.expiryDate)} <ExpiryBadge date={c.expiryDate} />
                </div>
              ) : (
                "Không thời hạn"
              ),
          },
          { header: "Tệp", cell: (c) => fileCell(c.file) },
        ]}
        onAdd={() => setCertificate({})}
        onEdit={(row) => setCertificate({ row })}
        describe={(c) => `Chứng chỉ “${c.name}”`}
        onDelete={async (c) => {
          await deleteCertificate(staff.id, c.id);
          await invalidate();
        }}
      />

      <RecordCard
        title="Đào tạo, bồi dưỡng"
        addLabel="Thêm khóa đào tạo"
        emptyText="Chưa có khóa đào tạo."
        canEdit={canEdit}
        query={trainings}
        columns={[
          { header: "Khóa học", cell: (t) => <span className="font-medium">{t.courseName}</span> },
          { header: "Đơn vị", cell: (t) => t.provider ?? "" },
          {
            header: "Thời gian",
            className: "whitespace-nowrap",
            cell: (t) => [formatDate(t.startDate), formatDate(t.endDate)].filter(Boolean).join(" – "),
          },
          { header: "Kết quả", cell: (t) => t.result ?? "" },
          { header: "Tệp", cell: (t) => fileCell(t.file) },
        ]}
        onAdd={() => setTraining({})}
        onEdit={(row) => setTraining({ row })}
        describe={(t) => `Khóa “${t.courseName}”`}
        onDelete={async (t) => {
          await deleteTraining(staff.id, t.id);
          await invalidate();
        }}
      />

      <CertificateSheet staff={staff} row={certificate?.row} open={certificate !== null} onOpenChange={(o) => !o && setCertificate(null)} />
      <TrainingSheet staff={staff} row={training?.row} open={training !== null} onOpenChange={(o) => !o && setTraining(null)} />
      <FilePreviewDialog staffId={staff.id} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/common/FileUpload";
import type { StoredFile } from "@/api";
import type { FileRef } from "@/api";
import { FileLink, FilePreviewDialog } from "./FilePreviewDialog";

interface Props {
  label: string;
  staffId: string;
  /** Cơ sở sở hữu file mới tải lên (cơ sở của nhân viên). */
  schoolId: string;
  value: FileRef | null;
  onChange: (file: FileRef | null) => void;
  /** Tệp đang gắn trước khi sửa: xem trước qua quyền hồ sơ; tệp mới tải lên dùng ô upload chuẩn. */
  initial?: FileRef | null;
  required?: boolean;
}

/** Tệp đính kèm của mục hồ sơ (hợp đồng, giấy tờ, chứng chỉ…). */
export function AttachmentField({ label, staffId, schoolId, value, onChange, initial, required }: Props) {
  const [preview, setPreview] = useState<FileRef | null>(null);

  if (value && initial && value.id === initial.id) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2 rounded-md border px-3">
          <div className="flex-1 min-w-0">
            <FileLink staffId={staffId} file={value} onPreview={setPreview} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => onChange(null)}
            aria-label={`Gỡ ${value.originalName}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <FilePreviewDialog staffId={staffId} file={preview} onClose={() => setPreview(null)} />
      </div>
    );
  }

  return (
    <FileUpload
      label={label}
      required={required}
      schoolId={schoolId}
      value={value as StoredFile | null}
      onChange={(file) => onChange(file)}
    />
  );
}

import { Paperclip } from "lucide-react";
import { FilePreviewDialog as BasePreview } from "@/components/common/FilePreviewDialog";
import { type FileRef, staffFileUrl } from "@/api";
import { canPreview, downloadStaffFile } from "../files";

/** Xem trước tệp thuộc hồ sơ (link ký theo quyền hồ sơ). */
export function FilePreviewDialog({ staffId, file, onClose }: { staffId: string; file: FileRef | null; onClose: () => void }) {
  return <BasePreview file={file} loadUrl={(inline) => staffFileUrl(staffId, file!.id, inline)} onClose={onClose} />;
}

/** Tên tệp bấm được: PDF/ảnh mở xem trước, loại khác tải về. */
export function FileLink({ staffId, file, onPreview }: { staffId: string; file: FileRef; onPreview: (file: FileRef) => void }) {
  return (
    <button
      type="button"
      onClick={() => (canPreview(file.mimeType) ? onPreview(file) : downloadStaffFile(staffId, file))}
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline max-w-full min-h-11 text-left"
      title={file.originalName}
    >
      <Paperclip className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{file.originalName}</span>
    </button>
  );
}

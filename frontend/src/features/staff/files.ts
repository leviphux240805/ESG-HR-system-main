import { canPreviewMime, openDownload } from "@/lib/filePreview";
import { type FileRef, staffFileUrl } from "@/api";

export const canPreview = canPreviewMime;

/** Tải tệp thuộc hồ sơ (link ký có Content-Disposition) ở tab mới. */
export function downloadStaffFile(staffId: string, file: FileRef) {
  return openDownload((inline) => staffFileUrl(staffId, file.id, inline));
}

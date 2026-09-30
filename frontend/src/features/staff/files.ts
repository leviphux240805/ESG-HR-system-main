import { toast } from "sonner";
import { errorMessage } from "@/api/errors";
import { type FileRef, staffFileUrl } from "./api";

export const isImage = (mime: string) => mime.startsWith("image/");
export const isPdf = (mime: string) => mime === "application/pdf";
/** PDF và ảnh xem trước được trong trình duyệt; loại khác chỉ tải về. */
export const canPreview = (mime: string) => isImage(mime) || isPdf(mime);

/** Tải tệp thuộc hồ sơ (link ký có Content-Disposition) ở tab mới. */
export async function downloadStaffFile(staffId: string, file: FileRef) {
  try {
    window.open(await staffFileUrl(staffId, file.id), "_blank", "noopener");
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

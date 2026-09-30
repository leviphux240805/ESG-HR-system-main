import { toast } from "sonner";
import { errorMessage } from "@/api/errors";

export const isImageMime = (mime: string) => mime.startsWith("image/");
/** PDF và ảnh xem trước được trong trình duyệt; loại khác (Word, Excel) chỉ tải về. */
export const canPreviewMime = (mime: string) => isImageMime(mime) || mime === "application/pdf";

/** Mở link tải (có Content-Disposition) ở tab mới; lỗi báo toast. */
export async function openDownload(loadUrl: (inline: boolean) => Promise<string>) {
  try {
    window.open(await loadUrl(false), "_blank", "noopener");
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

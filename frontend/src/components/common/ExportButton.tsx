import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { fileNameFromDisposition, saveBlob } from "@/api/download";

interface ExportButtonProps {
  /**
   * Gọi API xuất file, ví dụ:
   *   () => api.GET("/api/v1/reports/{name}/export", { params: { path: { name }, query }, parseAs: "blob" })
   */
  request: () => Promise<{ data?: Blob; error?: unknown; response: Response }>;
  /** Tên file dùng khi API không gửi Content-Disposition. */
  fileName?: string;
  label?: string;
}

/** Nút tải Excel từ API (gửi kèm token và cơ sở đang chọn qua API client). */
export function ExportButton({ request, fileName = "du-lieu.xlsx", label = "Xuất Excel" }: ExportButtonProps) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const result = await request();
      const blob = unwrap(result);
      saveBlob(blob, fileNameFromDisposition(result.response.headers.get("Content-Disposition"), fileName));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending} className="min-h-11">
      {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
      {pending ? "Đang xuất..." : label}
    </Button>
  );
}

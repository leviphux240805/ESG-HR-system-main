import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage, type ExportResult, saveExport } from "@/api";

interface ExportButtonProps {
  /** Gọi hàm xuất file của module api, ví dụ `() => exportMonth(month)`. */
  request: () => Promise<ExportResult>;
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
      await saveExport(await request(), fileName);
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

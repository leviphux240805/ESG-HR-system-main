import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { canPreviewMime, isImageMime, openDownload } from "@/lib/filePreview";
import { ErrorState } from "./States";

export interface PreviewFile {
  id: string;
  originalName: string;
  mimeType: string;
}

interface Props {
  file: PreviewFile | null;
  /** Lấy link ký có hạn của module (quyền kiểm tra theo bản ghi chứa file). */
  loadUrl: (inline: boolean) => Promise<string>;
  onClose: () => void;
}

/** Xem trước PDF/ảnh bằng link ký `inline`; loại khác chỉ tải về. */
export function FilePreviewDialog({ file, loadUrl, onClose }: Props) {
  const url = useQuery({
    queryKey: ["file-preview", file?.id],
    queryFn: () => loadUrl(true),
    enabled: !!file && canPreviewMime(file.mimeType),
    // Link ký chỉ sống vài phút: không giữ trong cache
    gcTime: 0,
    staleTime: 0,
  });

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{file?.originalName}</DialogTitle>
          <DialogDescription className="sr-only">Xem trước tệp đính kèm</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-md border bg-muted/30 overflow-auto flex items-center justify-center">
          {file && !canPreviewMime(file.mimeType) ? (
            <div className="text-center space-y-2 p-6">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Không xem trước được loại tệp này. Hãy tải về để mở.</p>
            </div>
          ) : url.isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : url.isError ? (
            <ErrorState error={url.error} onRetry={() => url.refetch()} />
          ) : url.data && file && isImageMime(file.mimeType) ? (
            <img src={url.data} alt={file.originalName} className="max-w-full max-h-full object-contain" />
          ) : url.data ? (
            <iframe src={url.data} title={file?.originalName} className="w-full h-full" />
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => openDownload(loadUrl)}>
            <Download className="w-4 h-4 mr-2" /> Tải về
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

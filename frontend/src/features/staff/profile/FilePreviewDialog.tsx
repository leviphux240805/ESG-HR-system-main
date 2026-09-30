import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { type FileRef, staffFileUrl } from "../api";
import { canPreview, downloadStaffFile, isImage } from "../files";

/** Xem trước PDF/ảnh thuộc hồ sơ bằng link ký `inline`; loại khác (Word, Excel) chỉ tải về. */
export function FilePreviewDialog({
  staffId,
  file,
  onClose,
}: {
  staffId: string;
  file: FileRef | null;
  onClose: () => void;
}) {
  const url = useQuery({
    queryKey: ["staff-file-preview", staffId, file?.id],
    queryFn: () => staffFileUrl(staffId, file!.id, true),
    enabled: !!file && canPreview(file.mimeType),
    // Link ký chỉ sống vài phút: không giữ lâu trong cache
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
          {file && !canPreview(file.mimeType) ? (
            <div className="text-center space-y-2 p-6">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Không xem trước được loại tệp này. Hãy tải về để mở.</p>
            </div>
          ) : url.isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : url.isError ? (
            <ErrorState error={url.error} onRetry={() => url.refetch()} />
          ) : url.data && file && isImage(file.mimeType) ? (
            <img src={url.data} alt={file.originalName} className="max-w-full max-h-full object-contain" />
          ) : url.data ? (
            <iframe src={url.data} title={file?.originalName} className="w-full h-full" />
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => file && downloadStaffFile(staffId, file)}>
            <Download className="w-4 h-4 mr-2" /> Tải về
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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

import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FILE_ACCEPT, type StoredFile } from "@/api";
import { formatBytes } from "@/lib/format";
import { isImageMime } from "@/lib/filePreview";
import { cn } from "@/lib/utils";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { useFileUploader } from "@/hooks/useFileUploader";

export interface AttachmentFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

interface DropzoneProps {
  onFiles: (files: StoredFile[]) => void;
  maxSizeMb?: number;
  schoolId?: string;
  disabled?: boolean;
  className?: string;
  /** Nội dung vùng thả; `button` là nút "Đính kèm" để đặt ở chỗ phù hợp */
  children: (button: ReactNode) => ReactNode;
}

/** Vùng kéo thả + nút chọn file; upload xong (presigned URL, bản demo: blob URL) thì trả file qua `onFiles`. */
export function AttachmentDropzone({ onFiles, maxSizeMb, schoolId, disabled, className, children }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, progress, uploading } = useFileUploader({ schoolId, maxSizeMb });
  const [over, setOver] = useState(false);

  const handle = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0 || disabled) return;
    const uploaded = await upload(files);
    if (uploaded.length) onFiles(uploaded);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files);
  };

  const button = (
    <Button type="button" variant="outline" className="min-h-11" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
      {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
      {uploading && progress ? `Đang tải ${progress.done}/${progress.total}` : "Đính kèm"}
    </Button>
  );

  return (
    <div
      className={cn("relative rounded-lg transition-colors", over && "bg-secondary/60 ring-2 ring-primary", className)}
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={onDrop}
    >
      <input ref={inputRef} name="attachments" type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => handle(e.target.files)} data-testid="attach-input" />
      {children(button)}
      {over && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg text-sm font-medium text-primary">
          Thả file để đính kèm
        </div>
      )}
    </div>
  );
}

function Thumbnail({ file, loadUrl, onOpen }: { file: AttachmentFile; loadUrl: (inline: boolean) => Promise<string>; onOpen: () => void }) {
  // Link ký sống vài phút: giữ ngắn hơn hạn link
  const url = useQuery({ queryKey: ["file-thumb", file.id], queryFn: () => loadUrl(true), staleTime: 4 * 60_000, gcTime: 4 * 60_000 });
  return (
    <button type="button" onClick={onOpen} className="block h-20 w-20 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Xem ${file.originalName}`}>
      {url.data ? <img src={url.data} alt={file.originalName} className="h-full w-full object-cover" /> : <Skeleton className="h-full w-full" />}
    </button>
  );
}

interface ListProps {
  files: AttachmentFile[];
  /** Link ký của module (quyền kiểm tra theo bản ghi chứa file) */
  loadUrl: (fileId: string, inline: boolean) => Promise<string>;
  onRemove?: (file: AttachmentFile) => void;
  className?: string;
}

/** File đính kèm: ảnh hiện thumbnail, file khác hiện chip tên + dung lượng; bấm để xem hoặc tải. */
export function AttachmentList({ files, loadUrl, onRemove, className }: ListProps) {
  const [preview, setPreview] = useState<AttachmentFile | null>(null);
  if (files.length === 0) return null;
  const images = files.filter((f) => isImageMime(f.mimeType));
  const others = files.filter((f) => !isImageMime(f.mimeType));
  const remove = (file: AttachmentFile) =>
    onRemove && (
      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => onRemove(file)} aria-label={`Gỡ ${file.originalName}`}>
        <X className="w-4 h-4" />
      </Button>
    );

  return (
    <div className={cn("space-y-2", className)}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((f) => (
            <div key={f.id} className="flex items-start">
              <Thumbnail file={f} loadUrl={(inline) => loadUrl(f.id, inline)} onOpen={() => setPreview(f)} />
              {remove(f)}
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((f) => (
            <div key={f.id} className="flex max-w-full items-center rounded-full border bg-background pl-1">
              <button type="button" onClick={() => setPreview(f)} className="flex min-h-11 min-w-0 items-center gap-2 rounded-full px-2 text-sm hover:text-primary">
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.originalName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
              </button>
              {remove(f)}
            </div>
          ))}
        </div>
      )}
      <FilePreviewDialog file={preview} loadUrl={(inline) => loadUrl(preview!.id, inline)} onClose={() => setPreview(null)} />
    </div>
  );
}

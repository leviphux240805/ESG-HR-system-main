import { useRef, useState } from "react";
import { Download, FileText, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FILE_ACCEPT, MAX_FILE_MB, openFile, type StoredFile, uploadFile, validateFile } from "@/api";
import { errorMessage } from "@/api";
import { cn } from "@/lib/utils";

interface BaseProps {
  label: string;
  required?: boolean;
  disabled?: boolean;
  /** Cơ sở sở hữu file; bỏ trống = cơ sở đang chọn. */
  schoolId?: string;
  accept?: string;
  maxSizeMb?: number;
  className?: string;
}

async function download(file: StoredFile) {
  try {
    await openFile(file.id);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function FileRow({ file, onRemove, disabled }: { file: StoredFile; onRemove?: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="truncate flex-1" title={file.originalName}>
        {file.originalName}
      </span>
      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => download(file)} aria-label={`Tải về ${file.originalName}`}>
        <Download className="w-4 h-4" />
      </Button>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onRemove} disabled={disabled} aria-label={`Gỡ ${file.originalName}`}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

interface FileUploadProps extends BaseProps {
  value: StoredFile | null;
  onChange: (file: StoredFile | null) => void;
}

/**
 * Chọn và upload một file qua presigned URL (thay DocumentUploadField cũ). Giá trị là file đã upload xong
 * (READY); form của module lưu `value.id` vào cột file_id.
 */
export function FileUpload({
  value,
  onChange,
  label,
  required,
  disabled,
  schoolId,
  accept = FILE_ACCEPT,
  maxSizeMb = MAX_FILE_MB,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const problem = validateFile(file, maxSizeMb);
    if (problem) return void toast.error(problem);
    setUploading(true);
    try {
      onChange(await uploadFile(file, schoolId));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0])}
        disabled={disabled || uploading}
        data-testid="file-input"
      />
      {value ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <FileRow file={value} onRemove={disabled ? undefined : () => onChange(null)} disabled={uploading} />
          </div>
          {!disabled && (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Thay đổi"}
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex w-full items-center gap-2 min-h-11 px-3 border border-dashed border-input rounded-md text-sm text-muted-foreground hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Đang tải lên..." : "Chọn tệp..."}
        </button>
      )}
    </div>
  );
}

interface MultiFileUploadProps extends BaseProps {
  value: StoredFile[];
  onChange: (files: StoredFile[]) => void;
}

/** Upload nhiều file (thay MultiDocumentUploadField cũ); tải lần lượt, file lỗi báo riêng, file hợp lệ vẫn được thêm. */
export function MultiFileUpload({
  value,
  onChange,
  label,
  required,
  disabled,
  schoolId,
  accept = FILE_ACCEPT,
  maxSizeMb = MAX_FILE_MB,
  className,
}: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleSelect = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    const valid: File[] = [];
    for (const file of files) {
      const problem = validateFile(file, maxSizeMb);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    if (valid.length === 0) return;

    const uploaded: StoredFile[] = [];
    setProgress({ done: 0, total: valid.length });
    for (const file of valid) {
      try {
        uploaded.push(await uploadFile(file, schoolId));
      } catch (error) {
        toast.error(`"${file.name}": ${errorMessage(error)}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      toast.success(`Đã tải lên ${uploaded.length} tệp.`);
    }
  };

  const uploading = progress !== null;

  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => handleSelect(e.target.files)}
        disabled={disabled || uploading}
        data-testid="file-input"
      />
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              disabled={uploading}
              onRemove={disabled ? undefined : () => onChange(value.filter((f) => f.id !== file.id))}
            />
          ))}
        </div>
      )}
      {!disabled && (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          {uploading ? `Đang tải lên ${progress.done}/${progress.total}...` : value.length > 0 ? "Thêm tệp" : "Chọn tệp..."}
        </Button>
      )}
    </div>
  );
}

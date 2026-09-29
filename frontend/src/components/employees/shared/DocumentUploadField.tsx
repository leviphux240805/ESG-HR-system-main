import { useState, useEffect, useRef } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getDocumentByTypeCode,
  getSignedDocumentUrl,
  uploadSingleDocument,
} from "@/lib/fileUploader";
import { Employee } from "@/types";
import { toast } from "sonner";

interface DocumentUploadFieldProps {
  employee: Employee | null;
  docTypeCode: string;
  label: string;
  accept?: string;
  required?: boolean;
}

export function DocumentUploadField({
  employee,
  docTypeCode,
  label,
  accept = ".pdf,image/*",
  required = false,
}: DocumentUploadFieldProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing document when component mounts or employee changes
  useEffect(() => {
    if (employee?.id) {
      loadExistingDocument();
    } else {
      // Reset state when no employee
      setFilePath(null);
      setFileName(null);
      setSignedUrl(null);
    }
  }, [employee?.id, docTypeCode]);

  const loadExistingDocument = async () => {
    if (!employee?.id) return;

    setLoading(true);
    try {
      const result = await getDocumentByTypeCode(employee.id, docTypeCode);
      if (result.success && result.paths.length > 0) {
        const path = result.paths[0];
        setFilePath(path);
        // Extract filename from path
        const name = path.split("/").pop() || "document";
        setFileName(name);
        // Get signed URL for download
        const url = await getSignedDocumentUrl(path);
        setSignedUrl(url);
      }
    } catch (error) {
      console.error(`Error loading document ${docTypeCode}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!employee?.id) {
      toast.error("Vui lòng lưu thông tin nhân viên trước khi upload.");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadSingleDocument(file, employee, docTypeCode);

      if (result.success) {
        toast.success(result.message);
        // Reload document info
        await loadExistingDocument();
      } else {
        toast.error(result.message || "Có lỗi xảy ra khi upload file.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Có lỗi xảy ra khi upload file.");
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!signedUrl) return;

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải xuống tệp");
    }
  };

  const hasFile = !!filePath;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading || loading || !employee?.id}
      />

      <div
        className={cn(
          "relative flex items-center gap-2 px-3 py-2.5 border border-input rounded-md transition-colors text-sm group",
          !employee?.id
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-accent/50"
        )}
        onClick={() => {
          if (!uploading && !loading && employee?.id) {
            inputRef.current?.click();
          }
        }}
      >
        <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground truncate flex-1 flex items-center gap-2">
          {(loading || uploading) && <Loader2 className="h-3 w-3 animate-spin" />}
          {loading
            ? "Đang tải..."
            : uploading
            ? "Đang upload..."
            : fileName
            ? fileName
            : "Chọn tệp..."}
        </span>

        {/* Hover overlay with download icon */}
        {hasFile && !uploading && !loading && (
          <div
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center gap-4">
              {signedUrl && (
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/90 text-gray-800 rounded-md text-sm font-medium hover:bg-white transition-colors"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  Tải về
                </button>
              )}
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                Thay đổi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

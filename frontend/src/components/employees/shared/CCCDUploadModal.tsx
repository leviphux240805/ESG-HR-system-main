import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  uploadEmployeeCCCD,
  getCCCDDocumentPaths,
  getSignedDocumentUrl,
} from "@/lib/fileUploader";
import { Employee } from "@/types";
import { toast } from "sonner";

interface CCCDUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

const isPDF = (file: File | string): boolean => {
  if (typeof file === "string") {
    return file.toLowerCase().endsWith(".pdf");
  }
  return file.type === "application/pdf";
};

const isImage = (file: File | string): boolean => {
  if (typeof file === "string") {
    return !isPDF(file);
  }
  return file.type.startsWith("image/");
};

export function CCCDUploadModal({
  open,
  onOpenChange,
  employee,
}: CCCDUploadModalProps) {
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontDragging, setFrontDragging] = useState(false);
  const [backDragging, setBackDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Helper function to download files
  const downloadFile = async (
    url: string | null,
    fileName: string,
    isLocalFile: boolean
  ) => {
    if (!url) return;
    try {
      if (isLocalFile) {
        // For local files (File objects)
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // For signed URLs from Supabase, fetch as blob
        const response = await fetch(url);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải xuống tệp");
    }
  };

  // Load existing CCCD images when modal opens
  useEffect(() => {
    if (open) {
      loadExistingCCCD();
    } else {
      // Reset state when modal closes
      setFrontFile(null);
      setBackFile(null);
      // We don't necessarily need to clear URLs as they are re-fetched on open,
      // but clearing them prevents a flash of old content if re-opened quickly before fetch completes.
      // However, keeping them might be better for UX if we assume same employee.
      // But user complained about "cancel then open again shows new file".
      // The "new file" here is likely `frontFile` state persisting.
      // So wiping `frontFile` and `backFile` is the key fix.
    }
  }, [open]);

  const loadExistingCCCD = async () => {
    setLoading(true);
    try {
      const result = await getCCCDDocumentPaths(employee.id);
      if (result.success && result.paths.length >= 2) {
        // Use transform for optimized image loading (width: 800, quality: 75)
        const frontSignedUrl = await getSignedDocumentUrl(result.paths[0], {
          quality: 75,
        });
        const backSignedUrl = await getSignedDocumentUrl(result.paths[1], {
          quality: 75,
        });
        setFrontUrl(frontSignedUrl);
        setBackUrl(backSignedUrl);
      }
    } catch (error) {
      console.error("Error loading CCCD:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFrontDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFrontDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setFrontFile(files[0]);
    }
  };

  const handleBackDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setBackDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setBackFile(files[0]);
    }
  };

  const handleFrontFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFrontFile(e.target.files[0]);
    }
  };

  const handleBackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setBackFile(e.target.files[0]);
    }
  };

  const getFrontPreview = () => {
    if (frontFile)
      return {
        type: "file",
        url: URL.createObjectURL(frontFile),
        file: frontFile,
      };
    if (frontUrl) return { type: "url", url: frontUrl };
    return null;
  };

  const getBackPreview = () => {
    if (backFile)
      return {
        type: "file",
        url: URL.createObjectURL(backFile),
        file: backFile,
      };
    if (backUrl) return { type: "url", url: backUrl };
    return null;
  };

  const PreviewContent = ({ preview }: { preview: any }) => {
    if (!preview) return null;

    const url = preview.url;
    const file = preview.file;
    const isPDFContent = file ? isPDF(file) : isPDF(url);

    if (isPDFContent) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-gray-100 rounded-lg">
          <p className="text-sm font-medium text-gray-600">PDF Document</p>
        </div>
      );
    }

    return (
      <img src={url} alt="Preview" className="w-full h-full object-cover" />
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 bg-card flex flex-col overflow-hidden">
          <DialogHeader className="sticky top-0 z-10 bg-card border-b border-border/50 px-8 py-4 flex flex-row justify-between items-center">
            <DialogTitle>Tải lên CCCD</DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-8 py-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Front of CCCD */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    Mặt trước CCCD
                  </h3>
                  {loading ? (
                    <div className="w-full aspect-[16/10] rounded-lg bg-muted flex items-center justify-center">
                      <div className="text-muted-foreground">Đang tải...</div>
                    </div>
                  ) : frontUrl || frontFile ? (
                    <div className="space-y-3">
                      <div
                        className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-muted border border-border relative group cursor-pointer"
                        onClick={() => frontInputRef.current?.click()}
                      >
                        <PreviewContent preview={getFrontPreview()} />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="text-white text-center">
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <span className="text-sm font-medium">
                              Thay đổi
                            </span>
                          </div>
                        </div>
                      </div>
                      <input
                        ref={frontInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={handleFrontFileChange}
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "dropzone flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                        frontDragging && "border-primary bg-primary/5",
                        "border-muted-foreground/50 hover:border-primary/50 hover:bg-muted/50"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setFrontDragging(true);
                      }}
                      onDragLeave={() => setFrontDragging(false)}
                      onDrop={handleFrontDrop}
                    >
                      <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1 text-center">
                        Kéo và thả tệp vào đây
                      </p>
                      <p className="text-xs text-muted-foreground mb-4 text-center">
                        hoặc nhấn để duyệt từ máy tính của bạn
                      </p>
                      <input
                        ref={frontInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        id="front-file-upload"
                        onChange={handleFrontFileChange}
                      />
                      <label
                        htmlFor="front-file-upload"
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        Duyệt Tệp
                      </label>
                    </div>
                  )}
                </div>

                {/* Back of CCCD */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    Mặt sau CCCD
                  </h3>
                  {loading ? (
                    <div className="w-full aspect-[16/10] rounded-lg bg-muted flex items-center justify-center">
                      <div className="text-muted-foreground">Đang tải...</div>
                    </div>
                  ) : backUrl || backFile ? (
                    <div className="space-y-3">
                      <div
                        className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-muted border border-border relative group cursor-pointer"
                        onClick={() => backInputRef.current?.click()}
                      >
                        <PreviewContent preview={getBackPreview()} />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="text-white text-center">
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <span className="text-sm font-medium">
                              Thay đổi
                            </span>
                          </div>
                        </div>
                      </div>
                      <input
                        ref={backInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={handleBackFileChange}
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "dropzone flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                        backDragging && "border-primary bg-primary/5",
                        "border-muted-foreground/50 hover:border-primary/50 hover:bg-muted/50"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setBackDragging(true);
                      }}
                      onDragLeave={() => setBackDragging(false)}
                      onDrop={handleBackDrop}
                    >
                      <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1 text-center">
                        Kéo và thả tệp vào đây
                      </p>
                      <p className="text-xs text-muted-foreground mb-4 text-center">
                        hoặc nhấn để duyệt từ máy tính của bạn
                      </p>
                      <input
                        ref={backInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        id="back-file-upload"
                        onChange={handleBackFileChange}
                      />
                      <label
                        htmlFor="back-file-upload"
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        Duyệt Tệp
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex justify-between items-center gap-2 border-t border-border/50 bg-card px-8 py-4">
            <div className="flex gap-2">
              {(frontUrl || frontFile) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const fileName = `CCCD_Front_${employee.id}.${
                      frontFile?.name.split(".").pop() || "jpg"
                    }`;
                    downloadFile(
                      frontFile ? URL.createObjectURL(frontFile) : frontUrl,
                      fileName,
                      !!frontFile
                    );
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Tải Mặt Trước
                </Button>
              )}
              {(backUrl || backFile) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const fileName = `CCCD_Back_${employee.id}.${
                      backFile?.name.split(".").pop() || "jpg"
                    }`;
                    downloadFile(
                      backFile ? URL.createObjectURL(backFile) : backUrl,
                      fileName,
                      !!backFile
                    );
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Tải Mặt Sau
                </Button>
              )}
              {(frontUrl || frontFile) && (backUrl || backFile) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      toast.loading("Đang tải xuống...");
                      const fileName1 = `CCCD_Front_${employee.id}.${
                        frontFile?.name.split(".").pop() || "jpg"
                      }`;
                      const fileName2 = `CCCD_Back_${employee.id}.${
                        backFile?.name.split(".").pop() || "jpg"
                      }`;

                      await downloadFile(
                        frontFile ? URL.createObjectURL(frontFile) : frontUrl,
                        fileName1,
                        !!frontFile
                      );
                      await new Promise((resolve) => setTimeout(resolve, 500));
                      await downloadFile(
                        backFile ? URL.createObjectURL(backFile) : backUrl,
                        fileName2,
                        !!backFile
                      );

                      toast.success("Đã tải xuống thành công");
                    } catch (error) {
                      console.error(error);
                      toast.error("Lỗi khi tải xuống");
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Tải Toàn Bộ
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button
                onClick={async () => {
                  // Validate both files exist (either new file or existing url)
                  if (!frontFile && !frontUrl) {
                    toast.error("Vui lòng upload mặt trước CCCD");
                    return;
                  }
                  if (!backFile && !backUrl) {
                    toast.error("Vui lòng upload mặt sau CCCD");
                    return;
                  }

                  // If no new files, no need to upload
                  if (!frontFile && !backFile) {
                    onOpenChange(false);
                    return;
                  }

                  setUploading(true);

                  try {
                    // Use existing files if new ones not selected
                    const frontToUpload = frontFile;
                    const backToUpload = backFile;

                    // If either front or back is missing, we need both new files
                    if (!frontToUpload && backToUpload) {
                      toast.error("Vui lòng cung cấp mặt trước CCCD");
                      setUploading(false);
                      return;
                    }
                    if (frontToUpload && !backToUpload) {
                      toast.error("Vui lòng cung cấp mặt sau CCCD");
                      setUploading(false);
                      return;
                    }

                    // Upload both files
                    const result = await uploadEmployeeCCCD(
                      frontToUpload!,
                      backToUpload!,
                      employee,
                      null
                    );

                    if (!result.success) {
                      toast.error(result.message);
                      setUploading(false);
                      return;
                    }

                    toast.success(result.message);
                    // Reset files after successful upload
                    setFrontFile(null);
                    setBackFile(null);
                    // Reload the URLs
                    await loadExistingCCCD();
                    // Close modal after a short delay
                    setTimeout(() => onOpenChange(false), 1500);
                  } catch (error) {
                    toast.error("Có lỗi xảy ra khi tải lên");
                    console.error(error);
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading || loading}
              >
                {uploading ? "Đang tải lên..." : "Lưu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

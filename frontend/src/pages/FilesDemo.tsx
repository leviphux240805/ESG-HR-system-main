import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDownloadUrl, type StoredFile, uploadFile } from "@/api/files";
import { errorMessage } from "@/api/errors";
import { useAuth } from "@/contexts/AuthContext";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Trang thử upload/tải file qua MinIO của giai đoạn 1 (kiểm tra luồng presigned URL).
 * Chưa có API danh sách file nên chỉ hiện các file vừa tải lên trong phiên này.
 */
export default function FilesDemo() {
  const { me, selectedSchoolId } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<StoredFile[]>([]);

  const upload = useMutation({
    mutationFn: (file: File) => uploadFile(file),
    onSuccess: (file) => {
      setUploaded((list) => [file, ...list]);
      toast.success(`Đã tải lên "${file.originalName}".`);
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const download = useMutation({
    mutationFn: getDownloadUrl,
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const schoolName = (schoolId?: string) =>
    schoolId ? (me?.schools.find((s) => s.id === schoolId)?.name ?? "Cơ sở khác") : "Toàn chuỗi";

  return (
    <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tệp (thử nghiệm)</CardTitle>
            <CardDescription>
              File thuộc {selectedSchoolId ? `"${schoolName(selectedSchoolId)}"` : "toàn chuỗi"} (theo cơ sở đang
              chọn). Nhận PDF, ảnh JPG/PNG/WEBP, Word, Excel; tối đa 20 MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
              {upload.isPending ? "Đang tải lên..." : "Chọn file để tải lên"}
            </Button>
          </CardContent>
        </Card>

        {uploaded.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đã tải lên trong phiên này</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {uploaded.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(file.sizeBytes)} · {schoolName(file.schoolId)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => download.mutate(file.id)}
                      disabled={download.isPending}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Tải về
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

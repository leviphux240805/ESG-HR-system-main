import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, MAX_FILE_MB, type StoredFile, uploadFile, validateFile } from "@/api";

/**
 * Kiểm tra rồi upload lần lượt nhiều file; file lỗi báo riêng (toast), trả các file đã upload xong. Dùng chung cho
 * MultiFileUpload và ô đính kèm (nút + kéo thả).
 */
export function useFileUploader({ schoolId, maxSizeMb = MAX_FILE_MB }: { schoolId?: string; maxSizeMb?: number } = {}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const upload = async (files: File[]): Promise<StoredFile[]> => {
    const valid = files.filter((file) => {
      const problem = validateFile(file, maxSizeMb);
      if (problem) toast.error(problem);
      return !problem;
    });
    if (valid.length === 0) return [];
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
    return uploaded;
  };

  return { upload, progress, uploading: progress !== null };
}

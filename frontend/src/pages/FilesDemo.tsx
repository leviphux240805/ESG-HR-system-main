import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { MultiFileUpload } from "@/components/common/FileUpload";
import type { StoredFile } from "@/api/files";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

/**
 * Trang thử upload/tải file qua MinIO của giai đoạn 1 (kiểm tra luồng presigned URL).
 * Chưa có API danh sách file nên chỉ hiện các file vừa tải lên trong phiên này.
 */
export default function FilesDemo() {
  const { school, isAllSchools } = useCurrentSchool();
  const [files, setFiles] = useState<StoredFile[]>([]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Tệp (thử nghiệm)"
        description={`File thuộc ${isAllSchools ? "toàn chuỗi" : `"${school?.name}"`} (theo cơ sở đang chọn). Nhận PDF, ảnh JPG/PNG/WEBP, Word, Excel; tối đa 20 MB.`}
      />
      <Card>
        <CardContent className="pt-6">
          <MultiFileUpload label="Tệp đã tải lên trong phiên này" value={files} onChange={setFiles} />
        </CardContent>
      </Card>
    </div>
  );
}

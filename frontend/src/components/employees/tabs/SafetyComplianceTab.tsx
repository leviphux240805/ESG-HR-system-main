import { MultiDocumentUploadField } from "../shared/MultiDocumentUploadField";
import { DocumentUploadField } from "../shared/DocumentUploadField";
import { Employee } from "@/types";

interface SafetyComplianceTabProps {
  employee: Employee | null;
}

export function SafetyComplianceTab({ employee }: SafetyComplianceTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        VII. Thông tin an toàn - Tuân thủ
      </h3>

      {/* HỒ SƠ SỨC KHỎE */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Hồ sơ sức khỏe</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiDocumentUploadField
            employee={employee}
            docTypeCode="GIAY_KHAM_SUC_KHOE"
            label="Hồ sơ khám sức khỏe định kỳ"
          />
          <DocumentUploadField
            employee={employee}
            docTypeCode="HO_SO_TAI_NAN"
            label="Hồ sơ tai nạn lao động (nếu có)"
          />
        </div>
      </div>

      {/* AN TOÀN LAO ĐỘNG */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">An toàn lao động</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocumentUploadField
            employee={employee}
            docTypeCode="BIEN_BAN_ATLD"
            label="Biên bản an toàn lao động"
          />
          <DocumentUploadField
            employee={employee}
            docTypeCode="HO_SO_PCCC"
            label="Hồ sơ PCCC (Phòng cháy chữa cháy)"
          />
          <DocumentUploadField
            employee={employee}
            docTypeCode="HO_SO_ATVSLD"
            label="Hồ sơ ATVSLĐ (An toàn vệ sinh lao động)"
          />
        </div>
      </div>

      {/* CAM KẾT NỘI QUY */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Cam kết & Tuân thủ</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocumentUploadField
            employee={employee}
            docTypeCode="CAM_KET_NOI_QUY"
            label="Cam kết nội quy, quy chế"
          />
          <DocumentUploadField
            employee={employee}
            docTypeCode="CAM_KET_BAO_MAT"
            label="Cam kết bảo mật thông tin"
          />
        </div>
      </div>

      {/* THÔNG TIN BỔ SUNG */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Các hồ sơ khác</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocumentUploadField
            employee={employee}
            docTypeCode="GIAY_PHEP_LAO_DONG"
            label="Giấy phép lao động (đối với NLĐ nước ngoài)"
          />
          <MultiDocumentUploadField
            employee={employee}
            docTypeCode="TAI_LIEU_KHAC"
            label="Tài liệu khác"
          />
        </div>
      </div>
    </div>
  );
}

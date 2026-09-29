import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentUploadField } from "../shared/DocumentUploadField";
import { Employee } from "@/types";

const DEPARTMENTS = [
  "Nhân sự",
  "Kế toán",
  "IT",
  "Kinh doanh",
  "Marketing",
  "Sản xuất",
  "Hành chính",
  "Quản lý",
];
const POSITIONS = [
  "Nhân viên",
  "Trưởng nhóm",
  "Phó phòng",
  "Trưởng phòng",
  "Giám đốc",
  "Phó Giám đốc",
];
const LEVELS = ["Thử việc", "Chính thức", "Cao cấp", "Chuyên gia"];

interface LaborRecordsTabProps {
  employee: Employee | null;
}

export function LaborRecordsTab({ employee }: LaborRecordsTabProps) {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        II. Hồ sơ lao động
      </h3>

      {/* Hợp đồng lao động */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Hợp đồng lao động</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="laborContract.contractNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số hợp đồng</FormLabel>
                <FormControl>
                  <Input placeholder="HDLD-2025-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DocumentUploadField
            employee={employee}
            docTypeCode="HOP_DONG_LAO_DONG"
            label="Hợp đồng lao động (PDF)"
            accept=".pdf"
          />

          {/* <FormField
            control={form.control}
            name="laborContract.startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày vào làm</FormLabel>
                <FormControl>
                  <DatePickerCustom
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Chọn ngày"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="laborContract.endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày nghỉ việc (nếu có)</FormLabel>
                <FormControl>
                  <DatePickerCustom
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Chọn ngày"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}
        </div>
      </div>

      {/* Chức danh, bộ phận, cấp bậc */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Vị trí công việc</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bộ phận</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn bộ phận" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chức danh</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chức danh" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cấp bậc</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn cấp bậc" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Quyết định */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Quyết định & Văn bản pháp lý</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocumentUploadField
            employee={employee}
            docTypeCode="QUYET_DINH_TIEP_NHAN"
            label="Quyết định tiếp nhận"
          />

          <DocumentUploadField
            employee={employee}
            docTypeCode="QUYET_DINH_BO_NHIEM"
            label="Quyết định bổ nhiệm"
          />

          <DocumentUploadField
            employee={employee}
            docTypeCode="QUYET_DINH_DIEU_CHUYEN"
            label="Quyết định điều chuyển"
          />

          <DocumentUploadField
            employee={employee}
            docTypeCode="QUYET_DINH_CHAM_DUT"
            label="Quyết định chấm dứt HĐLĐ (nếu có)"
          />

          <DocumentUploadField
            employee={employee}
            docTypeCode="THOA_THUAN_NDA"
            label="Thỏa thuận bảo mật (NDA)"
          />

          <DocumentUploadField
            employee={employee}
            docTypeCode="THOA_THUAN_NCA"
            label="Thỏa thuận không cạnh tranh"
          />
        </div>
      </div>
    </div>
  );
}

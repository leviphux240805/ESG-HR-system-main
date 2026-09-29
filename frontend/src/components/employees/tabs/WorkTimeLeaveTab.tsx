import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MultiDocumentUploadField } from "../shared/MultiDocumentUploadField";
import { Employee } from "@/types";

interface WorkTimeLeaveTabProps {
  employee: Employee | null;
}

export function WorkTimeLeaveTab({ employee }: WorkTimeLeaveTabProps) {
  const form = useFormContext();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        VI. Thời gian làm việc - Nghỉ phép
      </h3>

      {/* GIỜ LÀM VIỆC TIÊU CHUẨN */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Thời gian làm việc</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="workTimeLeave.standardWorkingHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Giờ làm việc tiêu chuẩn (giờ/ngày)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="8" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workTimeLeave.actualWorkingDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày công thực tế (tháng này)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="22" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* NGHỈ PHÉP */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Thống kê nghỉ phép</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="workTimeLeave.annualLeaveDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nghỉ phép năm (ngày)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workTimeLeave.sickLeaveDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nghỉ ốm (ngày)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workTimeLeave.maternityLeaveDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nghỉ thai sản (ngày)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workTimeLeave.unpaidLeaveDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nghỉ không lương (ngày)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* THỐNG KÊ NHANH */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Thống kê nghỉ phép còn lại</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">12</p>
            <p className="text-sm text-muted-foreground">Phép năm được hưởng</p>
          </div>
          <div className="p-3 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">8</p>
            <p className="text-sm text-muted-foreground">Phép còn lại</p>
          </div>
          <div className="p-3 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-amber-600">4</p>
            <p className="text-sm text-muted-foreground">Đã sử dụng</p>
          </div>
          <div className="p-3 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">0</p>
            <p className="text-sm text-muted-foreground">Nghỉ không lương</p>
          </div>
        </div>
      </div>

      {/* VI PHẠM NỘI QUY */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Vi phạm nội quy (nếu có)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiDocumentUploadField
            employee={employee}
            docTypeCode="BIEN_BAN_VI_PHAM"
            label="Biên bản vi phạm nội quy"
          />
          <MultiDocumentUploadField
            employee={employee}
            docTypeCode="QUYET_DINH_KY_LUAT"
            label="Quyết định kỷ luật lao động"
          />
        </div>
      </div>

      {/* KHIẾU NẠI */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Khiếu nại (nếu có)</h4>
        <MultiDocumentUploadField
          employee={employee}
          docTypeCode="HO_SO_KHIEU_NAI"
          label="Hồ sơ khiếu nại"
        />
      </div>
    </div>
  );
}


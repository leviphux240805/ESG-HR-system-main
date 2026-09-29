import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, Trash2, Calendar } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { MultiDocumentUploadField } from "../shared/MultiDocumentUploadField";
import { SalaryAdjustment, Employee } from "@/types";
import { format } from "date-fns";
import { useEmployees } from "@/hooks/useEmployee";
import { SalaryAdjustmentModal } from "../SalaryAdjustmentModal";
import { toast } from "sonner";

interface Bank {
  id: number;
  name: string;
  code: string;
  shortName: string;
  logo: string;
}

const PAYMENT_METHODS = ["Chuyển khoản", "Tiền mặt", "Kết hợp"];

// Mock salary adjustments
// Mock data removed

interface SalaryConfigTabProps {
  employee: Employee | null;
}

const formatCurrency = (value: string | number) => {
  const cleaned = String(value).replace(/\D/g, "");
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const unformatCurrency = (value: string) => {
  return value.replace(/,/g, "");
};

export function SalaryConfigTab({ employee }: SalaryConfigTabProps) {
  const form = useFormContext();
  const { getSalaryHistory, updateSalaryWithHistory } = useEmployees();
  const mode = form.watch("salaryConfig.mode");
  const [salaryHistory, setSalaryHistory] = useState<SalaryAdjustment[]>([]);
  const [bankList, setBankList] = useState<Bank[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const currentSalary = form.watch("salaryConfig.baseSalary") || 0;

  // Load history on mount
  useState(() => {
    if (employee?.id) {
      getSalaryHistory(employee.id).then(setSalaryHistory);
    }
  });

  // Fetch banks
  useState(() => {
    fetch("/banks.json")
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) {
          setBankList(data.data);
        }
      })
      .catch((err) => console.error("Failed to fetch banks:", err));
  });

  const handleSalaryAdjustment = async (data: {
    newSalary: number;
    effectiveDate: string;
    reason: string;
  }) => {
    if (!employee?.id) return;

    const success = await updateSalaryWithHistory(
      employee.id,
      currentSalary,
      data.newSalary,
      data.effectiveDate,
      data.reason
    );

    if (success) {
      // Update form value immediately correctly
      form.setValue("salaryConfig.baseSalary", data.newSalary);
      // Refresh history
      const history = await getSalaryHistory(employee.id);
      setSalaryHistory(history);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        III. Thông tin tiền lương - Phúc lợi
      </h3>

      {/* CHẾ ĐỘ ĐÓNG BẢO HIỂM */}
      <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardHeader>
          <CardTitle>Chế độ tính lương đóng bảo hiểm</CardTitle>
          <CardDescription>
            Chọn phương thức tính lương để đóng bảo hiểm xã hội
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="salaryConfig.mode"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="Lương Cứng" id="mode-fixed" />
                        <FormLabel
                          htmlFor="mode-fixed"
                          className="cursor-pointer font-medium"
                        >
                          Lương cứng (Tiền đồng)
                        </FormLabel>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="Lương Hệ Số" id="mode-coeff" />
                        <FormLabel
                          htmlFor="mode-coeff"
                          className="cursor-pointer font-medium"
                        >
                          Lương hệ số
                        </FormLabel>
                      </div>
                    </div>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* MỨC LƯƠNG CƠ BẢN */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Mức lương cơ bản</h4>
        {mode === "Lương Cứng" && (
          <FormField
            control={form.control}
            name="salaryConfig.baseSalary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lương cơ bản (VNĐ)</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      placeholder="10,000,000"
                      value={formatCurrency(field.value?.toString() || "")}
                      readOnly // Make it read-only as requested
                      className="bg-muted"
                    />
                  </FormControl>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setModalOpen(true)}
                    title="Điều chỉnh lương"
                  >
                    Điều chỉnh
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {mode === "Lương Hệ Số" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="salaryConfig.coefficient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hệ số lương</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1.5"
                      type="number"
                      step="0.01"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salaryConfig.positionRatio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phụ cấp chức vụ (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="0"
                        type="number"
                        step="0.01"
                        {...field}
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salaryConfig.seniorityPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phụ cấp thâm niên (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="0"
                        type="number"
                        step="0.01"
                        {...field}
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>

      {/* CÁC KHOẢN PHỤ CẤP */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Các khoản phụ cấp</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="salaryConfig.allowanceLunch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phụ cấp ăn trưa</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryConfig.allowanceTransport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phụ cấp xăng xe</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryConfig.allowancePhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phụ cấp điện thoại</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryConfig.allowanceResponsibility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phụ cấp trách nhiệm</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryConfig.allowanceOther"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phụ cấp khác</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* THƯỞNG & HOA HỒNG */}
      {/* <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Thưởng, hoa hồng, hỗ trợ khác</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="salaryConfig.bonusAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thưởng (VNĐ)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryConfig.commissionRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hoa hồng (%)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="0"
                      type="number"
                      step="0.1"
                      {...field}
                    />
                    <span className="absolute right-3 top-2.5 text-muted-foreground">
                      %
                    </span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salaryConfig.otherSupport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hỗ trợ khác (VNĐ)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
                    value={formatCurrency(field.value?.toString() || "")}
                    onChange={(e) => {
                      const unformatted = unformatCurrency(e.target.value);
                      field.onChange(unformatted ? parseInt(unformatted) : "");
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div> */}

      {/* HÌNH THỨC TRẢ LƯƠNG & NGÂN HÀNG */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">
          Hình thức trả lương & Thông tin ngân hàng
        </h4>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="salaryConfig.paymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hình thức trả lương</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn hình thức" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="salaryConfig.bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên ngân hàng</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn ngân hàng" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bankList.map((bank) => (
                        <SelectItem key={bank.id} value={bank.shortName}>
                          <div className="flex items-center gap-2">
                            <img
                              src={bank.logo}
                              alt={bank.shortName}
                              className="h-4 w-10 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <span>{bank.shortName}</span>
                          </div>
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
              name="salaryConfig.accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tài khoản</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salaryConfig.accountHolder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chủ tài khoản</FormLabel>
                  <FormControl>
                    <Input placeholder="NGUYEN VAN A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      {/* LỊCH SỬ ĐIỀU CHỈNH LƯƠNG */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Lịch sử điều chỉnh lương</h4>
        </div>

        {salaryHistory.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày hiệu lực</TableHead>
                <TableHead>Lương cũ</TableHead>
                <TableHead>Lương mới</TableHead>
                <TableHead>Lý do</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaryHistory.map((adj) => (
                <TableRow key={adj.id}>
                  <TableCell>
                    {format(new Date(adj.effectiveDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(adj.previousSalary)} VNĐ
                  </TableCell>
                  <TableCell className="text-primary font-medium">
                    {formatCurrency(adj.newSalary)} VNĐ
                  </TableCell>
                  <TableCell>{adj.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có lịch sử điều chỉnh lương
          </p>
        )}
      </div>

      {/* TÀI LIỆU ĐÍNH KÈM */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Tài liệu đính kèm</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MultiDocumentUploadField
              employee={employee}
              docTypeCode="BANG_CHAM_CONG"
              label="Bảng chấm công, tăng ca"
            />
            <MultiDocumentUploadField
              employee={employee}
              docTypeCode="BANG_LUONG"
              label="Bảng lương hàng tháng"
            />
          </div>
        </div>
      </div>
      <SalaryAdjustmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSalaryAdjustment}
        currentSalary={
          typeof currentSalary === "string"
            ? parseInt(currentSalary)
            : currentSalary
        }
      />
    </div>
  );
}

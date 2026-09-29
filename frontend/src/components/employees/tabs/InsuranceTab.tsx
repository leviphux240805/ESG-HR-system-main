import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Calendar, CheckCircle2, AlertCircle, Plus, Eye, Trash2 } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { DocumentUploadField } from "../shared/DocumentUploadField";
import { Dependent, FileAttachment, Employee } from "@/types";
import { loadAddressData, getProvinces, Province } from "@/data/addressDataLoader";
import { useEffect } from "react";
import { useEmployees } from "@/hooks/useEmployee";
import { DependentModal, DependentValues } from "../DependentModal";
import { ConfirmModal } from "../shared/ConfirmModal";



const BHXH_STATUS = ["Đang tham gia", "Đã nghỉ", "Chưa tham gia", "Tạm dừng"];
const RELATIONSHIPS = ["Con", "Vợ/Chồng", "Bố/Mẹ", "Anh/Chị/Em"];



import { toast } from "sonner";

interface InsuranceTabProps {
  employee: Employee | null;
}

export function InsuranceTab({ employee }: InsuranceTabProps) {
  const form = useFormContext();
  const { getDependents, addDependent, deleteDependent } = useEmployees();
  const [addressData, setAddressData] = useState<Province[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [isDependentModalOpen, setIsDependentModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const data = await loadAddressData();
      setAddressData(data);
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadDependents = async () => {
      if (employee?.id) {
        const data = await getDependents(employee.id);
        setDependents(data || []);
      }
    };
    loadDependents();
  }, [employee]);

  const handleAddDependent = async (data: DependentValues) => {
    if (!employee?.id) return;

    // Check for duplicates
    const isDuplicate = dependents.some((dep) => dep.idNumber === data.idNumber);
    if (isDuplicate) {
      toast.error("Người phụ thuộc với số CCCD này đã tồn tại trong danh sách.");
      return false;
    }
    
    // Format date for display in UI immediately (optional optimization) or just reload
    const newDep = await addDependent(employee.id, {
      name: data.name,
      relationship: data.relationship,
      idNumber: data.idNumber,
      dateOfBirth: format(data.dateOfBirth, "yyyy-MM-dd"), // Ensure format matches DB expectation
    });

    if (newDep) {
      // Reload list to get the new ID and consistent format
      const updatedList = await getDependents(employee.id);
      setDependents(updatedList || []);
      return true;
    }
    return false;
  };

  const handleDeleteDependent = async (id: string) => {
    setDeleteId(id);
  };
  
  const confirmDelete = async () => {
    if (deleteId && employee?.id) {
       const success = await deleteDependent(deleteId);
       if (success) {
         const updatedList = await getDependents(employee.id);
         setDependents(updatedList || []);
       }
       setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        IV. Bảo hiểm & Thuế
      </h3>

      {/* BẢO HIỂM XÃ HỘI */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Bảo hiểm xã hội (BHXH)</h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="socialInsurance.bhxhNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã số BHXH</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="0123456789"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="socialInsurance.bhxhStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tình trạng BHXH</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tình trạng" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BHXH_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="socialInsurance.bhytStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tình trạng BHYT</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tình trạng" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BHXH_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="socialInsurance.bhtnStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tình trạng BHTN</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tình trạng" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BHXH_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="socialInsurance.contributionAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mức đóng (VNĐ)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="socialInsurance.contributionPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thời gian đóng</FormLabel>
                  <FormControl>
                    <Input placeholder="12 tháng" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DocumentUploadField
              employee={employee}
              docTypeCode="HO_SO_TANG_LAO_DONG"
              label="Hồ sơ tăng lao động"
            />
            <DocumentUploadField
              employee={employee}
              docTypeCode="HO_SO_GIAM_LAO_DONG"
              label="Hồ sơ giảm lao động"
            />
          </div>
        </div>
      </div>

      {/* BẢO HIỂM Y TẾ */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Bảo hiểm y tế (BHYT)</h4>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="healthInsurance.cardNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số thẻ BHYT</FormLabel>
                <FormControl>
                  <Input placeholder="Nhập số thẻ BHYT" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="healthInsurance.kcbProvince"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tỉnh/TP đăng ký KCB</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tỉnh/thành" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getProvinces(addressData).map((p) => (
                        <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="healthInsurance.kcbHospital"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bệnh viện đăng ký KCB</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập tên bệnh viện" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      {/* THUẾ TNCN - GIẢM TRỪ GIA CẢNH */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Giảm trừ gia cảnh (Người phụ thuộc)</h4>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => setIsDependentModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </div>

        {dependents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Quan hệ</TableHead>
                <TableHead>Ngày sinh</TableHead>
                <TableHead>Số CCCD/Giấy KS</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dependents.map((dep) => (
                <TableRow key={dep.id}>
                  <TableCell>{dep.name}</TableCell>
                  <TableCell>{dep.relationship}</TableCell>
                  <TableCell>{format(new Date(dep.dateOfBirth), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{dep.idNumber}</TableCell>
                  <TableCell>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteDependent(dep.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có người phụ thuộc
          </p>
        )}
      </div>

      <DependentModal 
        open={isDependentModalOpen} 
        onOpenChange={setIsDependentModalOpen}
        onSave={handleAddDependent}
      />

      <ConfirmModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Xóa người phụ thuộc"
        description="Bạn có chắc chắn muốn xóa người phụ thuộc này? Hành động này không thể hoàn tác."
        confirmText="Xóa"
        variant="destructive"
      />

      {/* QUYẾT TOÁN THUẾ */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Quyết toán thuế TNCN</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocumentUploadField
            employee={employee}
            docTypeCode="QUYET_TOAN_THUE"
            label="Quyết toán thuế TNCN"
          />
          <DocumentUploadField
            employee={employee}
            docTypeCode="CHUNG_TU_BAO_HIEM_THUE"
            label="Chứng từ liên quan đến BH & thuế"
          />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
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
import { DatePickerCustom } from "./shared/DatePickerCustom";
import { Loader2 } from "lucide-react";

const dependentSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập họ và tên"),
  relationship: z.string().min(1, "Vui lòng chọn quan hệ"),
  dateOfBirth: z.date({
    required_error: "Vui lòng chọn ngày sinh",
  }),
  idNumber: z
    .string()
    .length(12, "Số CCCD phải có đúng 12 ký tự")
    .regex(/^\d+$/, "Số CCCD chỉ được chứa số"),
});

export type DependentValues = z.infer<typeof dependentSchema>;

interface DependentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: DependentValues) => Promise<boolean | void>;
}

const RELATIONSHIPS = ["Con", "Vợ", "Chồng", "Cha", "Mẹ", "Khác"];

export function DependentModal({ open, onOpenChange, onSave }: DependentModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<DependentValues>({
    resolver: zodResolver(dependentSchema),
    defaultValues: {
      name: "",
      relationship: "",
      idNumber: "",
    },
  });

  const onSubmit = async (data: DependentValues, e?: any) => {
    if (e) {
      e.stopPropagation();
    }
    setIsSaving(true);
    try {
      const success = await onSave(data);
      if (success !== false) {
        form.reset();
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm người phụ thuộc</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ và tên</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập họ và tên" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày sinh</FormLabel>
                  <FormControl>
                    <DatePickerCustom
                      value={
                        field.value
                          ? `${field.value.getFullYear()}-${String(
                              field.value.getMonth() + 1
                            ).padStart(2, "0")}-${String(
                              field.value.getDate()
                            ).padStart(2, "0")}`
                          : undefined
                      }
                      onChange={(dateStr) => {
                         if (dateStr) {
                           const parts = dateStr.split("-");
                           // Construct local date from parts
                           const date = new Date(
                             parseInt(parts[0]),
                             parseInt(parts[1]) - 1,
                             parseInt(parts[2])
                           );
                           field.onChange(date);
                         }
                      }}
                      placeholder="Chọn ngày sinh"
                      minYear={1900}
                      maxYear={new Date().getFullYear()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quan hệ</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn mối quan hệ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RELATIONSHIPS.map((rel) => (
                        <SelectItem key={rel} value={rel}>
                          {rel}
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
              name="idNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số CCCD</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập số CCCD" 
                      maxLength={12}
                      {...field} 
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thông tin
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Eye } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Employee } from "@/types";
import {
  loadAddressData,
  getProvinces,
  getDistricts,
  Province,
} from "@/data/addressDataLoader";
import { FileUploadField } from "../shared/FileUploadField";
import { DatePickerCustom } from "../shared/DatePickerCustom";
import { CCCDUploadModal } from "../shared/CCCDUploadModal";

const GENDERS = ["Nam", "Nữ"];

interface PersonalInfoTabProps {
  employee: Employee | null;
}

export function PersonalInfoTab({ employee }: PersonalInfoTabProps) {
  const form = useFormContext();
  const [permanentProvince, setPermanentProvince] = useState("");
  const [currentProvince, setCurrentProvince] = useState("");
  const [addressData, setAddressData] = useState<Province[]>([]);
  const [cccdModalOpen, setCccdModalOpen] = useState(false);
  const sameAsPerma = form.watch("currentAddress.sameAsPermanent");

  useEffect(() => {
    const loadData = async () => {
      const data = await loadAddressData();
      setAddressData(data);
    };
    loadData();
  }, []);

  useEffect(() => {
    const permProvince = form.getValues("permanentAddress.perm_province");
    const currProvince = form.getValues("currentAddress.province");

    if (permProvince) {
      setPermanentProvince(permProvince);
    }
    if (currProvince) {
      setCurrentProvince(currProvince);
    }
  }, [form, employee]);

  const getPermanentDistricts = () => {
    if (!addressData.length || !permanentProvince) return [];
    return getDistricts(addressData, permanentProvince);
  };

  const getCurrentDistricts = () => {
    if (!addressData.length || !currentProvince) return [];
    return getDistricts(addressData, currentProvince);
  };

  // Mock file for demo
  const mockCccdFile = employee?.citizen_id_file || null;

  return (
    <>
      <div className="space-y-6">
        {/* SECTION I: THÔNG TIN CÁ NHÂN & PHÁP LÝ */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            I. Thông tin cá nhân & Pháp lý
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Họ và tên */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Họ và tên <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn Văn A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mã nhân viên */}
            <FormField
              control={form.control}
              name="employeeID"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã nhân viên</FormLabel>
                  <FormControl>
                    <Input placeholder="NV001" {...field} disabled={true} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ngày tháng năm sinh */}
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Ngày tháng năm sinh <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <DatePickerCustom
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Chọn ngày sinh"
                      minYear={1900}
                      maxYear={new Date().getFullYear()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Giới tính */}
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Giới tính <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn giới tính" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Số điện thoại */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Số điện thoại <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="0912345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email cá nhân */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email cá nhân <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Số CCCD */}
            <FormField
              control={form.control}
              name="legal.cccdNumber"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel className="flex items-center gap-2">
                      Số CCCD <span className="text-red-500">*</span>
                    </FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-primary border border-transparent hover:bg-transparent hover:border-primary hover:text-primary transition-all"
                            onClick={() => {
                              setCccdModalOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Xem tài liệu CCCD</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <Input placeholder="012345678912" maxLength={12} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* SECTION: ĐỊA CHỈ */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            Thông tin Địa chỉ
          </h3>

          {/* Địa chỉ thường trú */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
            <h4 className="font-medium mb-4">Địa chỉ Thường trú</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="permanentAddress.perm_province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tỉnh/Thành phố</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setPermanentProvince(val);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn tỉnh/thành" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getProvinces(addressData).map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.name}
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
                name="permanentAddress.perm_district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quận/Huyện</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!permanentProvince}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn quận/huyện" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getPermanentDistricts().map((d) => (
                          <SelectItem key={d.code} value={d.code}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="permanentAddress.perm_detail"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Địa chỉ chi tiết</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Số nhà, đường, tổ/khu phố..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Địa chỉ hiện tại */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-3 mb-4">
              <FormField
                control={form.control}
                name="currentAddress.sameAsPermanent"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">
                      Giống như địa chỉ thường trú
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {!sameAsPerma && (
              <>
                <h4 className="font-medium mb-4">Địa chỉ tạm trú</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="currentAddress.province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tỉnh Thành</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setCurrentProvince(val);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn tỉnh/thành" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getProvinces(addressData).map((p) => (
                              <SelectItem key={p.code} value={p.code}>
                                {p.name}
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
                    name="currentAddress.district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quận/Huyện</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn quận/huyện" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getCurrentDistricts().map((d) => (
                              <SelectItem key={d.code} value={d.code}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="currentAddress.detail"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Địa chỉ chi tiết</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Số nhà, đường, tổ/khu phố..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
        </div>
      </div>
      <CCCDUploadModal
        open={cccdModalOpen}
        onOpenChange={setCccdModalOpen}
        employee={employee}
      />
    </>
  );
}

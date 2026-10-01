import { useEffect, useMemo, useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadAddressData, type Province } from "@/data/addressDataLoader";

/** Danh sách tỉnh + phường/xã (34 tỉnh, không có quận/huyện) từ public/addressData.json. */
export function useAddressData() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  useEffect(() => {
    loadAddressData().then(setProvinces);
  }, []);
  return provinces;
}

export function addressText(provinces: Province[], provinceCode?: string | null, wardCode?: string | null, detail?: string | null) {
  const province = provinces.find((p) => p.province_code === provinceCode);
  const ward = province?.wards.find((w) => w.ward_code === wardCode);
  return [detail, ward?.name, province?.name].filter(Boolean).join(", ");
}

interface Props<T extends FieldValues> {
  form: UseFormReturn<T>;
  /** Tiền tố trường: "perm" (thường trú), "curr" (hiện tại) hoặc "" (provinceCode, wardCode, addressDetail). */
  prefix: "perm" | "curr" | "";
  provinces: Province[];
  disabled?: boolean;
}

/** Ô địa chỉ: tỉnh → phường/xã → số nhà, đường. */
export function AddressFields<T extends FieldValues>({ form, prefix, provinces, disabled }: Props<T>) {
  const field = (name: string) => (prefix ? `${prefix}${name}` : name.charAt(0).toLowerCase() + name.slice(1)) as Path<T>;
  const provinceField = field("ProvinceCode");
  const wardField = field("WardCode");
  const detailField = field("AddressDetail");
  const provinceCode = form.watch(provinceField) as string | undefined;
  const wards = useMemo(
    () => provinces.find((p) => p.province_code === provinceCode)?.wards ?? [],
    [provinces, provinceCode],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={form.control}
        name={provinceField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tỉnh/Thành phố</FormLabel>
            <Select
              value={(field.value as string) ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue(wardField, "" as T[Path<T>]);
              }}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder="Chọn tỉnh/thành phố" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.province_code} value={p.province_code}>
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
        name={wardField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phường/Xã</FormLabel>
            <Select value={(field.value as string) ?? ""} onValueChange={field.onChange} disabled={disabled || !provinceCode}>
              <FormControl>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder={provinceCode ? "Chọn phường/xã" : "Chọn tỉnh trước"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {wards.map((w) => (
                  <SelectItem key={w.ward_code} value={w.ward_code}>
                    {w.name}
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
        name={detailField}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Số nhà, đường</FormLabel>
            <FormControl>
              <Input {...field} value={(field.value as string) ?? ""} disabled={disabled} className="min-h-11" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

import { useId, type ReactNode } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Base<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  description?: ReactNode;
}

function RequiredMark({ required }: { required?: boolean }) {
  return required ? <span className="text-destructive ml-0.5">*</span> : null;
}

/** Ô nhập chữ/ngày/số trong FormSheet của hồ sơ. */
export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  required,
  description,
  type = "text",
  inputMode,
  placeholder,
}: Base<T> & { type?: string; inputMode?: "numeric" | "decimal" | "text"; placeholder?: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            <RequiredMark required={required} />
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              className="min-h-11"
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextAreaField<T extends FieldValues>({ form, name, label, required, description, rows = 2 }: Base<T> & { rows?: number }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            <RequiredMark required={required} />
          </FormLabel>
          <FormControl>
            <Textarea rows={rows} {...field} value={field.value ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  form,
  name,
  label,
  required,
  options,
  placeholder,
}: Base<T> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div id={labelId} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
            <RequiredMark required={required} />
          </div>
          <Select name={field.name} value={field.value ?? ""} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="min-h-11" aria-labelledby={labelId}>
                <SelectValue placeholder={placeholder ?? `Chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CheckboxField<T extends FieldValues>({ form, name, label, description }: Base<T>) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex min-h-11 items-start gap-3 space-y-0">
          <FormControl>
            <Checkbox
              name={field.name}
              className="mt-1"
              aria-labelledby={labelId}
              checked={field.value === true}
              onCheckedChange={(v) => field.onChange(v === true)}
            />
          </FormControl>
          <div className="space-y-1">
            <span id={labelId} className="text-sm font-medium leading-none">{label}</span>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
        </FormItem>
      )}
    />
  );
}

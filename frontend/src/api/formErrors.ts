import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { ApiError, errorMessage } from "./errors";

type FormLike<T extends FieldValues> = Pick<UseFormReturn<T>, "setError" | "getValues">;

/** Trường có trên form (kể cả trường lồng "address.wardCode"), dựa vào giá trị mặc định của form. */
function hasField(values: unknown, path: string): boolean {
  let current: unknown = values;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object" || !(key in current)) return false;
    current = (current as Record<string, unknown>)[key];
  }
  return true;
}

/**
 * Hiển thị lỗi từ API trên form: lỗi theo trường (RFC 7807 `errors[]`) hiện dưới đúng ô nhập, lỗi chung hiện
 * bằng toast. Không bao giờ hiện mã lỗi kỹ thuật cho người dùng.
 *
 *   onError: (error) => applyApiErrors(error, form)
 *
 * Trả về true nếu đã gắn được ít nhất một lỗi vào ô nhập.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  form: FormLike<T>,
  notify: (message: string) => void = (message) => toast.error(message),
): boolean {
  const fieldErrors = error instanceof ApiError ? (error.problem?.errors ?? []) : [];
  const values = form.getValues();
  let mapped = 0;
  const unmapped: string[] = [];

  for (const { field, message } of fieldErrors) {
    if (field && hasField(values, field)) {
      form.setError(field as FieldPath<T>, { type: "server", message }, { shouldFocus: mapped === 0 });
      mapped++;
    } else {
      unmapped.push(message);
    }
  }

  if (mapped === 0) {
    notify(unmapped[0] ?? errorMessage(error));
  } else if (unmapped.length > 0) {
    notify(unmapped[0]);
  }
  return mapped > 0;
}

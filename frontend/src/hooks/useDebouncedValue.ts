import { useEffect, useState } from "react";

/** Giá trị chỉ cập nhật sau khi ngừng thay đổi `delay` ms (ô tìm kiếm: 300 ms). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

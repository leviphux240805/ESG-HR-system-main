import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";

/** Không thử lại lỗi 4xx (sai dữ liệu, không có quyền); lỗi mạng/5xx thử lại một lần. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
      refetchOnWindowFocus: false,
    },
  },
});

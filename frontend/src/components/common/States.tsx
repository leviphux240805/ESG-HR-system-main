import { ReactNode } from "react";
import { AlertTriangle, Inbox, type LucideIcon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/api";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Nút gợi ý hành động (ví dụ "Thêm nhân viên", "Xóa lọc"). */
  action?: ReactNode;
  className?: string;
}

/** Không có dữ liệu: luôn nói rõ vì sao và gợi ý việc tiếp theo, không để màn hình trắng. */
export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center gap-3 py-12 px-4", className)}>
      <Icon className="w-10 h-10 text-muted-foreground" />
      <div className="space-y-1 max-w-md">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  /** Thường là `refetch` của useQuery. */
  onRetry?: () => void;
  className?: string;
}

/** Lỗi khi tải dữ liệu: thông điệp tiếng Việt từ API, nút "Thử lại". Không hiện mã lỗi kỹ thuật. */
export function ErrorState({ error, title = "Không tải được dữ liệu", onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center text-center gap-3 py-12 px-4", className)}
    >
      <AlertTriangle className="w-10 h-10 text-destructive" />
      <div className="space-y-1 max-w-md">
        <p className="font-medium text-foreground">{title}</p>
        {error !== undefined && <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="min-h-11">
          <RotateCw className="w-4 h-4 mr-2" />
          Thử lại
        </Button>
      )}
    </div>
  );
}

/** Khung chờ cho bảng: giữ bố cục ổn định khi đang tải. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Khung chờ cho trang chi tiết/form. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

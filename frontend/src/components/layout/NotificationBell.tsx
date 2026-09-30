import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { markAllNotificationsRead, markNotificationRead, useNotifications, useUnreadCount } from "@/api";
import { errorMessage } from "@/api";
import type { components } from "@/api/schema";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notification = components["schemas"]["NotificationDto"];

/** Thông báo thuộc về người dùng (không theo cơ sở đang chọn) nên key không kèm cơ sở. */
const KEY = ["notifications"] as const;
const LIST_SIZE = 10;

/** Chuông thông báo trên header: số chưa đọc (tải lại mỗi phút), 10 thông báo mới nhất, bấm để mở trang liên quan. */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const unread = useUnreadCount();
  const list = useNotifications(0, LIST_SIZE, open);

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openItem = async (item: Notification) => {
    setOpen(false);
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        refresh();
      } catch {
        // Đánh dấu đã đọc thất bại không chặn việc mở trang
      }
    }
    if (item.link) navigate(item.link);
  };

  const count = unread.data ?? 0;
  const label = count > 0 ? `Thông báo (${count} chưa đọc)` : "Thông báo";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11" aria-label={label}>
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span
              className="absolute top-1.5 right-1.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[0.6875rem] font-semibold leading-[1.125rem] text-center"
              aria-hidden
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <p className="font-medium">Thông báo</p>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-9"
            onClick={() => markAll.mutate()}
            disabled={count === 0 || markAll.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1" /> Đánh dấu đã đọc hết
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : list.isError ? (
            <p className="p-4 text-sm text-muted-foreground">{errorMessage(list.error)}</p>
          ) : !list.data?.items.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
          ) : (
            <ul aria-label="Danh sách thông báo">
              {list.data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b last:border-0 hover:bg-accent/50 flex gap-3",
                      !item.readAt && "bg-primary/5",
                    )}
                  >
                    <span
                      className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", item.readAt ? "bg-transparent" : "bg-primary")}
                      aria-label={item.readAt ? undefined : "Chưa đọc"}
                    />
                    <span className="min-w-0">
                      <span className={cn("block text-sm", !item.readAt && "font-medium")}>{item.title}</span>
                      {item.body && <span className="block text-xs text-muted-foreground">{item.body}</span>}
                      <span className="block text-xs text-muted-foreground mt-0.5">{formatDateTime(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

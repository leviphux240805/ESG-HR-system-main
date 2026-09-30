import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Chữ cái đầu của hai từ cuối trong họ tên Việt ("Nguyễn Thị Lan" → "TL"). */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function StaffAvatar({
  fullName,
  photoUrl,
  className,
}: {
  fullName: string;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt={fullName} className="object-cover" />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials(fullName)}</AvatarFallback>
    </Avatar>
  );
}

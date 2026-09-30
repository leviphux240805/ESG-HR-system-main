import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { LibraryDocumentItem } from "@/api";

/** Tỷ lệ đã đọc (người quản lý) hoặc trạng thái xác nhận của chính mình (người đọc). */
export function AckCell({ doc }: { doc: LibraryDocumentItem }) {
  if (!doc.requireAck) return <span className="text-muted-foreground">—</span>;
  if (doc.stats) {
    const { required, acknowledged } = doc.stats;
    const percent = required === 0 ? 0 : Math.round((acknowledged / required) * 100);
    return (
      <div className="min-w-[7rem] space-y-1" title={`${acknowledged}/${required} người đã xác nhận`}>
        <span className="text-sm">
          {acknowledged}/{required} ({percent}%)
        </span>
        <Progress value={percent} className="h-1.5" aria-label="Tỷ lệ đã đọc" />
      </div>
    );
  }
  if (doc.myAck.required) {
    return doc.myAck.acknowledgedAt ? (
      <StatusBadge status="READ" labels={{ READ: { label: "Đã đọc", tone: "success" } }} />
    ) : (
      <StatusBadge status="UNREAD" labels={{ UNREAD: { label: "Cần xác nhận", tone: "warning" } }} />
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

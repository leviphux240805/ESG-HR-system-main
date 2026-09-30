import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, ChevronRight } from "lucide-react";
import { useMyDocuments } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import type { LibraryDocumentItem } from "@/api";
import { scopeLabel } from "@/features/library/scope";

function DocumentRow({ doc }: { doc: LibraryDocumentItem }) {
  const read = !!doc.myAck.acknowledgedAt;
  return (
    <li>
      <Link to={`/tai-lieu/${doc.id}`} className="flex items-center gap-3 py-3 min-h-11 hover:bg-accent/40 -mx-2 px-2 rounded-md">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">{doc.title}</p>
          <p className="text-xs text-muted-foreground">
            {[doc.docNumber, doc.issuedDate && `ban hành ${formatDate(doc.issuedDate)}`, scopeLabel(doc.schoolName)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {read && <p className="text-xs text-muted-foreground">Đã xác nhận {formatDateTime(doc.myAck.acknowledgedAt)}</p>}
        </div>
        {read ? (
          <StatusBadge status="READ" labels={{ READ: { label: "Đã đọc", tone: "success" } }} />
        ) : (
          <StatusBadge status="UNREAD" labels={{ UNREAD: { label: "Cần đọc", tone: "warning" } }} />
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}

/** Văn bản yêu cầu tôi xác nhận: chưa đọc trước; bấm để đọc và "Tôi đã đọc" ở trang văn bản. */
export default function MyDocumentsPage() {
  const docs = useMyDocuments();

  if (docs.isLoading) return <PageSkeleton />;
  if (docs.isError) {
    return (
      <div>
        <PageHeader title="Văn bản cần đọc" />
        <ErrorState error={docs.error} onRetry={() => docs.refetch()} />
      </div>
    );
  }
  const pending = docs.data!.filter((d) => !d.myAck.acknowledgedAt);
  const read = docs.data!.filter((d) => d.myAck.acknowledgedAt);

  return (
    <div className="space-y-4">
      <PageHeader title="Văn bản cần đọc" description="Quy định, thông báo nhà trường yêu cầu bạn đọc và xác nhận." />
      {docs.data!.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="Không có văn bản nào cần xác nhận" description="Văn bản mới cần đọc sẽ hiện ở đây và trên chuông thông báo." />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Chưa đọc ({pending.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Bạn đã đọc hết văn bản được yêu cầu.</p>
              ) : (
                <ul className="divide-y" aria-label="Văn bản chưa đọc">
                  {pending.map((d) => (
                    <DocumentRow key={d.id} doc={d} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {read.length > 0 && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Đã đọc ({read.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y" aria-label="Văn bản đã đọc">
                  {read.map((d) => (
                    <DocumentRow key={d.id} doc={d} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

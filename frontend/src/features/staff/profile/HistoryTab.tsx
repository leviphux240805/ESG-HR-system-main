import { useMemo, useState } from "react";
import { Building2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { formatDate, formatDateTime } from "@/lib/format";
import { type FileRef, type StaffDetail, useDocumentTypes, useStaffHistory } from "../api";
import { describeEvent, type HistoryContext } from "../history";
import { FileLink, FilePreviewDialog } from "./FilePreviewDialog";

/** Tab "Lịch sử": quá trình công tác theo cơ sở (điều chuyển) và nhật ký chỉnh sửa hồ sơ. */
export function HistoryTab({ staff }: { staff: StaffDetail }) {
  const history = useStaffHistory(staff.id);
  const types = useDocumentTypes();
  const { schools } = useCurrentSchool();
  const [preview, setPreview] = useState<FileRef | null>(null);

  const ctx = useMemo<HistoryContext>(() => {
    const names = new Map<string, string>(schools.map((s) => [s.id, s.name]));
    for (const a of history.data?.assignments ?? []) names.set(a.schoolId, a.schoolName);
    return {
      schoolName: (id) => names.get(id),
      documentTypeName: (key) => types.data?.find((t) => t.id === key || t.code === key)?.name,
    };
  }, [schools, history.data, types.data]);

  if (history.isLoading) return <PageSkeleton />;
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  const { assignments, events } = history.data!;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quá trình công tác</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l ml-2 space-y-4" aria-label="Quá trình công tác">
            {assignments.map((a) => (
              <li key={a.id} className="ml-5">
                <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border">
                  <Building2 className="w-3 h-3 text-primary" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{a.schoolName}</p>
                  {a.pending ? (
                    <StatusBadge status="PENDING" labels={{ PENDING: { label: "Chờ hiệu lực", tone: "warning" } }} />
                  ) : (
                    !a.toDate && <StatusBadge status="NOW" labels={{ NOW: { label: "Hiện tại", tone: "success" } }} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(a.fromDate)} – {a.toDate ? formatDate(a.toDate) : "nay"}
                  {a.note ? ` · ${a.note}` : ""}
                </p>
                {a.decisionFile && (
                  <div className="max-w-[18rem]">
                    <FileLink staffId={staff.id} file={a.decisionFile} onPreview={setPreview} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nhật ký thay đổi</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState icon={History} title="Chưa có thay đổi nào" />
          ) : (
            <ol className="relative border-l ml-2 space-y-4" aria-label="Nhật ký thay đổi">
              {events.map((event) => {
                const { title, details } = describeEvent(event, ctx);
                return (
                  <li key={event.id} className="ml-5">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary/70 border border-background" />
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.at)}
                      {event.userName ? ` · ${event.userName}` : ""}
                    </p>
                    <p className="font-medium">{title}</p>
                    {details.length > 0 && (
                      <ul className="text-sm text-muted-foreground list-disc ml-4">
                        {details.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
      <FilePreviewDialog staffId={staff.id} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

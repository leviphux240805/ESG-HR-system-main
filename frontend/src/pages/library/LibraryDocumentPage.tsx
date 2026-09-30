import { type ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Download, Eye, FileUp, Loader2, Pencil, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, unwrap } from "@/api/client";
import { ApiError, errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FilePreviewDialog, type PreviewFile } from "@/components/common/FilePreviewDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { canPreviewMime, isImageMime, openDownload } from "@/lib/filePreview";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/navigation";
import {
  type LibraryDocumentDetail,
  type LibraryReader,
  libraryFileUrl,
  useFolders,
  useLibraryDocument,
  useReaders,
} from "@/features/library/api";
import { DocumentFormSheet, VersionSheet } from "@/features/library/DocumentSheets";
import { publishScopes, scopeLabel } from "@/features/library/scope";

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-0.5">{children || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

const todayVn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const dayVn = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

/** Xem trước phiên bản hiện hành ngay trên trang. */
function CurrentPreview({ detail }: { detail: LibraryDocumentDetail }) {
  const { document, versions } = detail;
  const current = versions.find((v) => v.versionNo === document.currentVersionNo) ?? versions[0];
  const file = current?.file;
  const url = useQuery({
    queryKey: ["library-preview", document.id, current?.versionNo],
    queryFn: () => libraryFileUrl(document.id, current!.versionNo, true),
    enabled: !!file && canPreviewMime(file.mimeType),
    gcTime: 0,
    staleTime: 0,
  });
  if (!current || !file) return null;
  const download = () => openDownload((inline) => libraryFileUrl(document.id, current.versionNo, inline));

  return (
    <Card>
      <CardHeader className="pb-3 flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base truncate">
          {file.originalName} <span className="text-muted-foreground font-normal">· v{current.versionNo}</span>
        </CardTitle>
        <Button variant="outline" className="min-h-11" onClick={download}>
          <Download className="w-4 h-4 mr-2" /> Tải về
        </Button>
      </CardHeader>
      <CardContent>
        {!canPreviewMime(file.mimeType) ? (
          <p className="text-sm text-muted-foreground">Không xem trước được loại tệp này. Hãy tải về để mở.</p>
        ) : url.isLoading ? (
          <Skeleton className="h-[60vh] w-full" />
        ) : url.isError ? (
          <ErrorState error={url.error} onRetry={() => url.refetch()} />
        ) : isImageMime(file.mimeType) ? (
          <img src={url.data} alt={file.originalName} className="max-w-full mx-auto" />
        ) : (
          <iframe src={url.data} title={file.originalName} className="w-full h-[70vh] rounded-md border" />
        )}
      </CardContent>
    </Card>
  );
}

function ReaderList({ readers, empty }: { readers: LibraryReader[]; empty: string }) {
  if (readers.length === 0) return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
  return (
    <ul className="divide-y">
      {readers.map((r) => (
        <li key={r.staffId} className="py-2 flex flex-wrap items-center justify-between gap-x-4">
          <span>
            {r.fullName} <span className="text-muted-foreground text-sm">({r.staffCode})</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {r.schoolName}
            {r.acknowledgedAt ? ` · ${formatDateTime(r.acknowledgedAt)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Người quản lý: tỷ lệ đã đọc, danh sách đã/chưa đọc, nhắc người chưa đọc (tối đa 1 lần/ngày). */
function ReadersCard({ detail }: { detail: LibraryDocumentDetail }) {
  const queryClient = useQueryClient();
  const { document, lastRemindedAt } = detail;
  const readers = useReaders(document.id, true);
  const stats = document.stats ?? { required: 0, acknowledged: 0 };
  const percent = stats.required === 0 ? 0 : Math.round((stats.acknowledged / stats.required) * 100);
  const unread = (readers.data ?? []).filter((r) => !r.acknowledgedAt);
  const read = (readers.data ?? []).filter((r) => r.acknowledgedAt);
  const remindedToday = !!lastRemindedAt && dayVn(lastRemindedAt) === todayVn();

  const remind = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/api/v1/library/documents/{id}/remind", { params: { path: { id: document.id } } })),
    onSuccess: (result) => {
      toast.success(`Đã nhắc ${result.reminded} người chưa đọc.`);
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Xác nhận đã đọc</CardTitle>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => remind.mutate()}
            disabled={remind.isPending || remindedToday || stats.required === stats.acknowledged}
          >
            {remind.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellRing className="w-4 h-4 mr-2" />}
            Nhắc người chưa đọc
          </Button>
          {remindedToday && <span className="text-xs text-muted-foreground">Đã nhắc hôm nay lúc {formatTime(lastRemindedAt)}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm" data-testid="ack-rate">
            {stats.acknowledged}/{stats.required} người đã đọc ({percent}%)
          </p>
          <Progress value={percent} aria-label="Tỷ lệ đã đọc" />
        </div>
        {readers.isLoading ? (
          <Skeleton className="h-20" />
        ) : readers.isError ? (
          <ErrorState error={readers.error} onRetry={() => readers.refetch()} />
        ) : (
          <Tabs defaultValue="unread">
            <TabsList>
              <TabsTrigger value="unread">Chưa đọc ({unread.length})</TabsTrigger>
              <TabsTrigger value="read">Đã đọc ({read.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="unread">
              <ReaderList readers={unread} empty="Mọi người đã đọc." />
            </TabsContent>
            <TabsContent value="read">
              <ReaderList readers={read} empty="Chưa ai xác nhận." />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

export default function LibraryDocumentPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const { schools, schoolId } = useCurrentSchool();
  const detail = useLibraryDocument(id);
  const folders = useFolders();
  const [sheet, setSheet] = useState<"edit" | "version" | "delete" | null>(null);
  const [preview, setPreview] = useState<{ file: PreviewFile; versionNo: number } | null>(null);

  const ack = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/library/documents/{id}/ack", { params: { path: { id } } })),
    onSuccess: () => {
      toast.success("Đã xác nhận đã đọc.");
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <div>
        <PageHeader title="Văn bản" breadcrumbs={[{ label: "Tài liệu", to: "/tai-lieu" }, { label: "Văn bản" }]} />
        {notFound ? (
          <EmptyState
            icon={SearchX}
            title="Không tìm thấy văn bản"
            description="Văn bản không tồn tại, đã bị xóa, hoặc không thuộc phạm vi bạn được xem."
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/tai-lieu">Về thư viện</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        )}
      </div>
    );
  }

  const data = detail.data!;
  const doc = data.document;
  const scopes = publishScopes(me?.roles ?? [], schoolId ? schools.filter((s) => s.id === schoolId) : schools);

  return (
    <div className="space-y-4">
      <PageHeader
        title={doc.title}
        description={[doc.docNumber && `Số ${doc.docNumber}`, doc.issuedDate && `ban hành ${formatDate(doc.issuedDate)}`]
          .filter(Boolean)
          .join(", ")}
        breadcrumbs={[{ label: "Tài liệu", to: "/tai-lieu" }, { label: doc.title }]}
        actions={
          doc.canManage && (
            <>
              <Button variant="outline" className="min-h-11" onClick={() => setSheet("edit")}>
                <Pencil className="w-4 h-4 mr-2" /> Sửa
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setSheet("version")}>
                <FileUp className="w-4 h-4 mr-2" /> Phiên bản mới
              </Button>
              <Button variant="outline" className="min-h-11 text-destructive hover:text-destructive" onClick={() => setSheet("delete")}>
                <Trash2 className="w-4 h-4 mr-2" /> Xóa
              </Button>
            </>
          )
        }
      />

      {doc.myAck.required && (
        <Card className={doc.myAck.acknowledgedAt ? "border-green-200" : "border-amber-300 bg-amber-50/50"}>
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {doc.myAck.acknowledgedAt ? (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-600" /> Bạn đã xác nhận đọc lúc {formatDateTime(doc.myAck.acknowledgedAt)}.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  Văn bản này yêu cầu bạn xác nhận đã đọc{doc.currentVersionNo > 1 ? ` (phiên bản ${doc.currentVersionNo})` : ""}.
                </p>
                <Button className="min-h-11 w-full sm:w-auto" onClick={() => ack.mutate()} disabled={ack.isPending}>
                  {ack.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Tôi đã đọc
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Row label="Phạm vi">{scopeLabel(doc.schoolName)}</Row>
            <Row label="Vai trò được xem">
              {doc.visibleRoles.length === 0 ? "Mọi vai trò" : doc.visibleRoles.map((r) => ROLE_LABELS[r]).join(", ")}
            </Row>
            <Row label="Thư mục">{data.folderName ?? "Chưa xếp thư mục"}</Row>
            <Row label="Ngày ban hành">{formatDate(doc.issuedDate)}</Row>
            <Row label="Hiệu lực đến">{doc.effectiveTo ? formatDate(doc.effectiveTo) : "Không thời hạn"}</Row>
            <Row label="Phiên bản hiện hành">v{doc.currentVersionNo}</Row>
          </dl>
        </CardContent>
      </Card>

      {doc.canManage && doc.requireAck && <ReadersCard detail={data} />}

      <CurrentPreview detail={data} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Các phiên bản</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y" aria-label="Các phiên bản">
            {data.versions.map((v) => (
              <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    v{v.versionNo} · <span className="font-normal">{v.file.originalName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(v.createdAt)}
                    {v.createdByName ? ` · ${v.createdByName}` : ""}
                    {v.note ? ` · ${v.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  {canPreviewMime(v.file.mimeType) && (
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Xem phiên bản ${v.versionNo}`} onClick={() => setPreview({ file: v.file, versionNo: v.versionNo })}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    aria-label={`Tải phiên bản ${v.versionNo}`}
                    onClick={() => openDownload((inline) => libraryFileUrl(doc.id, v.versionNo, inline))}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {doc.canManage && (
        <>
          <DocumentFormSheet
            open={sheet === "edit"}
            onOpenChange={(o) => !o && setSheet(null)}
            folders={folders.data ?? []}
            scopes={scopes}
            document={doc}
          />
          <VersionSheet document={doc} open={sheet === "version"} onOpenChange={(o) => !o && setSheet(null)} />
          <ConfirmDialog
            open={sheet === "delete"}
            onOpenChange={(o) => !o && setSheet(null)}
            title="Xóa văn bản?"
            description={`“${doc.title}” cùng mọi phiên bản và xác nhận đã đọc sẽ bị xóa.`}
            confirmText="Xóa"
            variant="destructive"
            onConfirm={async () => {
              unwrap(await api.DELETE("/api/v1/library/documents/{id}", { params: { path: { id: doc.id } } }));
              toast.success("Đã xóa văn bản.");
              navigate("/tai-lieu");
              queryClient.invalidateQueries({ queryKey: ["library", "documents"] });
              queryClient.invalidateQueries({ queryKey: ["library", "folders"] });
            }}
          />
        </>
      )}
      <FilePreviewDialog
        file={preview?.file ?? null}
        loadUrl={(inline) => libraryFileUrl(doc.id, preview!.versionNo, inline)}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

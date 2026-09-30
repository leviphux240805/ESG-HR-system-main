import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trash2, Upload } from "lucide-react";
import { deleteStaffDocument } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";
import {
  type DocumentTypeDto,
  type FileRef,
  type StaffDetail,
  type StaffDocumentDto,
  useDocumentTypes,
  useStaffDocuments,
} from "@/api";
import { daysUntil, WARNING_DAYS } from "../dates";
import { DocumentSheet } from "./DocumentSheet";
import { FileLink, FilePreviewDialog } from "./FilePreviewDialog";

type Category = DocumentTypeDto["category"];

const CATEGORY_LABELS: Record<Category, string> = {
  IDENTITY: "Nhân thân",
  DECISION: "Quyết định, thỏa thuận",
  EDUCATION: "Bằng cấp",
  HEALTH: "Sức khỏe",
  INSURANCE: "Bảo hiểm, thuế",
  DISCIPLINE: "Kỷ luật",
  SAFETY: "An toàn, cam kết",
  OTHER: "Khác",
};

export function ExpiryBadge({ date }: { date?: string | null }) {
  if (!date) return null;
  const days = daysUntil(date);
  if (days < 0) return <StatusBadge status="EXPIRED" labels={{ EXPIRED: { label: "Đã hết hạn", tone: "danger" } }} />;
  if (days < WARNING_DAYS)
    return <StatusBadge status="SOON" labels={{ SOON: { label: `Còn ${days} ngày`, tone: "warning" } }} />;
  return null;
}

function VersionRow({
  staffId,
  doc,
  canEdit,
  onPreview,
  onDelete,
}: {
  staffId: string;
  doc: StaffDocumentDto;
  canEdit: boolean;
  onPreview: (file: FileRef) => void;
  onDelete: (doc: StaffDocumentDto) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-0 max-w-[18rem]">
        <FileLink staffId={staffId} file={doc.file} onPreview={onPreview} />
      </div>
      <span className="text-xs text-muted-foreground">
        {[
          doc.issuedDate && `Cấp ${formatDate(doc.issuedDate)}`,
          doc.expiryDate && `Hết hạn ${formatDate(doc.expiryDate)}`,
          `Tải lên ${formatDate(doc.uploadedAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {doc.current && <ExpiryBadge date={doc.expiryDate} />}
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 ml-auto"
          onClick={() => onDelete(doc)}
          aria-label={`Xóa phiên bản ${doc.file.originalName}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

/** Tab "Giấy tờ": theo loại (danh mục document_types), bản hiện hành + lịch sử phiên bản, cảnh báo hạn. */
export function DocumentsTab({ staff }: { staff: StaffDetail }) {
  const queryClient = useQueryClient();
  const documents = useStaffDocuments(staff.id);
  const types = useDocumentTypes();
  const [onlyExisting, setOnlyExisting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [upload, setUpload] = useState<{ typeId?: string } | null>(null);
  const [deleting, setDeleting] = useState<StaffDocumentDto | null>(null);
  const [preview, setPreview] = useState<FileRef | null>(null);
  const canEdit = staff.permissions.canEdit && staff.status === "ACTIVE";

  const byType = useMemo(() => {
    const map = new Map<string, StaffDocumentDto[]>();
    for (const doc of documents.data ?? []) {
      const list = map.get(doc.type.id) ?? [];
      list.push(doc);
      map.set(doc.type.id, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return map;
  }, [documents.data]);

  const groups = useMemo(() => {
    const result = new Map<Category, DocumentTypeDto[]>();
    for (const type of types.data ?? []) {
      if (onlyExisting && !byType.has(type.id)) continue;
      const list = result.get(type.category) ?? [];
      list.push(type);
      result.set(type.category, list);
    }
    return [...result.entries()];
  }, [types.data, byType, onlyExisting]);

  if (documents.isLoading || types.isLoading) return <PageSkeleton />;
  if (documents.isError) return <ErrorState error={documents.error} onRetry={() => documents.refetch()} />;
  if (types.isError) return <ErrorState error={types.error} onRetry={() => types.refetch()} />;

  const toggle = (typeId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="only-existing" checked={onlyExisting} onCheckedChange={setOnlyExisting} />
          <Label htmlFor="only-existing">Chỉ hiện giấy tờ đã có</Label>
        </div>
        {canEdit && (
          <Button className="min-h-11" onClick={() => setUpload({})}>
            <Upload className="w-4 h-4 mr-2" /> Tải lên giấy tờ
          </Button>
        )}
      </div>

      {groups.map(([category, list]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{CATEGORY_LABELS[category]}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {list.map((type) => {
              const versions = byType.get(type.id) ?? [];
              const current = versions.find((v) => v.current) ?? versions[0];
              const older = versions.filter((v) => v !== current);
              const open = expanded.has(type.id);
              return (
                <div key={type.id} className="py-2 space-y-1" data-testid={`doc-type-${type.code}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{type.name}</p>
                    <div className="flex items-center gap-1">
                      {older.length > 0 && (
                        <Button variant="ghost" className="min-h-11 text-sm" onClick={() => toggle(type.id)} aria-expanded={open}>
                          {open ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                          {versions.length} phiên bản
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="outline" className="min-h-11" onClick={() => setUpload({ typeId: type.id })}>
                          <Upload className="w-4 h-4 mr-2" />
                          {current ? "Phiên bản mới" : "Tải lên"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {current ? (
                    <VersionRow staffId={staff.id} doc={current} canEdit={canEdit} onPreview={setPreview} onDelete={setDeleting} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có</p>
                  )}
                  {open && older.length > 0 && (
                    <div className="ml-4 pl-3 border-l space-y-1">
                      {older.map((doc) => (
                        <VersionRow key={doc.id} staffId={staff.id} doc={doc} canEdit={canEdit} onPreview={setPreview} onDelete={setDeleting} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giấy tờ nào.</p>}

      <DocumentSheet
        staff={staff}
        open={upload !== null}
        onOpenChange={(open) => !open && setUpload(null)}
        types={types.data ?? []}
        presetTypeId={upload?.typeId}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa phiên bản giấy tờ?"
        description={deleting ? `${deleting.type.name}: “${deleting.file.originalName}” sẽ bị xóa khỏi hồ sơ.` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteStaffDocument(staff.id, deleting!.id);
          await queryClient.invalidateQueries({ queryKey: ["staff"] });
        }}
      />
      <FilePreviewDialog staffId={staff.id} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

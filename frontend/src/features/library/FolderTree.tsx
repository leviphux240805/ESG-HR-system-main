import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Folder, FolderOpen, Inbox, Library, type LucideIcon, MoreHorizontal, Plus } from "lucide-react";
import { z } from "zod";
import { createFolder, deleteFolder, renameFolder } from "@/api";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { ErrorState } from "@/components/common/States";
import { TextField } from "@/features/staff/profile/fields";
import { cn } from "@/lib/utils";
import { type FolderDto, UNFILED, useFolders } from "@/api";
import { buildFolderGroups, type FolderNode, type PublishScope } from "./scope";

const nameSchema = z.object({ name: z.string().trim().min(1, "Vui lòng nhập tên thư mục").max(200) });
type NameValues = z.infer<typeof nameSchema>;

type FolderEdit =
  | { mode: "create"; schoolId: string | null; parent?: FolderDto }
  | { mode: "rename"; folder: FolderDto };

function FolderSheet({ edit, onClose }: { edit: FolderEdit | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<NameValues>({ resolver: zodResolver(nameSchema), defaultValues: { name: "" } });
  useEffect(() => {
    if (edit) form.reset({ name: edit.mode === "rename" ? edit.folder.name : "" });
  }, [edit, form]);

  const title =
    edit?.mode === "rename" ? "Đổi tên thư mục" : edit?.parent ? `Thư mục con của “${edit.parent.name}”` : "Thư mục mới";

  return (
    <FormSheet
      open={edit !== null}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      form={form}
      successMessage="Đã lưu thư mục."
      onSubmit={async ({ name }) => {
        if (edit?.mode === "rename") {
          await renameFolder(edit.folder.id, { name });
        } else if (edit) {
          await createFolder({
            name,
            parentId: edit.parent?.id,
            schoolId: edit.parent ? undefined : (edit.schoolId ?? undefined),
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["library"] });
      }}
    >
      <TextField form={form} name="name" label="Tên thư mục" required />
    </FormSheet>
  );
}

interface Props {
  /** Thư mục đang chọn: undefined = tất cả, UNFILED = chưa xếp, còn lại là id. */
  selected?: string;
  onSelect: (folder: string | undefined) => void;
  /** Phạm vi người dùng được ban hành trong cơ sở đang chọn (để hiện nút tạo thư mục). */
  scopes: PublishScope[];
  schools: { id: string; name: string }[];
}

/** Cây thư mục: "Tất cả văn bản", "Chưa xếp thư mục", rồi các nhóm toàn chuỗi/cơ sở. */
export function FolderTree({ selected, onSelect, scopes, schools }: Props) {
  const queryClient = useQueryClient();
  const folders = useFolders();
  const [edit, setEdit] = useState<FolderEdit | null>(null);
  const [deleting, setDeleting] = useState<FolderDto | null>(null);

  const groups = useMemo(() => {
    const built = buildFolderGroups(folders.data ?? [], schools);
    // Nhóm chưa có thư mục nhưng người dùng được tạo: vẫn hiện để tạo thư mục đầu tiên
    for (const scope of scopes) {
      if (!built.some((g) => g.schoolId === scope.schoolId)) built.push({ schoolId: scope.schoolId, label: scope.label, roots: [] });
    }
    return built.sort((a, b) => {
      if (a.schoolId === null) return -1;
      if (b.schoolId === null) return 1;
      return a.label.localeCompare(b.label, "vi");
    });
  }, [folders.data, schools, scopes]);

  const item = (key: string | undefined, label: string, Icon: LucideIcon, depth = 0, extra?: ReactNode) => (
    <div
      key={key ?? "all"}
      className={cn(
        "group flex items-center rounded-md text-sm",
        selected === key ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent",
      )}
      style={{ paddingLeft: depth * 16 }}
    >
      <button
        type="button"
        onClick={() => onSelect(key)}
        className="flex flex-1 min-w-0 items-center gap-2 px-2 min-h-11 text-left"
        aria-current={selected === key ? "true" : undefined}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {extra}
    </div>
  );

  const renderNode = (node: FolderNode): ReactNode => (
    <div key={node.id}>
      {item(
        node.id,
        node.name,
        selected === node.id ? FolderOpen : Folder,
        node.depth + 1,
        node.canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Thao tác thư mục ${node.name}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEdit({ mode: "create", schoolId: node.schoolId ?? null, parent: node })}>
                Thư mục con
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEdit({ mode: "rename", folder: node })}>Đổi tên</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(node)}>
                Xóa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      )}
      {node.children.map(renderNode)}
    </div>
  );

  return (
    <nav aria-label="Thư mục văn bản" className="space-y-1">
      {item(undefined, "Tất cả văn bản", Library)}
      {item(UNFILED, "Chưa xếp thư mục", Inbox)}
      {folders.isLoading ? (
        <div className="space-y-2 pt-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : folders.isError ? (
        <ErrorState error={folders.error} onRetry={() => folders.refetch()} className="py-4" />
      ) : (
        groups.map((group) => {
          const canCreate = scopes.some((s) => s.schoolId === group.schoolId);
          return (
            <div key={group.schoolId ?? "chain"} className="pt-3">
              <div className="flex items-center justify-between pl-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                {canCreate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => setEdit({ mode: "create", schoolId: group.schoolId })}
                    aria-label={`Thư mục mới – ${group.label}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {group.roots.length === 0 ? (
                <p className="pl-2 text-xs text-muted-foreground">Chưa có thư mục</p>
              ) : (
                group.roots.map(renderNode)
              )}
            </div>
          );
        })
      )}

      <FolderSheet edit={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa thư mục?"
        description={deleting ? `Thư mục “${deleting.name}” sẽ bị xóa. Chỉ xóa được thư mục trống.` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteFolder(deleting!.id);
          if (selected === deleting!.id) onSelect(undefined);
          await queryClient.invalidateQueries({ queryKey: ["library"] });
        }}
      />
    </nav>
  );
}

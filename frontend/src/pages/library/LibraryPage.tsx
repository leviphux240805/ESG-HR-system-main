import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { FolderTree as FolderIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { useListParams } from "@/hooks/useListParams";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/navigation";
import {
  LIBRARY_FILTER_KEYS,
  type LibraryDocumentItem,
  UNFILED,
  useFolders,
  useLibraryDocuments,
} from "@/features/library/api";
import { AckCell } from "@/features/library/AckCell";
import { DocumentFormSheet } from "@/features/library/DocumentSheets";
import { FolderTree } from "@/features/library/FolderTree";
import { publishScopes, scopeLabel } from "@/features/library/scope";

export default function LibraryPage() {
  const params = useListParams({ filterKeys: LIBRARY_FILTER_KEYS });
  const { me } = useAuth();
  const { schools, schoolId } = useCurrentSchool();
  const query = useLibraryDocuments(params);
  const folders = useFolders();
  const [publishing, setPublishing] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);

  // Chỉ để ẩn/hiện nút; backend kiểm tra lại quyền ban hành
  const scopes = useMemo(() => {
    const inScope = schoolId ? schools.filter((s) => s.id === schoolId) : schools;
    return publishScopes(me?.roles ?? [], inScope);
  }, [me, schools, schoolId]);

  const selected = params.filters.folder;
  const folderName =
    selected === UNFILED ? "Chưa xếp thư mục" : folders.data?.find((f) => f.id === selected)?.name ?? "Tất cả văn bản";
  const select = (folder: string | undefined) => {
    params.setFilter("folder", folder);
    setTreeOpen(false);
  };

  const columns = useMemo<ColumnDef<LibraryDocumentItem>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: "Tiêu đề",
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-[14rem]">
            <Link to={`/tai-lieu/${row.original.id}`} className="font-medium hover:underline">
              {row.original.title}
            </Link>
            {row.original.currentVersionNo > 1 && (
              <span className="ml-2 text-xs text-muted-foreground">v{row.original.currentVersionNo}</span>
            )}
          </div>
        ),
      },
      { id: "docNumber", accessorKey: "docNumber", header: "Số hiệu", enableSorting: true, cell: ({ row }) => row.original.docNumber ?? "—" },
      { id: "issuedDate", accessorKey: "issuedDate", header: "Ngày ban hành", enableSorting: true, cell: ({ row }) => formatDate(row.original.issuedDate) || "—" },
      {
        id: "effectiveTo",
        header: "Hiệu lực đến",
        meta: { label: "Hiệu lực đến" },
        cell: ({ row }) => (row.original.effectiveTo ? formatDate(row.original.effectiveTo) : "Không thời hạn"),
      },
      {
        id: "scope",
        header: "Phạm vi",
        meta: { label: "Phạm vi" },
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{scopeLabel(row.original.schoolName)}</p>
            {row.original.visibleRoles.length > 0 && (
              <p className="text-xs text-muted-foreground">{row.original.visibleRoles.map((r) => ROLE_LABELS[r]).join(", ")}</p>
            )}
          </div>
        ),
      },
      { id: "ack", header: "Đã đọc", meta: { label: "Đã đọc" }, cell: ({ row }) => <AckCell doc={row.original} /> },
    ],
    [],
  );

  const tree = <FolderTree selected={selected} onSelect={select} scopes={scopes} schools={schools} />;

  return (
    <div>
      <PageHeader
        title="Tài liệu"
        description="Thư viện văn bản của chuỗi và cơ sở: quy chế, quyết định, biểu mẫu."
        actions={
          <>
            <Button variant="outline" className="min-h-11 lg:hidden" onClick={() => setTreeOpen(true)}>
              <FolderIcon className="w-4 h-4 mr-2" /> Thư mục
            </Button>
            {scopes.length > 0 && (
              <Button className="min-h-11" onClick={() => setPublishing(true)}>
                <Plus className="w-4 h-4 mr-2" /> Ban hành văn bản
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="hidden lg:block self-start">
          <CardContent className="p-2">{tree}</CardContent>
        </Card>
        <div className="min-w-0">
          <p className="text-sm font-medium mb-2">{folderName}</p>
          <FilterBar params={params} searchPlaceholder="Tìm theo tiêu đề, số hiệu" />
          <DataTable
            tableId="library"
            columns={columns}
            query={query}
            params={params}
            getRowId={(row) => row.id}
            emptyTitle="Chưa có văn bản"
            emptyDescription={scopes.length > 0 ? "Bấm “Ban hành văn bản” để thêm văn bản đầu tiên." : "Văn bản được ban hành cho bạn sẽ hiện ở đây."}
          />
        </div>
      </div>

      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto">
          <SheetTitle className="mb-2">Thư mục</SheetTitle>
          {tree}
        </SheetContent>
      </Sheet>
      <DocumentFormSheet
        open={publishing}
        onOpenChange={setPublishing}
        folders={folders.data ?? []}
        scopes={scopes}
        defaultFolderId={selected && selected !== UNFILED ? selected : undefined}
      />
    </div>
  );
}

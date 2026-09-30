import { type ReactNode, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState, TableSkeleton } from "@/components/common/States";

export interface RecordColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface Props<T extends { id: string }> {
  title: string;
  addLabel: string;
  emptyText: string;
  canEdit: boolean;
  query: UseQueryResult<T[]>;
  columns: RecordColumn<T>[];
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => Promise<unknown>;
  /** Mô tả trong hộp thoại xác nhận xóa. */
  describe: (row: T) => string;
}

/** Bảng mục con của hồ sơ (người phụ thuộc, chứng chỉ, đào tạo) kèm thêm/sửa/xóa theo quyền. */
export function RecordCard<T extends { id: string }>({
  title,
  addLabel,
  emptyText,
  canEdit,
  query,
  columns,
  onAdd,
  onEdit,
  onDelete,
  describe,
}: Props<T>) {
  const [deleting, setDeleting] = useState<T | null>(null);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {canEdit && (
          <Button variant="outline" className="min-h-11" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" /> {addLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={2} columns={columns.length} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data?.length ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.header}>{c.header}</TableHead>
                  ))}
                  {canEdit && (
                    <TableHead className="w-12">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((c) => (
                      <TableCell key={c.header} className={c.className}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Thao tác: ${describe(row)}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onEdit(row)}>Sửa</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(row)}>
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa mục này?"
        description={deleting ? `${describe(deleting)} sẽ bị xóa khỏi hồ sơ.` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={() => onDelete(deleting!)}
      />
    </Card>
  );
}

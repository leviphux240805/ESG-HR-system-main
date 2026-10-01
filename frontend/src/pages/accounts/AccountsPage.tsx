import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { lockAccount, unlockAccount } from "@/api";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { useListParams } from "@/hooks/useListParams";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/navigation";
import { ACCOUNT_FILTER_KEYS, type AccountItem, useAccounts } from "@/api";
import { CreateAccountSheet, EditRolesSheet, SetPasswordSheet } from "@/features/accounts/AccountSheets";
import { FUNCTION_GROUP_LABELS } from "@/features/accounts/roles";

type Confirm = { kind: "lock" | "unlock"; account: AccountItem };

const CONFIRM_TEXT: Record<Confirm["kind"], { title: string; description: (a: AccountItem) => string; action: string }> = {
  lock: {
    title: "Khóa tài khoản?",
    description: (a) => `${a.fullName} sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi mở khóa.`,
    action: "Khóa",
  },
  unlock: { title: "Mở khóa tài khoản?", description: (a) => `${a.fullName} đăng nhập lại được.`, action: "Mở khóa" },
};

/** Quản lý tài khoản đăng nhập (hiệu trưởng). */
export default function AccountsPage() {
  const params = useListParams({ filterKeys: ACCOUNT_FILTER_KEYS });
  const query = useAccounts(params);
  const queryClient = useQueryClient();
  const { schools } = useCurrentSchool();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountItem | null>(null);
  const [resetting, setResetting] = useState<AccountItem | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "role", label: "Vai trò", options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })) },
      { type: "select", key: "schoolId", label: "Trường", options: schools.map((s) => ({ value: s.id, label: s.name })) },
      { type: "select", key: "active", label: "Trạng thái", options: [{ value: "true", label: "Đang hoạt động" }, { value: "false", label: "Đã khóa" }] },
    ],
    [schools],
  );

  const columns = useMemo<ColumnDef<AccountItem>[]>(
    () => [
      {
        id: "fullName",
        accessorKey: "fullName",
        header: "Họ tên",
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <p className="font-medium">
              {row.original.fullName}
              {row.original.self && <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>}
            </p>
            <p className="text-xs text-muted-foreground">{[row.original.email, row.original.phone].filter(Boolean).join(" · ")}</p>
          </div>
        ),
      },
      {
        id: "roles",
        header: "Vai trò",
        meta: { label: "Vai trò" },
        cell: ({ row }) => (
          <ul className="text-sm space-y-0.5 min-w-[12rem]">
            {row.original.roles.map((r) => (
              <li key={`${r.role}-${r.schoolId}`}>
                {ROLE_LABELS[r.role]} <span className="text-muted-foreground">· {r.schoolName}</span>
                {r.functionGroups.length > 0 && (
                  <span className="block text-xs text-muted-foreground">{r.functionGroups.map((g) => FUNCTION_GROUP_LABELS[g]).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        ),
      },
      {
        id: "staff",
        header: "Hồ sơ nhân viên",
        meta: { label: "Hồ sơ nhân viên" },
        cell: ({ row }) =>
          row.original.staffId ? (
            <Link to={`/nhan-su/${row.original.staffId}`} className="hover:underline">
              {row.original.staffCode}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "lastLoginAt",
        accessorKey: "lastLoginAt",
        header: "Đăng nhập gần nhất",
        enableSorting: true,
        cell: ({ row }) => (row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : "Chưa đăng nhập"),
      },
      {
        id: "active",
        header: "Trạng thái",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge status={row.original.active ? "ACTIVE" : "LOCKED"} />
            {row.original.active && row.original.mustChangePassword && <p className="text-xs text-muted-foreground">Chờ đổi mật khẩu</p>}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const a = row.original;
          // Tài khoản hiệu trưởng do bên vận hành quản lý; tự đổi mật khẩu ở menu tài khoản
          if (a.principal) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Thao tác tài khoản ${a.fullName}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(a)}>Sửa vai trò</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setResetting(a)}>Đặt lại mật khẩu</DropdownMenuItem>
                {a.active && !a.self && (
                  <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm({ kind: "lock", account: a })}>
                    Khóa tài khoản
                  </DropdownMenuItem>
                )}
                {!a.active && <DropdownMenuItem onSelect={() => setConfirm({ kind: "unlock", account: a })}>Mở khóa</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const text = confirm ? CONFIRM_TEXT[confirm.kind] : null;

  return (
    <div>
      <PageHeader
        title="Tài khoản"
        description="Tài khoản và vai trò ở các trường bạn làm hiệu trưởng; phó hiệu trưởng được giao nhóm chức năng theo từng trường. Tài khoản hiệu trưởng do bên vận hành quản lý."
        actions={
          <Button className="min-h-11" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" /> Tạo tài khoản
          </Button>
        }
      />
      <FilterBar params={params} searchPlaceholder="Tìm theo tên, email, SĐT" filters={filters} />
      <DataTable
        tableId="accounts"
        columns={columns}
        query={query}
        params={params}
        getRowId={(row) => row.id}
        emptyTitle="Không có tài khoản phù hợp"
        emptyDescription="Thử bỏ bớt bộ lọc."
      />
      <CreateAccountSheet open={creating} onOpenChange={setCreating} />
      <EditRolesSheet account={editing} onClose={() => setEditing(null)} />
      <SetPasswordSheet account={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={text?.title}
        description={confirm && text ? text.description(confirm.account) : undefined}
        confirmText={text?.action}
        variant={confirm?.kind === "lock" ? "destructive" : "default"}
        onConfirm={async () => {
          const id = confirm!.account.id;
          if (confirm!.kind === "lock") await lockAccount(id);
          if (confirm!.kind === "unlock") await unlockAccount(id);
          toast.success(confirm!.kind === "lock" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
          await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        }}
      />
    </div>
  );
}

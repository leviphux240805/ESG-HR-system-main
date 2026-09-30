import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { lockAccount, sendAccountReset, unlockAccount } from "@/api";
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
import { CreateAccountSheet, EditRolesSheet } from "@/features/accounts/AccountSheets";

type Confirm = { kind: "lock" | "unlock" | "reset"; account: AccountItem };

const CONFIRM_TEXT: Record<Confirm["kind"], { title: string; description: (a: AccountItem) => string; action: string }> = {
  lock: {
    title: "Khóa tài khoản?",
    description: (a) => `${a.fullName} sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi mở khóa.`,
    action: "Khóa",
  },
  unlock: { title: "Mở khóa tài khoản?", description: (a) => `${a.fullName} đăng nhập lại được.`, action: "Mở khóa" },
  reset: {
    title: "Gửi email đặt lại mật khẩu?",
    description: (a) => `Gửi link đặt lại mật khẩu tới ${a.email}. Mật khẩu hiện tại vẫn dùng được cho tới khi đổi.`,
    action: "Gửi email",
  },
};

/** Quản lý tài khoản đăng nhập (chủ chuỗi, văn phòng điều hành). */
export default function AccountsPage() {
  const params = useListParams({ filterKeys: ACCOUNT_FILTER_KEYS });
  const query = useAccounts(params);
  const queryClient = useQueryClient();
  const { schools } = useCurrentSchool();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountItem | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "role", label: "Vai trò", options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })) },
      { type: "select", key: "schoolId", label: "Cơ sở", options: schools.map((s) => ({ value: s.id, label: s.name })) },
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
            <p className="text-xs text-muted-foreground">
              {row.original.email}
              {row.original.phone ? ` · ${row.original.phone}` : ""}
            </p>
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
              <li key={`${r.role}-${r.schoolId ?? ""}`}>
                {ROLE_LABELS[r.role]} <span className="text-muted-foreground">· {r.schoolName ?? "Toàn chuỗi"}</span>
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
        cell: ({ row }) => <StatusBadge status={row.original.active ? "ACTIVE" : "LOCKED"} />,
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Thao tác tài khoản ${a.fullName}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(a)}>Sửa vai trò</DropdownMenuItem>
                {a.active && <DropdownMenuItem onSelect={() => setConfirm({ kind: "reset", account: a })}>Gửi email đặt lại mật khẩu</DropdownMenuItem>}
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
        description="Tài khoản đăng nhập và vai trò theo cơ sở. Nhân viên mới thường được tạo tài khoản ngay ở trang Thêm nhân viên."
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
          if (confirm!.kind === "reset") await sendAccountReset(id);
          toast.success(confirm!.kind === "reset" ? "Đã gửi email đặt lại mật khẩu." : confirm!.kind === "lock" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
          await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        }}
      />
    </div>
  );
}

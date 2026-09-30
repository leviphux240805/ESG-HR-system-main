import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/PageHeader";
import { COMMON_STATUSES, StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, PageSkeleton, TableSkeleton } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { ExportButton } from "@/components/common/ExportButton";
import { FileUpload } from "@/components/common/FileUpload";
import { ApiError } from "@/api";
import type { StoredFile } from "@/api";
import type { Paged } from "@/api";
import { useListParams } from "@/hooks/useListParams";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { usePermissions } from "@/hooks/useCan";
import { formatDate, formatDateTime, formatMoney, formatMonth, formatTime } from "@/lib/format";
import type { Action, Resource } from "@/lib/permissions";

// ---------------------------------------------------------------- dữ liệu giả (giả lập server)

interface DemoStaff {
  id: string;
  fullName: string;
  position: string;
  status: "ACTIVE" | "INACTIVE";
  salary: number;
  startDate: string;
}

const FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Võ", "Đặng", "Bùi"];
const GIVEN = ["An", "Bình", "Chi", "Dung", "Giang", "Hà", "Hương", "Lan", "Mai", "Ngọc", "Phương", "Thảo"];
const POSITIONS = ["Giáo viên", "Bảo mẫu", "Cấp dưỡng", "Y tế", "Kế toán", "Bảo vệ"];

const DEMO_STAFF: DemoStaff[] = Array.from({ length: 137 }, (_, i) => ({
  id: `nv-${i + 1}`,
  fullName: `${FAMILY[i % FAMILY.length]} Thị ${GIVEN[(i * 7) % GIVEN.length]}`,
  position: POSITIONS[i % POSITIONS.length],
  status: i % 9 === 0 ? "INACTIVE" : "ACTIVE",
  salary: 6_000_000 + ((i * 373_000) % 9_000_000),
  startDate: `20${18 + (i % 8)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
}));

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/** Giả lập GET /staff?page&size&sort&q&status → Paged (độ trễ 400 ms, có thể giả lập lỗi). */
async function fakeFetchStaff(params: Record<string, unknown>, fail: boolean): Promise<Paged<DemoStaff>> {
  await new Promise((r) => setTimeout(r, 400));
  if (fail) throw new ApiError(500);
  let rows = DEMO_STAFF;
  if (params.q) rows = rows.filter((r) => strip(r.fullName).includes(strip(String(params.q))));
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  if (params.sort) {
    const [field, dir] = String(params.sort).split(",") as [keyof DemoStaff, string];
    rows = [...rows].sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const page = Number(params.page);
  const size = Number(params.size);
  return {
    items: rows.slice(page * size, page * size + size),
    page,
    size,
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / size),
  };
}

// ---------------------------------------------------------------- các phần trưng bày

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function TableDemo() {
  const [fail, setFail] = useState(false);
  const [selected, setSelected] = useState<DemoStaff[]>([]);
  const params = useListParams({ filterKeys: ["status"] });
  const { queryKey } = useCurrentSchool();
  const query = useQuery({
    queryKey: queryKey("dev-staff", params.apiParams, fail),
    queryFn: () => fakeFetchStaff(params.apiParams, fail),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<DemoStaff>[]>(
    () => [
      { id: "fullName", accessorKey: "fullName", header: "Họ tên", enableSorting: true, enableHiding: false },
      { id: "position", accessorKey: "position", header: "Vị trí", enableSorting: true },
      { id: "startDate", accessorKey: "startDate", header: "Ngày vào làm", enableSorting: true, cell: ({ getValue }) => formatDate(getValue<string>()) },
      {
        id: "salary",
        accessorKey: "salary",
        header: "Lương cơ bản",
        enableSorting: true,
        cell: ({ getValue }) => formatMoney(getValue<number>()),
        meta: { align: "right", permission: { action: "view", resource: "payroll" } },
      },
      { id: "status", accessorKey: "status", header: "Trạng thái", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    ],
    [],
  );

  const exportDemo = async () => {
    const sheet = XLSX.utils.json_to_sheet(DEMO_STAFF.slice(0, 20).map((r) => ({ "Họ tên": r.fullName, "Vị trí": r.position, "Lương": r.salary })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Nhân sự");
    const blob = new Blob([XLSX.write(book, { type: "array", bookType: "xlsx" })]);
    const response = new Response(blob, {
      headers: { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("Danh sách nhân sự (mẫu).xlsx")}` },
    });
    return { data: blob, response };
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Switch id="fail" checked={fail} onCheckedChange={setFail} />
        <label htmlFor="fail">Giả lập lỗi máy chủ (xem ErrorState)</label>
        {selected.length > 0 && <span className="ml-auto text-muted-foreground">Đang chọn {selected.length} dòng</span>}
      </div>
      <FilterBar
        params={params}
        searchPlaceholder="Tìm theo họ tên"
        filters={[
          { type: "select", key: "status", label: "Trạng thái", options: [{ value: "ACTIVE", label: "Đang hoạt động" }, { value: "INACTIVE", label: "Ngừng hoạt động" }] },
        ]}
      >
        <ExportButton request={exportDemo} />
      </FilterBar>
      <DataTable
        tableId="dev-staff"
        columns={columns}
        query={query}
        params={params}
        getRowId={(r) => r.id}
        onSelectionChange={setSelected}
        emptyTitle="Chưa có nhân viên"
      />
    </>
  );
}

const demoSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên"),
  email: z.string().trim().email("Email không hợp lệ"),
  salary: z.coerce.number({ invalid_type_error: "Nhập số" }).min(0, "Không được âm"),
});
type DemoForm = z.infer<typeof demoSchema>;

function FormDemo() {
  const [open, setOpen] = useState(false);
  const form = useForm<DemoForm>({ resolver: zodResolver(demoSchema), defaultValues: { fullName: "", email: "", salary: 0 } });

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Nhập email <code>trung@truong.vn</code> để giả lập lỗi theo trường từ backend; email khác thì lưu thành công.
      </p>
      <Button onClick={() => setOpen(true)} className="min-h-11">
        <Plus className="w-4 h-4 mr-2" />
        Mở FormSheet
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title="Thêm nhân viên (mẫu)"
        form={form}
        successMessage="Đã thêm nhân viên."
        onSubmit={async (values) => {
          await new Promise((r) => setTimeout(r, 600));
          if (values.email === "trung@truong.vn") {
            throw new ApiError(400, {
              title: "Yêu cầu không hợp lệ",
              status: 400,
              detail: "Dữ liệu không hợp lệ.",
              code: "VALIDATION_FAILED",
              errors: [{ field: "email", message: "Email đã được dùng cho tài khoản khác" }],
            });
          }
        }}
      >
        {(["fullName", "email", "salary"] as const).map((name) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{{ fullName: "Họ tên", email: "Email", salary: "Lương cơ bản (đồng)" }[name]}</FormLabel>
                <FormControl>
                  <Input {...field} type={name === "salary" ? "number" : "text"} className="min-h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </FormSheet>
    </>
  );
}

const ALL_RESOURCES: Resource[] = ["settings", "staff", "documents", "tasks", "attendance", "classes", "health", "finance", "payroll", "reports"];
const ALL_ACTIONS: Action[] = ["view", "manage", "approve", "export"];

function PermissionDemo() {
  const check = usePermissions();
  const { school, isAllSchools } = useCurrentSchool();
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Quyền giao diện của tài khoản hiện tại ở {isAllSchools ? "tất cả cơ sở" : school?.name} (đổi cơ sở trên header để thấy thay đổi).
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="text-left pr-4">Module</th>
              {ALL_ACTIONS.map((a) => (
                <th key={a} className="px-2">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_RESOURCES.map((r) => (
              <tr key={r}>
                <td className="pr-4">{r}</td>
                {ALL_ACTIONS.map((a) => (
                  <td key={a} className="px-2 text-center">{check(a, r) ? "✓" : "–"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Trang mẫu component (chỉ dev): xem nhanh mọi component dùng chung với dữ liệu giả. */
export default function DevUi() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<StoredFile | null>(null);
  const now = "2026-09-29T01:05:00Z";

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Thư viện component (dev)"
        description="Chỉ có ở môi trường dev. Mỗi trang mới dùng các component này theo mục “Quy ước giao diện” trong CLAUDE.md."
        breadcrumbs={[{ label: "Trang chủ", to: "/" }, { label: "Dev" }, { label: "Component" }]}
        actions={
          <>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Xóa (ConfirmDialog)
            </Button>
            <Button className="min-h-11">Hành động chính</Button>
          </>
        }
      />

      <Section title="DataTable + FilterBar + ExportButton">
        <TableDemo />
      </Section>

      <Section title="FormSheet (react-hook-form + zod + lỗi từ API)">
        <FormDemo />
      </Section>

      <Section title="StatusBadge">
        <div className="flex flex-wrap gap-2">
          {Object.keys(COMMON_STATUSES).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Định dạng">
        <ul className="text-sm space-y-1">
          <li>formatMoney(1500000): {formatMoney(1500000)}</li>
          <li>formatDate("2026-09-01"): {formatDate("2026-09-01")}</li>
          <li>formatTime({now}): {formatTime(now)}</li>
          <li>formatDateTime: {formatDateTime(now)}</li>
          <li>formatMonth("2026-09"): {formatMonth("2026-09")}</li>
        </ul>
      </Section>

      <Section title="FileUpload (presigned URL, cần backend + MinIO)">
        <FileUpload label="Giấy khám sức khỏe" value={file} onChange={setFile} className="max-w-md" />
      </Section>

      <Section title="EmptyState / ErrorState / Skeleton">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState title="Chưa có dữ liệu" description="Bấm “Thêm mới” để tạo bản ghi đầu tiên." action={<Button className="min-h-11">Thêm mới</Button>} />
          <ErrorState error={new ApiError(500)} onRetry={() => undefined} />
          <TableSkeleton rows={3} />
          <PageSkeleton />
        </div>
      </Section>

      <Section title="useCan – ma trận quyền">
        <PermissionDemo />
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa bản ghi?"
        description="Thao tác này không hoàn tác được."
        confirmText="Xóa"
        variant="destructive"
        onConfirm={() => new Promise((r) => setTimeout(r, 800))}
      />
    </div>
  );
}

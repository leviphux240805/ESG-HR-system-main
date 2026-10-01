import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { FileUpload } from "@/components/common/FileUpload";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { useListParams } from "@/hooks/useListParams";
import { openDownload } from "@/lib/filePreview";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import { MonthNav } from "@/features/finance/MonthNav";
import { useMonthParam } from "@/features/finance/useMonthParam";
import { useFinanceAccess } from "@/features/finance/access";
import { moneyInput, parseMoney } from "@/features/finance/money";
import {
  CASH_FILTER_KEYS,
  CASH_SOURCE_LABELS,
  type CashCategory,
  type CashEntry,
  type StoredFile,
  cashEntryFileUrl,
  createCashCategory,
  deleteCashEntry,
  monthEnd,
  monthStart,
  saveCashEntry,
  updateCashCategory,
  useCashCategories,
  useCashEntries,
  useCashSummary,
} from "@/api";

const DIRECTION_LABELS = { IN: "Thu", OUT: "Chi" } as const;
const ACTIVE = { true: { label: "Đang dùng", tone: "success" }, false: { label: "Ngừng dùng", tone: "neutral" } } as const;
const signed = (e: { direction: "IN" | "OUT"; amount: number }) => (e.direction === "IN" ? e.amount : -e.amount);

const entrySchema = z.object({
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  amount: moneyInput(),
  entryDate: z.string().min(1, "Vui lòng chọn ngày"),
  description: z.string().trim().min(1, "Vui lòng nhập nội dung").max(500),
  file: z.custom<StoredFile | null>().nullable(),
  keepFileId: z.string().optional(),
});
type EntryForm = z.infer<typeof entrySchema>;

const categorySchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  name: z.string().trim().min(1, "Vui lòng nhập tên danh mục").max(100),
  orderNo: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), "Nhập số nguyên ≥ 0"),
  active: z.boolean(),
});
type CategoryForm = z.infer<typeof categorySchema>;

function Summary({ month }: { month: string }) {
  const { data } = useCashSummary(month);
  if (!data) return <Skeleton className="mb-4 h-28" />;
  const cards = [
    { label: "Tổng thu", value: data.totalIn, className: "text-green-700" },
    { label: "Tổng chi", value: data.totalOut, className: "text-destructive" },
    { label: "Chênh lệch", value: data.net, className: data.net < 0 ? "text-destructive" : "" },
  ];
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground sm:text-sm">{c.label}</p>
              <p className={cn("text-sm font-bold tabular-nums sm:text-xl", c.className)}>{formatMoney(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {data.byCategory.length > 0 && (
        <Card>
          <CardContent className="grid gap-x-6 gap-y-1 p-3 text-sm sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
            {data.byCategory.map((c) => (
              <p key={c.categoryId} className="flex justify-between gap-2">
                <span className="truncate">{c.categoryName}</span>
                <span className={cn("tabular-nums", c.direction === "IN" ? "text-green-700" : "text-destructive")}>{formatMoney(signed(c))}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EntriesTab({ month, canManage }: { month: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const params = useListParams({ filterKeys: CASH_FILTER_KEYS });
  const query = useCashEntries(month, params);
  const categories = useCashCategories();
  const [editing, setEditing] = useState<CashEntry | "new" | null>(null);
  const [removing, setRemoving] = useState<CashEntry | null>(null);
  const form = useForm<EntryForm>({ resolver: zodResolver(entrySchema) });
  const keepFileId = form.watch("keepFileId");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const manualCategories = useMemo(
    () => (categories.data ?? []).filter((c) => !c.system && c.active).map((c) => ({ value: c.id, label: `${DIRECTION_LABELS[c.direction]} · ${c.name}` })),
    [categories.data],
  );
  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "direction", label: "Loại", options: Object.entries(DIRECTION_LABELS).map(([value, label]) => ({ value, label })) },
      { type: "select", key: "categoryId", label: "Danh mục", options: (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
    ],
    [categories.data],
  );

  const open = useCallback(
    (item: CashEntry | "new") => {
      const e = item === "new" ? null : item;
      const today = new Date().toLocaleDateString("sv-SE");
      const inMonth = today >= monthStart(month) && today <= monthEnd(month);
      form.reset({
        categoryId: e?.categoryId ?? "",
        amount: e ? String(e.amount) : "",
        entryDate: e?.entryDate ?? (inMonth ? today : monthStart(month)),
        description: e?.description ?? "",
        file: null,
        keepFileId: e?.fileId,
      });
      setEditing(item);
    },
    [form, month],
  );

  const columns = useMemo<ColumnDef<CashEntry>[]>(
    () => [
      { id: "entryDate", header: "Ngày", cell: ({ row }) => formatDate(row.original.entryDate) },
      {
        id: "description",
        header: "Nội dung",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <p>{row.original.description}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.categoryName}
              {row.original.createdByName && ` · ${row.original.createdByName}`}
            </p>
          </div>
        ),
      },
      { id: "source", header: "Nguồn", cell: ({ row }) => CASH_SOURCE_LABELS[row.original.source] },
      {
        id: "amount",
        header: "Số tiền",
        enableHiding: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className={cn("tabular-nums font-medium", row.original.direction === "IN" ? "text-green-700" : "text-destructive")}>
            {formatMoney(signed(row.original))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            {row.original.fileId && (
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Xem chứng từ" onClick={() => openDownload(() => cashEntryFileUrl(row.original.id))}>
                <Paperclip className="w-4 h-4" />
              </Button>
            )}
            {canManage && row.original.source === "MANUAL" && (
              <>
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(row.original)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Xóa" onClick={() => setRemoving(row.original)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [canManage, open],
  );

  return (
    <>
      {canManage && (
        <Button className="mb-3 min-h-11" onClick={() => open("new")}>
          <Plus className="w-4 h-4 mr-2" /> Thêm khoản thu/chi
        </Button>
      )}
      <FilterBar params={params} searchPlaceholder="Tìm theo nội dung" filters={filters} />
      <DataTable
        tableId="cash-entries"
        columns={columns}
        query={query}
        params={params}
        getRowId={(r) => r.id}
        mobileCard={(r) => (
          <div className="flex min-h-11 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(r.entryDate)} · {r.categoryName}
              </p>
            </div>
            <span className={cn("tabular-nums font-medium", r.direction === "IN" ? "text-green-700" : "text-destructive")}>{formatMoney(signed(r))}</span>
            {canManage && r.source === "MANUAL" && (
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(r)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        emptyTitle="Chưa có khoản thu chi"
        emptyDescription="Khoản thu học phí và chi lương được ghi tự động; khoản khác nhập tay."
      />
      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm khoản thu/chi" : "Sửa khoản thu/chi"}
        form={form}
        onSubmit={async (v) => {
          await saveCashEntry(editing === "new" || !editing ? null : editing.id, {
            categoryId: v.categoryId,
            amount: parseMoney(v.amount),
            entryDate: v.entryDate,
            description: v.description,
            fileId: v.file?.id ?? v.keepFileId,
          });
          await refresh();
        }}
      >
        <SelectField form={form} name="categoryId" label="Danh mục" required options={manualCategories} />
        <TextField form={form} name="amount" label="Số tiền (₫)" inputMode="numeric" required />
        <TextField form={form} name="entryDate" label="Ngày" type="date" required />
        <TextField form={form} name="description" label="Nội dung" required />
        {keepFileId ? (
          <div className="flex min-h-11 items-center gap-2 text-sm">
            <Paperclip className="w-4 h-4" /> Đã có chứng từ
            <Button type="button" variant="link" className="min-h-11" onClick={() => form.setValue("keepFileId", undefined, { shouldDirty: true })}>
              Thay chứng từ khác
            </Button>
          </div>
        ) : (
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem>
                <FileUpload label="Chứng từ (hóa đơn, phiếu chi)" value={field.value ?? null} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa khoản này?"
        description={removing ? `${removing.description} · ${formatMoney(removing.amount)}` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteCashEntry(removing!.id);
          toast.success("Đã xóa.");
          await refresh();
        }}
      />
    </>
  );
}

function CategoriesTab({ canCatalog }: { canCatalog: boolean }) {
  const queryClient = useQueryClient();
  const query = useCashCategories();
  const [editing, setEditing] = useState<CashCategory | "new" | null>(null);
  const form = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });

  const open = (item: CashCategory | "new") => {
    const c = item === "new" ? null : item;
    form.reset({ direction: c?.direction ?? "OUT", name: c?.name ?? "", orderNo: String(c?.orderNo ?? ""), active: c?.active ?? true });
    setEditing(item);
  };

  if (query.isLoading) return <TableSkeleton rows={6} columns={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const list = query.data ?? [];

  return (
    <div className="space-y-3">
      {canCatalog && (
        <Button className="min-h-11" onClick={() => open("new")}>
          <Plus className="w-4 h-4 mr-2" /> Thêm danh mục
        </Button>
      )}
      {list.length === 0 ? (
        <EmptyState icon={Tags} title="Chưa có danh mục" />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Danh mục thu chi (dùng chung trong tổ chức)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  {canCatalog && <TableHead className="w-14" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{DIRECTION_LABELS[c.direction]}</TableCell>
                    <TableCell>
                      {c.name}
                      {c.system && <span className="block text-xs text-muted-foreground">Hệ thống ghi tự động</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(c.active)} labels={ACTIVE} />
                    </TableCell>
                    {canCatalog && (
                      <TableCell>
                        {!c.system && (
                          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Sửa ${c.name}`} onClick={() => open(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm danh mục" : "Sửa danh mục"}
        form={form}
        onSubmit={async (v) => {
          const orderNo = v.orderNo === "" ? undefined : Number(v.orderNo);
          if (editing === "new") await createCashCategory({ direction: v.direction, name: v.name, orderNo });
          else if (editing) await updateCashCategory(editing.id, { name: v.name, orderNo, active: v.active });
          await queryClient.invalidateQueries({ queryKey: ["finance"] });
        }}
      >
        {editing === "new" && (
          <SelectField form={form} name="direction" label="Loại" required options={Object.entries(DIRECTION_LABELS).map(([value, label]) => ({ value, label }))} />
        )}
        <TextField form={form} name="name" label="Tên danh mục" required />
        <TextField form={form} name="orderNo" label="Thứ tự" inputMode="numeric" />
        {editing !== "new" && (
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex min-h-11 items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <FormLabel className="font-normal">Đang dùng</FormLabel>
              </FormItem>
            )}
          />
        )}
      </FormSheet>
    </div>
  );
}

/** Sổ thu chi theo tháng: thu học phí, chi lương ghi tự động; khoản khác nhập tay kèm chứng từ. */
export default function CashBookPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useMonthParam();
  const { isAllSchools } = useCurrentSchool();
  const access = useFinanceAccess();
  const tab = searchParams.get("tab") === "danh-muc" ? "danh-muc" : "so";
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "so") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Thu chi"
        description="Sổ thu chi của cơ sở theo tháng."
        actions={tab === "so" && <MonthNav month={month} onChange={setMonth} />}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="so" className="min-h-9">
            Sổ thu chi
          </TabsTrigger>
          <TabsTrigger value="danh-muc" className="min-h-9">
            Danh mục
          </TabsTrigger>
        </TabsList>
        <TabsContent value="so">
          <Summary month={month} />
          <EntriesTab month={month} canManage={access.canManage && !isAllSchools} />
        </TabsContent>
        <TabsContent value="danh-muc">
          <CategoriesTab canCatalog={access.canCatalog} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

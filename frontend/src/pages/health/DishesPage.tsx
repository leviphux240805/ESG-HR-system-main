import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { CheckboxField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { useMenuAccess } from "@/features/health/access";
import { formatIngredients, ingredientSummary, parseIngredients } from "@/features/health/ingredients";
import { DISH_FILTER_KEYS, type Dish, deleteDish, saveDish, useDishes } from "@/api";

const ACTIVE = { true: { label: "Đang dùng", tone: "success" }, false: { label: "Ngừng dùng", tone: "neutral" } } as const;

const optionalNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= 0 && Number(v.replace(",", ".")) <= max), `${label} không hợp lệ`);

const schema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên món").max(150, "Tên món tối đa 150 ký tự"),
  ingredients: z
    .string()
    .refine((v) => parseIngredients(v).length <= 30, "Tối đa 30 nguyên liệu")
    .refine((v) => parseIngredients(v).every((i) => i.name.length <= 100), "Tên nguyên liệu tối đa 100 ký tự"),
  kcal: optionalNumber("Năng lượng", 5000),
  proteinG: optionalNumber("Chất đạm", 500),
  fatG: optionalNumber("Chất béo", 500),
  carbG: optionalNumber("Chất bột đường", 500),
  shared: z.boolean(),
  active: z.boolean(),
});
type DishForm = z.infer<typeof schema>;

const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
const text = (v: number | undefined | null) => (v == null ? "" : String(v));

/** Danh mục món ăn: món chung của tổ chức (hiệu trưởng) và món riêng của cơ sở (cấp dưỡng, y tế, hiệu trưởng). */
export default function DishesPage() {
  const queryClient = useQueryClient();
  const { canEdit, canShared } = useMenuAccess();
  const params = useListParams({ filterKeys: DISH_FILTER_KEYS });
  const query = useDishes(params);
  const [editing, setEditing] = useState<Dish | "new" | null>(null);
  const [removing, setRemoving] = useState<Dish | null>(null);
  const form = useForm<DishForm>({ resolver: zodResolver(schema) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["menu"], exact: false });

  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "select", key: "shared", label: "Phạm vi", options: [{ value: "true", label: "Chung tổ chức" }, { value: "false", label: "Riêng cơ sở" }] },
      { type: "select", key: "active", label: "Trạng thái", options: [{ value: "true", label: "Đang dùng" }, { value: "false", label: "Ngừng dùng" }] },
    ],
    [],
  );

  const open = useCallback(
    (item: Dish | "new") => {
      const d = item === "new" ? null : item;
      form.reset({
        name: d?.name ?? "",
        ingredients: d ? formatIngredients(d.ingredients) : "",
        kcal: text(d?.kcal),
        proteinG: text(d?.proteinG),
        fatG: text(d?.fatG),
        carbG: text(d?.carbG),
        shared: d?.shared ?? false,
        active: d?.active ?? true,
      });
      setEditing(item);
    },
    [form],
  );

  const columns = useMemo<ColumnDef<Dish>[]>(
    () => [
      {
        id: "name",
        header: "Món",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-[10rem]">
            <p className="font-medium">
              {row.original.name}
              {row.original.shared && (
                <Badge variant="secondary" className="ml-2 align-middle">
                  Chung chuỗi
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{ingredientSummary(row.original.ingredients) || "Chưa có nguyên liệu"}</p>
          </div>
        ),
      },
      { id: "kcal", header: "kcal", meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{row.original.kcal ?? "—"}</span> },
      {
        id: "macro",
        header: "Đạm · béo · bột (g)",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {[row.original.proteinG, row.original.fatG, row.original.carbG].map((v) => v ?? "—").join(" · ")}
          </span>
        ),
      },
      { id: "active", header: "Trạng thái", cell: ({ row }) => <StatusBadge status={String(row.original.active)} labels={ACTIVE} /> },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.canEdit && (
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(row.original)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Xóa" onClick={() => setRemoving(row.original)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ),
      },
    ],
    [open],
  );

  return (
    <div>
      <PageHeader
        title="Món ăn"
        description="Nguyên liệu và giá trị dinh dưỡng mỗi suất; dùng để lên thực đơn và cảnh báo dị ứng."
        actions={
          canEdit && (
            <Button className="min-h-11" onClick={() => open("new")}>
              <Plus className="w-4 h-4 mr-2" /> Thêm món
            </Button>
          )
        }
      />
      <FilterBar params={params} searchPlaceholder="Tìm theo tên món, nguyên liệu" filters={filters} />
      <DataTable
        tableId="dishes"
        columns={columns}
        query={query}
        params={params}
        getRowId={(r) => r.id}
        mobileCard={(r) => (
          <div className="flex min-h-11 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {r.name}
                {!r.active && <span className="ml-2 text-xs text-muted-foreground">(ngừng dùng)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.shared ? "Chung chuỗi · " : ""}
                {r.kcal != null ? `${r.kcal} kcal · ` : ""}
                {ingredientSummary(r.ingredients)}
              </p>
            </div>
            {r.canEdit && (
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(r)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        emptyTitle="Chưa có món ăn"
        emptyDescription={canEdit ? "Bấm “Thêm món” để tạo món đầu tiên." : "Thử đổi bộ lọc."}
      />

      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Thêm món" : "Sửa món"}
        form={form}
        onSubmit={async (v) => {
          await saveDish(editing === "new" || !editing ? null : editing.id, {
            name: v.name,
            ingredients: parseIngredients(v.ingredients),
            kcal: num(v.kcal),
            proteinG: num(v.proteinG),
            fatG: num(v.fatG),
            carbG: num(v.carbG),
            shared: v.shared,
            active: v.active,
          });
          await refresh();
        }}
      >
        <TextField form={form} name="name" label="Tên món" required />
        <TextAreaField
          form={form}
          name="ingredients"
          label="Nguyên liệu"
          rows={5}
          description="Mỗi dòng một nguyên liệu kèm số gram mỗi suất, ví dụ “Thịt lợn 30”. Tên nguyên liệu dùng để cảnh báo dị ứng."
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField form={form} name="kcal" label="Năng lượng (kcal)" inputMode="decimal" />
          <TextField form={form} name="proteinG" label="Chất đạm (g)" inputMode="decimal" />
          <TextField form={form} name="fatG" label="Chất béo (g)" inputMode="decimal" />
          <TextField form={form} name="carbG" label="Chất bột đường (g)" inputMode="decimal" />
        </div>
        {editing === "new" && canShared && (
          <CheckboxField form={form} name="shared" label="Món dùng chung trong tổ chức" description="Mọi cơ sở đều chọn được món này." />
        )}
        {editing !== "new" && <CheckboxField form={form} name="active" label="Đang dùng" description="Món ngừng dùng không chọn được khi lên thực đơn mới." />}
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa món này?"
        description={removing ? `${removing.name}. Món đã có trong thực đơn thì không xóa được, hãy chuyển sang ngừng dùng.` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteDish(removing!.id);
          toast.success("Đã xóa món.");
          await refresh();
        }}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Loader2, Pencil, Plus, Send, Undo2, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckboxField, TextField } from "@/features/staff/profile/fields";
import { useMenuAccess } from "@/features/health/access";
import { WeekNav } from "@/features/health/WeekNav";
import { addDays, mondayOf, useWeekParam, weekDays, weekdayLabel } from "@/features/health/week";
import {
  type AllergyWarning,
  ApiError,
  MEALS,
  MEAL_LABELS,
  MENU_STATUS,
  type Meal,
  type MenuWeek,
  copyMenuWeek,
  errorMessage,
  publishMenu,
  saveMenuWeek,
  useAgeGroups,
  useAllergyWarnings,
  useDishOptions,
  useMenuWeek,
} from "@/api";

interface DraftItem {
  key: string;
  date: string;
  meal: Meal;
  dishId: string;
  dishName: string;
  note?: string;
}

type Alerts = Map<string, string[]>;

const cellKey = (date: string, meal: Meal) => `${date}|${meal}`;
const alertKey = (date: string, meal: Meal, dishName: string) => `${date}|${meal}|${dishName}`;

/** Trẻ dị ứng theo món trong ô: "date|meal|dishName" → tên trẻ. */
function alertMap(warnings: AllergyWarning[] | undefined): Alerts {
  const map: Alerts = new Map();
  for (const w of warnings ?? []) {
    for (const m of w.matches) {
      const key = alertKey(m.date, m.meal, m.dishName);
      map.set(key, [...(map.get(key) ?? []), w.childName]);
    }
  }
  return map;
}

const copySchema = z.object({
  from: z.string().min(1, "Vui lòng chọn tuần nguồn"),
  overwrite: z.boolean(),
});
type CopyForm = z.infer<typeof copySchema>;

function DishPicker({ target, onPick, onClose }: { target: { date: string; meal: Meal } | null; onPick: (dish: { id: string; name: string }) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const query = useDishOptions(debounced);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm món</DialogTitle>
          <DialogDescription>{target && `${MEAL_LABELS[target.meal]} · ${weekdayLabel(target.date)} ${formatDate(target.date)}`}</DialogDescription>
        </DialogHeader>
        <Input autoFocus className="min-h-11" placeholder="Tìm món, nguyên liệu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm món" />
        {query.isLoading ? (
          <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data!.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Không có món phù hợp. Thêm món ở trang “Món ăn”.</p>
        ) : (
          <ul className="divide-y">
            {query.data!.items.map((d) => (
              <li key={d.id}>
                <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-1 py-2 text-left hover:bg-muted" onClick={() => onPick(d)}>
                  <span>
                    {d.name}
                    {d.shared && <span className="ml-2 text-xs text-muted-foreground">chung chuỗi</span>}
                  </span>
                  {d.kcal != null && <span className="text-xs tabular-nums text-muted-foreground">{d.kcal} kcal</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Cell({
  date,
  meal,
  items,
  alerts,
  editing,
  onAdd,
  onRemove,
}: {
  date: string;
  meal: Meal;
  items: DraftItem[];
  alerts: Alerts;
  editing: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((i) => {
        const kids = alerts.get(alertKey(date, meal, i.dishName));
        return (
          <div key={i.key} className={cn("flex items-start gap-1 rounded-md px-2 py-1 text-sm", kids ? "bg-amber-50 text-amber-900" : "bg-muted/50")}>
            <span className="flex-1">
              {i.dishName}
              {kids && (
                <span className="mt-0.5 flex items-center gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {kids.join(", ")}
                </span>
              )}
            </span>
            {editing && (
              <Button type="button" variant="ghost" size="icon" className="-my-1 h-9 w-9 shrink-0" aria-label={`Bỏ ${i.dishName}`} onClick={() => onRemove(i.key)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
      {editing && (
        <Button type="button" variant="ghost" className="min-h-11 w-full justify-start text-muted-foreground" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" /> Thêm món
        </Button>
      )}
      {!editing && items.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
    </div>
  );
}

function AllergyCard({ warnings }: { warnings: AllergyWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Trẻ có ghi chú dị ứng ({warnings.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {warnings.map((w) => (
          <div key={w.childId} className="border-b pb-2 last:border-0 last:pb-0">
            <p>
              <b>{w.childName}</b>
              {w.className && <span className="text-muted-foreground"> · {w.className}</span>} — {w.allergyNote}
            </p>
            {w.matches.length === 0 ? (
              <p className="text-xs text-muted-foreground">Không thấy món trùng nguyên liệu trong tuần.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                {w.matches.map((m, i) => (
                  <li key={i}>
                    {weekdayLabel(m.date)} · {MEAL_LABELS[m.meal]}: {m.dishName} (có {m.ingredient})
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const toDraft = (data: MenuWeek): DraftItem[] =>
  data.items.map((i) => ({ key: i.id, date: i.date, meal: i.meal, dishId: i.dishId, dishName: i.dishName, note: i.note ?? undefined }));

/** Thực đơn tuần theo cơ sở và khối: lưới ngày × bữa, sao chép tuần, công bố, cảnh báo dị ứng. */
export default function MenuPage() {
  const queryClient = useQueryClient();
  const [week, setWeek] = useWeekParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const ageGroupId = searchParams.get("khoi") ?? undefined;
  const { canEdit } = useMenuAccess();
  const query = useMenuWeek(week, ageGroupId);
  const warnings = useAllergyWarnings(week, ageGroupId);
  const ageGroups = useAgeGroups();
  const [draft, setDraft] = useState<DraftItem[] | null>(null);
  const [picking, setPicking] = useState<{ date: string; meal: Meal } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const copyForm = useForm<CopyForm>({ resolver: zodResolver(copySchema) });
  const alerts = useMemo(() => alertMap(warnings.data), [warnings.data]);
  const editing = draft !== null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["menu"] });
  const setAgeGroup = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "ALL") next.delete("khoi");
    else next.set("khoi", value);
    setSearchParams(next, { replace: true });
    setDraft(null);
  };
  const changeWeek = (value: string) => {
    setWeek(value);
    setDraft(null);
  };

  if (query.isLoading) return <PageSkeleton />;
  const data = query.data;
  const items = draft ?? (data ? toDraft(data) : []);
  const hasSaturday = items.some((i) => weekdayLabel(i.date) === "Thứ Bảy");
  const days = weekDays(week, hasSaturday ? 6 : 5);
  const byCell = new Map<string, DraftItem[]>();
  for (const i of items) byCell.set(cellKey(i.date, i.meal), [...(byCell.get(cellKey(i.date, i.meal)) ?? []), i]);
  const meals = MEALS.filter((m) => m !== "SNACK" || items.some((i) => i.meal === "SNACK") || editing);
  const nutrition = new Map((data?.days ?? []).map((d) => [d.date, d]));

  const cell = (date: string, meal: Meal) => (
    <Cell
      date={date}
      meal={meal}
      items={byCell.get(cellKey(date, meal)) ?? []}
      alerts={alerts}
      editing={editing}
      onAdd={() => setPicking({ date, meal })}
      onRemove={(key) => setDraft((d) => d!.filter((x) => x.key !== key))}
    />
  );

  const save = async () => {
    setSaving(true);
    try {
      await saveMenuWeek({ weekStart: week, ageGroupId, note: data?.note ?? undefined, items: draft!.map(({ date, meal, dishId, note }) => ({ date, meal, dishId, note })) });
      toast.success("Đã lưu thực đơn.");
      setDraft(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <WeekNav week={week} onChange={changeWeek} />
      <Select value={ageGroupId ?? "ALL"} onValueChange={setAgeGroup}>
        <SelectTrigger className="min-h-11 w-[11rem]" aria-label="Khối">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Chung mọi khối</SelectItem>
          {(ageGroups.data ?? []).map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Thực đơn tuần" description="Lên thực đơn theo ngày và bữa; món có nguyên liệu trùng ghi chú dị ứng của trẻ được tô vàng." actions={actions} />
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data!.status} labels={MENU_STATUS} />
            {data!.allergyAlerts > 0 && (
              <Badge variant="outline" className="border-amber-400 text-amber-800">
                <AlertTriangle className="mr-1 h-3 w-3" /> {data!.allergyAlerts} trẻ cần đổi món
              </Badge>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {canEdit && !editing && (
                <>
                  <Button variant="outline" className="min-h-11" onClick={() => setDraft(toDraft(data!))}>
                    <Pencil className="w-4 h-4 mr-2" /> Sửa thực đơn
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      copyForm.reset({ from: addDays(week, -7), overwrite: false });
                      setCopyOpen(true);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Sao chép tuần
                  </Button>
                  {data!.id && data!.items.length > 0 && (
                    <Button className="min-h-11" variant={data!.status === "PUBLISHED" ? "outline" : "default"} onClick={() => setConfirm(data!.status === "PUBLISHED" ? "unpublish" : "publish")}>
                      {data!.status === "PUBLISHED" ? <Undo2 className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {data!.status === "PUBLISHED" ? "Chuyển về nháp" : "Công bố"}
                    </Button>
                  )}
                </>
              )}
              {editing && (
                <>
                  <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => setDraft(null)}>
                    Hủy
                  </Button>
                  <Button className="min-h-11" disabled={saving} onClick={save}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Lưu thực đơn
                  </Button>
                </>
              )}
            </div>
          </div>

          {items.length === 0 && !editing ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Tuần này chưa có thực đơn"
              description={canEdit ? "Bấm “Sửa thực đơn” để chọn món, hoặc “Sao chép tuần” để lấy thực đơn tuần trước." : "Cấp dưỡng hoặc y tế chưa lên thực đơn cho tuần này."}
            />
          ) : (
            <>
              {/* Màn hình rộng: bảng bữa × ngày */}
              <div className="hidden overflow-x-auto rounded-md border md:block">
                <table className="w-full min-w-[48rem] table-fixed text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-28 p-2 text-left font-medium">Bữa</th>
                      {days.map((d) => (
                        <th key={d} className="p-2 text-left font-medium">
                          {weekdayLabel(d)}
                          <span className="block text-xs font-normal text-muted-foreground">{formatDate(d)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meals.map((m) => (
                      <tr key={m} className="border-t align-top">
                        <td className="p-2 font-medium">{MEAL_LABELS[m]}</td>
                        {days.map((d) => (
                          <td key={d} className="p-2">
                            {cell(d, m)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!editing && (
                      <tr className="border-t bg-muted/30 text-xs text-muted-foreground">
                        <td className="p-2">Dinh dưỡng / suất</td>
                        {days.map((d) => {
                          const n = nutrition.get(d);
                          return (
                            <td key={d} className="p-2 tabular-nums">
                              {n ? `${n.kcal} kcal · Đ ${n.proteinG} · B ${n.fatG} · BĐ ${n.carbG} g` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Điện thoại: mỗi ngày một thẻ */}
              <div className="space-y-3 md:hidden">
                {days.map((d) => {
                  const n = nutrition.get(d);
                  return (
                    <Card key={d}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {weekdayLabel(d)} <span className="font-normal text-muted-foreground">{formatDate(d)}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {meals.map((m) => (
                          <div key={m}>
                            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{MEAL_LABELS[m]}</p>
                            {cell(d, m)}
                          </div>
                        ))}
                        {n && !editing && (
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {n.kcal} kcal · đạm {n.proteinG} g · béo {n.fatG} g · bột đường {n.carbG} g
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {editing && <p className="text-xs text-muted-foreground">Cảnh báo dị ứng cập nhật sau khi lưu.</p>}
            </>
          )}
          {warnings.data && <AllergyCard warnings={warnings.data} />}
        </>
      )}

      <DishPicker
        target={picking}
        onClose={() => setPicking(null)}
        onPick={(dish) => {
          const target = picking!;
          setDraft((d) =>
            d!.some((x) => x.date === target.date && x.meal === target.meal && x.dishId === dish.id)
              ? d!
              : [...d!, { key: crypto.randomUUID?.() ?? `${Date.now()}`, date: target.date, meal: target.meal, dishId: dish.id, dishName: dish.name }],
          );
          setPicking(null);
        }}
      />
      <FormSheet
        open={copyOpen}
        onOpenChange={setCopyOpen}
        title="Sao chép thực đơn"
        description="Lấy toàn bộ món của tuần nguồn (cùng khối) sang tuần đang xem; thực đơn sao chép ở trạng thái nháp."
        form={copyForm}
        submitLabel="Sao chép"
        successMessage="Đã sao chép thực đơn."
        onSubmit={async (v) => {
          try {
            await copyMenuWeek({ fromWeekStart: mondayOf(v.from), toWeekStart: week, ageGroupId, overwrite: v.overwrite });
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              copyForm.setValue("overwrite", true, { shouldDirty: true });
            }
            throw error;
          }
          await refresh();
        }}
      >
        <TextField form={copyForm} name="from" label="Tuần nguồn (chọn ngày bất kỳ trong tuần)" type="date" required />
        <CheckboxField form={copyForm} name="overwrite" label="Ghi đè nếu tuần này đã có món" />
      </FormSheet>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "publish" ? "Công bố thực đơn tuần này?" : "Chuyển thực đơn về nháp?"}
        description={confirm === "publish" ? "Giáo viên và phụ huynh (khi có cổng phụ huynh) sẽ xem được thực đơn đã công bố." : undefined}
        confirmText={confirm === "publish" ? "Công bố" : "Chuyển về nháp"}
        onConfirm={async () => {
          await publishMenu(data!.id!, confirm === "publish");
          toast.success(confirm === "publish" ? "Đã công bố thực đơn." : "Đã chuyển về nháp.");
          await refresh();
        }}
      />
    </div>
  );
}

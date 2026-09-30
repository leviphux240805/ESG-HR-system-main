import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Coffee, Pencil, Soup, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, PageSkeleton } from "@/components/common/States";
import { errorMessage } from "@/api/errors";
import { useCan } from "@/hooks/useCan";
import { formatDate, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type DayMenu, saveDayMenu, useWeekMenu } from "@/features/health/api";

const iso = (d: Date) => d.toLocaleDateString("sv-SE");

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
}

const shiftWeek = (week: string, delta: number) => plusDays(week, delta * 7);

function EditDialog({ menuId, day, onClose }: { menuId: string; day: DayMenu | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ breakfast: "", lunch: "", snack: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (day) setDraft({ breakfast: day.breakfast, lunch: day.lunch.join("\n"), snack: day.snack });
  }, [day]);

  const save = async () => {
    if (!day) return;
    setBusy(true);
    try {
      await saveDayMenu(menuId, { date: day.date, breakfast: draft.breakfast, lunch: draft.lunch.split("\n"), snack: draft.snack });
      await queryClient.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Đã lưu thực đơn.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thực đơn {day && formatLongDate(day.date)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="m-breakfast">Bữa sáng</Label>
            <Input id="m-breakfast" className="min-h-11" value={draft.breakfast} onChange={(e) => setDraft({ ...draft, breakfast: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="m-lunch">Bữa trưa (mỗi dòng một món)</Label>
            <Textarea id="m-lunch" rows={4} value={draft.lunch} onChange={(e) => setDraft({ ...draft, lunch: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="m-snack">Bữa phụ chiều</Label>
            <Input id="m-snack" className="min-h-11" value={draft.snack} onChange={(e) => setDraft({ ...draft, snack: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button className="min-h-11" onClick={save} disabled={busy}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MEALS = [
  { key: "breakfast", label: "Bữa sáng", icon: Coffee },
  { key: "lunch", label: "Bữa trưa", icon: Soup },
  { key: "snack", label: "Bữa phụ chiều", icon: UtensilsCrossed },
] as const;

/** Thực đơn tuần của cơ sở (thứ Hai – thứ Sáu). */
export default function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const week = mondayOf(searchParams.get("week") ?? iso(new Date()));
  const query = useWeekMenu(week);
  const canEdit = useCan("manage", "approvals");
  const [editing, setEditing] = useState<DayMenu | null>(null);
  const todayIso = iso(new Date());
  const setWeek = (w: string) => setSearchParams({ week: w }, { replace: true });

  return (
    <div>
      <PageHeader
        title="Thực đơn tuần"
        description={`Tuần ${formatDate(week)} – ${formatDate(plusDays(week, 4))}`}
        actions={
          <div className="flex items-center gap-1" role="group" aria-label="Chọn tuần">
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Tuần trước">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setWeek(mondayOf(todayIso))}>
              Tuần này
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setWeek(shiftWeek(week, 1))} aria-label="Tuần sau">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          {query.data!.days.map((day) => {
            const empty = !day.breakfast && day.lunch.length === 0 && !day.snack;
            return (
              <Card key={day.date} className={cn(day.date === todayIso && "border-primary ring-1 ring-primary")}>
                <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-base">{formatLongDate(day.date).split(",")[0]}</CardTitle>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{formatDate(day.date).slice(0, 5)}</span>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditing(day)} aria-label={`Sửa thực đơn ${formatDate(day.date)}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 text-sm">
                  {empty ? (
                    <p className="text-muted-foreground">Chưa lên thực đơn.</p>
                  ) : (
                    MEALS.map(({ key, label, icon: Icon }) => (
                      <div key={key}>
                        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </p>
                        {key === "lunch" ? (
                          <ul className="list-inside list-disc">
                            {day.lunch.map((dish) => (
                              <li key={dish}>{dish}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>{day[key] || "—"}</p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {query.data && <EditDialog menuId={query.data.id} day={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

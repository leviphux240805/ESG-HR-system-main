import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { errorMessage } from "@/api/errors";
import { cn } from "@/lib/utils";
import { type ChildMark, saveRollCall, useClasses, useRollCall } from "@/features/school/api";

const OPTIONS: { mark: ChildMark; label: string; active: string }[] = [
  { mark: "P", label: "Có mặt", active: "bg-green-600 text-white border-green-600" },
  { mark: "E", label: "Có phép", active: "bg-amber-500 text-white border-amber-500" },
  { mark: "A", label: "Không phép", active: "bg-red-600 text-white border-red-600" },
];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Entry = { mark: ChildMark | null; note: string };

/** Điểm danh cả lớp trên điện thoại: một chạm cho mỗi trẻ, "Tất cả có mặt", lưu một lần. */
export default function RollCallPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const classes = useClasses();
  const classId = searchParams.get("classId") ?? classes.data?.[0]?.id;
  const date = searchParams.get("date") ?? todayIso();
  const query = useRollCall(classId, date);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setEntries(Object.fromEntries(query.data.rows.map((r) => [r.childId, { mark: r.mark, note: r.note ?? "" }])));
    setDirty(false);
  }, [query.data]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const update = (childId: string, patch: Partial<Entry>) => {
    setEntries((prev) => ({ ...prev, [childId]: { ...prev[childId], ...patch } }));
    setDirty(true);
  };

  const counts = useMemo(() => {
    const values = Object.values(entries);
    return {
      P: values.filter((e) => e.mark === "P").length,
      E: values.filter((e) => e.mark === "E").length,
      A: values.filter((e) => e.mark === "A").length,
      none: values.filter((e) => !e.mark).length,
    };
  }, [entries]);

  const allPresent = () => {
    setEntries((prev) => Object.fromEntries(Object.entries(prev).map(([id, e]) => [id, e.mark ? e : { ...e, mark: "P" as ChildMark }])));
    setDirty(true);
  };

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      await saveRollCall({ classId, date, rows: Object.entries(entries).map(([childId, e]) => ({ childId, mark: e.mark, note: e.mark === "P" ? "" : e.note })) });
      await Promise.all(["roll-call", "today", "classes", "children"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      toast.success("Đã lưu điểm danh.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Điểm danh" description="Chạm để chọn trạng thái từng trẻ, rồi bấm Lưu." />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <Select value={classId ?? ""} onValueChange={(v) => setParam("classId", v)}>
          <SelectTrigger className="min-h-11" aria-label="Chọn lớp">
            <SelectValue placeholder="Chọn lớp" />
          </SelectTrigger>
          <SelectContent>
            {(classes.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="min-h-11" value={date} max={todayIso()} onChange={(e) => e.target.value && setParam("date", e.target.value)} aria-label="Ngày điểm danh" />
      </div>

      {classes.isLoading || query.isLoading ? (
        <PageSkeleton />
      ) : classes.isError || query.isError ? (
        <ErrorState error={classes.error ?? query.error} onRetry={() => (classes.isError ? classes.refetch() : query.refetch())} />
      ) : !query.data ? (
        <EmptyState icon={ClipboardCheck} title="Chưa được phân công lớp" />
      ) : !query.data.isSchoolDay ? (
        <EmptyState icon={ClipboardCheck} title="Ngày này trẻ nghỉ học" description="Chọn một ngày học (thứ Hai – thứ Sáu, trừ ngày lễ)." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge className="bg-green-600 hover:bg-green-600">Có mặt {counts.P}</Badge>
            <Badge className="bg-amber-500 hover:bg-amber-500">Có phép {counts.E}</Badge>
            <Badge variant="destructive">Không phép {counts.A}</Badge>
            {counts.none > 0 && <Badge variant="outline">Chưa điểm {counts.none}</Badge>}
            <Button variant="outline" className="ml-auto min-h-11" onClick={allPresent} disabled={counts.none === 0}>
              <CheckCheck className="w-4 h-4 mr-2" /> Tất cả có mặt
            </Button>
          </div>
          <ul className="space-y-2">
            {query.data.rows.map((row, index) => {
              const entry = entries[row.childId] ?? { mark: null, note: "" };
              return (
                <li key={row.childId} className={cn("rounded-xl border bg-card p-3", !entry.mark && "border-dashed")}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-sm text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.nickname}
                        {row.allergies && <span className="text-destructive"> · {row.allergies}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Điểm danh ${row.fullName}`}>
                    {OPTIONS.map((o) => (
                      <button
                        key={o.mark}
                        type="button"
                        role="radio"
                        aria-checked={entry.mark === o.mark}
                        onClick={() => update(row.childId, { mark: o.mark })}
                        className={cn(
                          "min-h-11 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          entry.mark === o.mark ? o.active : "bg-background hover:bg-muted",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {entry.mark && entry.mark !== "P" && (
                    <Input
                      className="mt-2 min-h-11"
                      placeholder="Ghi chú (lý do vắng)"
                      value={entry.note}
                      onChange={(e) => update(row.childId, { note: e.target.value })}
                      aria-label={`Ghi chú ${row.fullName}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur md:left-60">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <p className="flex-1 text-sm text-muted-foreground">{dirty ? "Có thay đổi chưa lưu" : `${query.data.className} · ${query.data.rows.length} trẻ`}</p>
              <Button className="min-h-11 min-w-32" onClick={save} disabled={!dirty || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Lưu điểm danh
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar, type FilterDef } from "@/components/common/FilterBar";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useCan } from "@/hooks/useCan";
import { useListParams } from "@/hooks/useListParams";
import { formatDate, formatDateTime } from "@/lib/format";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/features/staff/profile/fields";
import { todayIso } from "@/features/health/week";
import {
  HEALTH_LOG_FILTER_KEYS,
  HEALTH_LOG_TYPE,
  type HealthLog,
  type HealthLogType,
  deleteHealthLog,
  errorMessage,
  notifyParent,
  saveHealthLog,
  useClasses,
  useClassMeasurements,
  useHealthLogs,
} from "@/api";

const schema = z
  .object({
    classId: z.string(),
    childId: z.string().min(1, "Vui lòng chọn trẻ"),
    logDate: z.string().min(1, "Vui lòng chọn ngày").refine((v) => v <= todayIso(), "Không ghi sổ cho ngày trong tương lai"),
    type: z.enum(["FEVER", "MEDICINE", "INCIDENT", "OTHER"]),
    content: z.string().trim().min(1, "Vui lòng nhập nội dung").max(2000, "Nội dung tối đa 2000 ký tự"),
    temperatureC: z
      .string()
      .trim()
      .refine((v) => v === "" || (Number(v.replace(",", ".")) >= 34 && Number(v.replace(",", ".")) <= 43), "Nhiệt độ từ 34 đến 43 °C"),
    parentNotified: z.boolean(),
  })
  .refine((v) => v.type !== "FEVER" || v.temperatureC !== "", { path: ["temperatureC"], message: "Vui lòng nhập nhiệt độ" });
type LogForm = z.infer<typeof schema>;

const typeOptions = Object.entries(HEALTH_LOG_TYPE).map(([value, m]) => ({ value, label: m.label }));

/** Danh sách trẻ của lớp hôm nay để chọn khi ghi sổ (lấy từ bảng cân đo của lớp). */
function useRoster(classId: string) {
  const sheet = useClassMeasurements(classId || undefined, todayIso());
  return useMemo(() => (sheet.data?.rows ?? []).map((r) => ({ value: r.childId, label: r.fullName })), [sheet.data]);
}

/** Sổ theo dõi sức khỏe hằng ngày: sốt, dặn thuốc, sự cố nhỏ; đánh dấu đã báo phụ huynh. */
export default function HealthLogPage() {
  const queryClient = useQueryClient();
  const canEdit = useCan("manage", "health");
  const params = useListParams({ filterKeys: HEALTH_LOG_FILTER_KEYS });
  const query = useHealthLogs(params);
  const classes = useClasses();
  const [editing, setEditing] = useState<HealthLog | "new" | null>(null);
  const [removing, setRemoving] = useState<HealthLog | null>(null);
  const form = useForm<LogForm>({ resolver: zodResolver(schema) });
  const formClassId = form.watch("classId");
  const type = form.watch("type");
  const roster = useRoster(editing === "new" ? formClassId : "");
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ["health"] }), [queryClient]);

  const classOptions = useMemo(() => (classes.data ?? []).map((c) => ({ value: c.id, label: c.name })), [classes.data]);
  const filters = useMemo<FilterDef[]>(
    () => [
      { type: "dateRange", fromKey: "from", toKey: "to", label: "Ngày" },
      { type: "select", key: "classId", label: "Lớp", options: classOptions },
      { type: "select", key: "type", label: "Loại", options: typeOptions },
    ],
    [classOptions],
  );

  const open = useCallback(
    (item: HealthLog | "new") => {
      const l = item === "new" ? null : item;
      form.reset({
        classId: l?.classId ?? classOptions[0]?.value ?? "",
        childId: l?.childId ?? "",
        logDate: l?.logDate ?? todayIso(),
        type: l?.type ?? "FEVER",
        content: l?.content ?? "",
        temperatureC: l?.temperatureC != null ? String(l.temperatureC) : "",
        parentNotified: !!l?.parentNotifiedAt,
      });
      setEditing(item);
    },
    [form, classOptions],
  );

  const markNotified = useCallback(
    async (log: HealthLog) => {
      try {
        await notifyParent(log.id);
        toast.success("Đã ghi nhận báo phụ huynh.");
        await refresh();
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [refresh],
  );

  const notified = useCallback(
    (l: HealthLog) =>
      l.parentNotifiedAt ? (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <Check className="h-3 w-3" /> Đã báo PH {formatDateTime(l.parentNotifiedAt)}
      </span>
    ) : l.canEdit ? (
      <Button variant="outline" size="sm" className="min-h-11" onClick={() => markNotified(l)}>
        <BellRing className="w-4 h-4 mr-1" /> Đã báo phụ huynh
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">Chưa báo phụ huynh</span>
    ),
    [markNotified],
  );

  const columns = useMemo<ColumnDef<HealthLog>[]>(
    () => [
      { id: "logDate", header: "Ngày", cell: ({ row }) => formatDate(row.original.logDate) },
      {
        id: "child",
        header: "Trẻ",
        enableHiding: false,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.childName}</p>
            <p className="text-xs text-muted-foreground">{row.original.className ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "content",
        header: "Nội dung",
        cell: ({ row }) => (
          <div className="min-w-[14rem]">
            <div className="flex items-center gap-2">
              <StatusBadge status={row.original.type} labels={HEALTH_LOG_TYPE} />
              {row.original.temperatureC != null && <span className="text-sm font-medium text-destructive">{row.original.temperatureC} °C</span>}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm">{row.original.content}</p>
            {row.original.recordedByName && <p className="text-xs text-muted-foreground">Người ghi: {row.original.recordedByName}</p>}
          </div>
        ),
      },
      { id: "parent", header: "Phụ huynh", cell: ({ row }) => notified(row.original) },
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
    [open, notified],
  );

  return (
    <div>
      <PageHeader
        title="Sổ theo dõi sức khỏe"
        description="Ghi sốt, dặn thuốc, sự cố nhỏ trong ngày và đánh dấu đã báo phụ huynh."
        actions={
          canEdit && (
            <Button className="min-h-11" onClick={() => open("new")}>
              <Plus className="w-4 h-4 mr-2" /> Ghi sổ
            </Button>
          )
        }
      />
      <FilterBar params={params} searchPlaceholder="Tìm theo tên trẻ, nội dung" filters={filters} />
      <DataTable
        tableId="health-logs"
        columns={columns}
        query={query}
        params={params}
        getRowId={(r) => r.id}
        mobileCard={(r) => (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.childName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.logDate)} · {r.className ?? "—"}
                </p>
              </div>
              <StatusBadge status={r.type} labels={HEALTH_LOG_TYPE} />
              {r.canEdit && (
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Sửa" onClick={() => open(r)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-sm">
              {r.temperatureC != null && <b className="text-destructive">{r.temperatureC} °C · </b>}
              {r.content}
            </p>
            {notified(r)}
          </div>
        )}
        emptyTitle="Chưa có ghi chép"
        emptyDescription={canEdit ? "Bấm “Ghi sổ” khi trẻ sốt, cần uống thuốc hoặc gặp sự cố." : "Thử đổi bộ lọc."}
      />

      <FormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Ghi sổ theo dõi" : "Sửa ghi chép"}
        description={editing && editing !== "new" ? `${editing.childName} · ${editing.className ?? ""}` : undefined}
        form={form}
        onSubmit={async (v) => {
          await saveHealthLog(editing === "new" || !editing ? null : editing.id, {
            childId: v.childId,
            logDate: v.logDate,
            type: v.type as HealthLogType,
            content: v.content,
            temperatureC: v.temperatureC === "" ? undefined : Number(v.temperatureC.replace(",", ".")),
            parentNotified: v.parentNotified,
          });
          await refresh();
        }}
      >
        {editing === "new" && (
          <>
            <SelectField form={form} name="classId" label="Lớp" required options={classOptions} />
            <SelectField form={form} name="childId" label="Trẻ" required options={roster} placeholder={formClassId ? "Chọn trẻ" : "Chọn lớp trước"} />
          </>
        )}
        <TextField form={form} name="logDate" label="Ngày" type="date" required />
        <SelectField form={form} name="type" label="Loại" required options={typeOptions} />
        {type === "FEVER" && <TextField form={form} name="temperatureC" label="Nhiệt độ (°C)" inputMode="decimal" required />}
        <TextAreaField form={form} name="content" label="Nội dung" required rows={4} />
        <CheckboxField form={form} name="parentNotified" label="Đã báo phụ huynh" description="Ghi lại thời điểm và người báo." />
      </FormSheet>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa ghi chép này?"
        description={removing ? `${removing.childName} · ${formatDate(removing.logDate)}` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteHealthLog(removing!.id);
          toast.success("Đã xóa ghi chép.");
          await refresh();
        }}
      />
    </div>
  );
}

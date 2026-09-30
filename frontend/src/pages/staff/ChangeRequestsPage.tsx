import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api, unwrap } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { FormSheet } from "@/components/common/FormSheet";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { formatDateTime } from "@/lib/format";
import { useAddressData } from "@/features/staff/AddressFields";
import {
  CHANGE_KIND_LABELS,
  CHANGE_REQUEST_STATUS,
  type ChangeRequestDto,
  describeChanges,
  REVIEW_FILTER_KEYS,
  REVIEW_STATUSES,
  useChangeRequests,
} from "@/features/staff/changeRequests";
import { TextAreaField } from "@/features/staff/profile/fields";

const STATUS_TABS: Record<(typeof REVIEW_STATUSES)[number], string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  ALL: "Tất cả",
};

const rejectSchema = z.object({ note: z.string().trim().min(1, "Vui lòng nhập lý do từ chối").max(500) });
type RejectValues = z.infer<typeof rejectSchema>;

function RejectSheet({ request, onClose }: { request: ChangeRequestDto | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<RejectValues>({ resolver: zodResolver(rejectSchema), defaultValues: { note: "" } });
  useEffect(() => {
    if (request) form.reset({ note: "" });
  }, [request, form]);
  return (
    <FormSheet
      open={request !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Từ chối đề xuất"
      description={request ? `${request.staffName} – ${CHANGE_KIND_LABELS[request.kind]}` : undefined}
      form={form}
      submitLabel="Từ chối"
      successMessage="Đã từ chối đề xuất."
      onSubmit={async ({ note }) => {
        unwrap(await api.POST("/api/v1/staff/change-requests/{id}/reject", { params: { path: { id: request!.id } }, body: { note } }));
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <TextAreaField form={form} name="note" label="Lý do" required />
    </FormSheet>
  );
}

/** Duyệt đề xuất cập nhật hồ sơ do nhân viên gửi (chỉ hiện đề xuất người xem được duyệt). */
export default function ChangeRequestsPage() {
  const params = useListParams({ filterKeys: REVIEW_FILTER_KEYS });
  const query = useChangeRequests(params);
  const queryClient = useQueryClient();
  const provinces = useAddressData();
  const [approving, setApproving] = useState<ChangeRequestDto | null>(null);
  const [rejecting, setRejecting] = useState<ChangeRequestDto | null>(null);
  const status = REVIEW_STATUSES.includes(params.filters.status as never) ? params.filters.status : "PENDING";

  const columns = useMemo<ColumnDef<ChangeRequestDto>[]>(
    () => [
      {
        id: "staff",
        header: "Nhân viên",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-[10rem]">
            <Link to={`/nhan-su/${row.original.staffId}`} className="font-medium hover:underline">
              {row.original.staffName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {row.original.staffCode} · {row.original.schoolName}
            </p>
          </div>
        ),
      },
      { id: "kind", header: "Loại", cell: ({ row }) => CHANGE_KIND_LABELS[row.original.kind] },
      {
        id: "changes",
        header: "Thay đổi",
        enableHiding: false,
        cell: ({ row }) => (
          <ul className="text-sm space-y-0.5 min-w-[16rem]">
            {describeChanges(row.original.changes, provinces).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ),
      },
      { id: "createdAt", header: "Ngày gửi", cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span> },
      {
        id: "status",
        header: "Trạng thái",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <StatusBadge status={row.original.status} labels={CHANGE_REQUEST_STATUS} />
            {row.original.reviewNote && <p className="text-xs text-muted-foreground">{row.original.reviewNote}</p>}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.canReview && (
            <div className="flex gap-1">
              <Button size="sm" className="min-h-11" onClick={() => setApproving(row.original)} aria-label={`Duyệt đề xuất của ${row.original.staffName}`}>
                <Check className="w-4 h-4 mr-1" /> Duyệt
              </Button>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => setRejecting(row.original)} aria-label={`Từ chối đề xuất của ${row.original.staffName}`}>
                <X className="w-4 h-4 mr-1" /> Từ chối
              </Button>
            </div>
          ),
      },
    ],
    [provinces],
  );

  return (
    <div>
      <PageHeader
        title="Đề xuất cập nhật hồ sơ"
        description="Nhân viên tự đề xuất đổi số điện thoại, địa chỉ hoặc tài khoản ngân hàng; duyệt thì thay đổi được ghi vào hồ sơ."
        breadcrumbs={[{ label: "Nhân sự", to: "/nhan-su" }, { label: "Đề xuất cập nhật hồ sơ" }]}
      />
      <ToggleGroup
        type="single"
        value={status}
        onValueChange={(v) => v && params.setFilter("status", v === "PENDING" ? undefined : v)}
        aria-label="Trạng thái"
        className="border rounded-md p-0.5 mb-4 w-fit flex-wrap"
      >
        {REVIEW_STATUSES.map((s) => (
          <ToggleGroupItem key={s} value={s} className="min-h-10 px-3">
            {STATUS_TABS[s]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <DataTable
        tableId="change-requests"
        columns={columns}
        query={query}
        params={params}
        getRowId={(row) => row.id}
        emptyTitle={status === "PENDING" ? "Không có đề xuất nào chờ duyệt" : "Không có đề xuất"}
        emptyDescription="Chỉ hiện đề xuất bạn có quyền duyệt: liên hệ (hiệu trưởng, văn phòng điều hành), ngân hàng (văn phòng điều hành, kế toán)."
      />
      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(open) => !open && setApproving(null)}
        title="Duyệt đề xuất?"
        description={
          approving && (
            <span className="block space-y-1">
              <span className="block">
                {approving.staffName} – {CHANGE_KIND_LABELS[approving.kind]}. Thay đổi sẽ được ghi vào hồ sơ:
              </span>
              {describeChanges(approving.changes, provinces).map((line) => (
                <span key={line} className="block">
                  • {line}
                </span>
              ))}
            </span>
          )
        }
        confirmText="Duyệt"
        onConfirm={async () => {
          unwrap(await api.POST("/api/v1/staff/change-requests/{id}/approve", { params: { path: { id: approving!.id } }, body: {} }));
          toast.success("Đã duyệt, hồ sơ đã được cập nhật.");
          await queryClient.invalidateQueries({ queryKey: ["staff"] });
        }}
      />
      <RejectSheet request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}

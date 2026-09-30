import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { z } from "zod";
import { deleteContract, saveContract } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormSheet } from "@/components/common/FormSheet";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/States";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type ContractDto,
  type FileRef,
  type StaffDetail,
  useDocumentTypes,
  useStaffContracts,
  useStaffDocuments,
} from "@/api";
import { daysUntil, todayIso, WARNING_DAYS } from "../dates";
import { CONTRACT_TYPE_LABELS, options } from "../labels";
import { AttachmentField } from "./AttachmentField";
import { DocumentSheet } from "./DocumentSheet";
import { FileLink, FilePreviewDialog } from "./FilePreviewDialog";

const schema = z
  .object({
    contractType: z.enum(["PROBATION", "DEFINITE", "INDEFINITE", "SERVICE"], { required_error: "Vui lòng chọn loại hợp đồng" }),
    contractNo: z.string().trim().max(50).default(""),
    signedOn: z.string().default(""),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().default(""),
    file: z.custom<FileRef | null>().default(null),
    note: z.string().trim().max(500).default(""),
  })
  .refine((v) => !v.endDate || v.endDate > v.startDate, { path: ["endDate"], message: "Ngày kết thúc phải sau ngày bắt đầu" });

type Values = z.infer<typeof schema>;

const toValues = (c?: ContractDto): Values => ({
  contractType: c?.contractType ?? (undefined as unknown as Values["contractType"]),
  contractNo: c?.contractNo ?? "",
  signedOn: c?.signedOn ?? "",
  startDate: c?.startDate ?? "",
  endDate: c?.endDate ?? "",
  file: c?.file ?? null,
  note: c?.note ?? "",
});

/** Hợp đồng đang hiệu lực hôm nay. */
function isCurrent(c: ContractDto, today: string) {
  return c.startDate <= today && (!c.endDate || c.endDate >= today);
}

function ContractSheet({
  staff,
  contract,
  open,
  onOpenChange,
}: {
  staff: StaffDetail;
  contract?: ContractDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(contract) });
  useEffect(() => {
    if (open) form.reset(toValues(contract));
  }, [open, contract, form]);

  const text = (name: "contractNo" | "signedOn" | "startDate" | "endDate", label: string, type = "text", required = false) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </FormLabel>
          <FormControl>
            <Input type={type} className="min-h-11" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={contract ? "Sửa hợp đồng" : "Thêm hợp đồng"}
      form={form}
      successMessage={contract ? "Đã lưu hợp đồng." : "Đã thêm hợp đồng."}
      onSubmit={async (v) => {
        const body = {
          contractType: v.contractType,
          contractNo: v.contractNo || undefined,
          signedOn: v.signedOn || undefined,
          startDate: v.startDate,
          endDate: v.endDate || undefined,
          fileId: v.file?.id,
          note: v.note || undefined,
        };
        if (contract) {
          await saveContract(staff.id, contract!.id, body);
        } else {
          await saveContract(staff.id, null, body);
        }
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
      }}
    >
      <FormField
        control={form.control}
        name="contractType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Loại hợp đồng<span className="text-destructive ml-0.5">*</span>
            </FormLabel>
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-11" aria-label="Loại hợp đồng">
                  <SelectValue placeholder="Chọn loại hợp đồng" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options(CONTRACT_TYPE_LABELS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {text("contractNo", "Số hợp đồng")}
        {text("signedOn", "Ngày ký", "date")}
        {text("startDate", "Ngày bắt đầu", "date", true)}
        {text("endDate", "Ngày kết thúc", "date")}
      </div>
      <FormField
        control={form.control}
        name="file"
        render={({ field }) => (
          <FormItem>
            <AttachmentField
              label="Bản hợp đồng (PDF/ảnh)"
              staffId={staff.id}
              schoolId={staff.schoolId}
              value={field.value}
              onChange={field.onChange}
              initial={contract?.file}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ghi chú</FormLabel>
            <FormControl>
              <Textarea rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormSheet>
  );
}

/** Tab "Hợp đồng & quyết định": các hợp đồng (mới nhất trước) và quyết định hiện hành. */
export function ContractsTab({ staff }: { staff: StaffDetail }) {
  const queryClient = useQueryClient();
  const contracts = useStaffContracts(staff.id);
  const documents = useStaffDocuments(staff.id);
  const documentTypes = useDocumentTypes();
  const [editing, setEditing] = useState<{ contract?: ContractDto } | null>(null);
  const [deleting, setDeleting] = useState<ContractDto | null>(null);
  const [preview, setPreview] = useState<FileRef | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const canEdit = staff.permissions.canEdit && staff.status === "ACTIVE";
  const today = todayIso();

  const decisionTypes = useMemo(() => (documentTypes.data ?? []).filter((t) => t.category === "DECISION"), [documentTypes.data]);
  const decisions = (documents.data ?? []).filter((d) => d.type.category === "DECISION" && d.current);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Hợp đồng lao động</CardTitle>
          {canEdit && (
            <Button className="min-h-11" onClick={() => setEditing({})}>
              <Plus className="w-4 h-4 mr-2" /> Thêm hợp đồng
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {contracts.isLoading ? (
            <TableSkeleton rows={2} columns={5} />
          ) : contracts.isError ? (
            <ErrorState error={contracts.error} onRetry={() => contracts.refetch()} />
          ) : !contracts.data?.length ? (
            <EmptyState title="Chưa có hợp đồng" description={canEdit ? "Bấm “Thêm hợp đồng” để tải bản hợp đồng lên." : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Số HĐ</TableHead>
                    <TableHead>Hiệu lực</TableHead>
                    <TableHead>Tệp</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    {canEdit && <TableHead className="w-12"><span className="sr-only">Thao tác</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.data.map((c) => {
                    const days = c.endDate ? daysUntil(c.endDate) : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{CONTRACT_TYPE_LABELS[c.contractType]}</span>
                            {isCurrent(c, today) && <StatusBadge status="CURRENT" labels={{ CURRENT: { label: "Đang hiệu lực", tone: "success" } }} />}
                          </div>
                        </TableCell>
                        <TableCell>{c.contractNo ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(c.startDate)} –{" "}
                          {c.endDate ? (
                            <span className={cn(days !== null && days >= 0 && days < WARNING_DAYS && "text-destructive font-medium")}>
                              {formatDate(c.endDate)}
                            </span>
                          ) : (
                            "không thời hạn"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[14rem]">
                          {c.file ? <FileLink staffId={staff.id} file={c.file} onPreview={setPreview} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate" title={c.note ?? undefined}>
                          {c.note ?? ""}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Thao tác hợp đồng">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setEditing({ contract: c })}>Sửa</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(c)}>
                                  Xóa
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Quyết định</CardTitle>
          {canEdit && (
            <Button variant="outline" className="min-h-11" onClick={() => setDecisionOpen(true)} disabled={decisionTypes.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Thêm quyết định
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {documents.isLoading ? (
            <TableSkeleton rows={2} columns={3} />
          ) : decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có quyết định nào (tiếp nhận, bổ nhiệm, điều chuyển…).</p>
          ) : (
            <ul className="divide-y">
              {decisions.map((d) => (
                <li key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-x-4">
                  <div className="min-w-0">
                    <p className="font-medium">{d.type.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.issuedDate ? `Ngày ${formatDate(d.issuedDate)}` : `Tải lên ${formatDate(d.uploadedAt)}`}
                    </p>
                  </div>
                  <div className="max-w-[16rem]">
                    <FileLink staffId={staff.id} file={d.file} onPreview={setPreview} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ContractSheet
        staff={staff}
        contract={editing?.contract}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DocumentSheet staff={staff} open={decisionOpen} onOpenChange={setDecisionOpen} types={decisionTypes} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa hợp đồng?"
        description={deleting ? `${CONTRACT_TYPE_LABELS[deleting.contractType]}${deleting.contractNo ? ` số ${deleting.contractNo}` : ""} sẽ bị xóa khỏi hồ sơ.` : undefined}
        confirmText="Xóa"
        variant="destructive"
        onConfirm={async () => {
          await deleteContract(staff.id, deleting!.id);
          await queryClient.invalidateQueries({ queryKey: ["staff"] });
        }}
      />
      <FilePreviewDialog staffId={staff.id} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

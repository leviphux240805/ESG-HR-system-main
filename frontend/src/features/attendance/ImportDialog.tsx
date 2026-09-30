import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { importPunches } from "@/api";
import { errorMessage } from "@/api";
import { uploadFile } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ImportResult, MonthSheet } from "@/api";
import { monthLabel } from "./codes";
import type { MachinePunchRow } from "./machineExcel";

interface Parsed {
  file: File;
  rows: MachinePunchRow[];
  codes: { code: string; name: string; rows: number; known: boolean }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  sheet: MonthSheet;
  /** Sau khi import xong: mở màn hình xử lý sai lệch. */
  onReview: () => void;
}

/**
 * Import file Excel máy chấm công: đọc file ở trình duyệt (thuật toán của ESG HR), xem trước mã chưa gán cho nhân
 * viên, lưu file gốc làm chứng từ rồi gửi dữ liệu thô; backend khớp mã chấm công và đối soát.
 */
export function ImportDialog({ open, onOpenChange, month, sheet, onReview }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState<"parse" | "upload" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setParsed(null);
    setResult(null);
    setBusy(null);
  };

  const readFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error("Vui lòng chọn file Excel (.xlsx hoặc .xls).");
      return;
    }
    setBusy("parse");
    setResult(null);
    try {
      const { parseMachineWorkbook } = await import("./machineExcel");
      const [y, m] = month.split("-").map(Number);
      const rows = parseMachineWorkbook(await file.arrayBuffer(), y, m - 1);
      if (rows.length === 0) {
        toast.error("Không đọc được dòng chấm công nào. Kiểm tra lại file máy chấm công.");
        setParsed(null);
        return;
      }
      const known = new Set(sheet.staff.map((s) => s.machineCode?.toUpperCase()).filter(Boolean));
      const byCode = new Map<string, { code: string; name: string; rows: number; known: boolean }>();
      for (const row of rows) {
        const key = row.machineCode.toUpperCase();
        const entry = byCode.get(key) ?? { code: row.machineCode, name: row.name, rows: 0, known: known.has(key) };
        entry.rows++;
        byCode.set(key, entry);
      }
      setParsed({ file, rows, codes: [...byCode.values()].sort((a, b) => Number(a.known) - Number(b.known)) });
    } catch (error) {
      toast.error("Không đọc được file: " + errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!parsed) return;
    setBusy("upload");
    try {
      const stored = await uploadFile(parsed.file, sheet.schoolId);
      const response = await importPunches({
        month,
        fileId: stored.id,
        rows: parsed.rows.map((r) => ({
          machineCode: r.machineCode,
          name: r.name,
          workDate: r.workDate,
          checkIn: r.checkIn ?? undefined,
          checkOut: r.checkOut ?? undefined,
        })),
      });
      setResult(response);
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(`Đã import và đối soát ${response.matchedRows} dòng chấm công.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const unknown = parsed?.codes.filter((c) => !c.known) ?? [];
  const dates = parsed ? parsed.rows.map((r) => r.workDate).sort() : [];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) { onOpenChange(next); if (!next) reset(); } }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import máy chấm công</DialogTitle>
          <DialogDescription>{monthLabel(month)} – file Excel xuất từ máy chấm công của cơ sở.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm" data-testid="import-result">
            <p className="flex items-center gap-2 font-medium text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Đã đối soát {result.matchedRows}/{result.rowCount} dòng của {result.staffCount} nhân viên
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Tự điền {result.autoFilled} ngày (đủ giờ vào/ra → X, máy ghi vắng → K)</li>
              <li className={cn(result.discrepancyCount > 0 && "text-amber-700 font-medium")}>
                {result.discrepancyCount} ngày sai lệch cần xác nhận
              </li>
              {result.unmatched.length > 0 && (
                <li className="text-amber-700">
                  Bỏ qua {result.unmatched.reduce((n, u) => n + u.rows, 0)} dòng của mã chưa gán:{" "}
                  {result.unmatched.map((u) => `${u.machineCode}${u.name ? ` (${u.name})` : ""}`).join(", ")}
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]); }}
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                dragging ? "border-primary bg-primary/10" : parsed ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              )}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} data-testid="machine-file" />
              {parsed ? (
                <p className="flex items-center justify-center gap-2 font-medium">
                  <FileSpreadsheet className="w-6 h-6 text-primary" /> {parsed.file.name}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Kéo thả file vào đây hoặc</p>
              )}
              <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => inputRef.current?.click()} disabled={!!busy}>
                {busy === "parse" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {parsed ? "Chọn file khác" : "Chọn file Excel"}
              </Button>
            </div>

            {parsed && (
              <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm" data-testid="import-preview">
                <p>
                  Đọc được <b>{parsed.rows.length}</b> dòng của <b>{parsed.codes.length}</b> mã chấm công, từ {dates[0]} đến{" "}
                  {dates[dates.length - 1]}.
                </p>
                {unknown.length > 0 && (
                  <div className="flex gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p>
                        {unknown.length} mã chưa gán cho nhân viên nào trong cơ sở (sẽ bỏ qua):{" "}
                        {unknown.map((u) => `${u.code} – ${u.name}`).join("; ")}.
                      </p>
                      <p>
                        Gán "Mã chấm công" ở{" "}
                        <Link to="/nhan-su" className="underline">
                          hồ sơ nhân viên
                        </Link>{" "}
                        rồi import lại.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <>
              <Button variant="outline" className="min-h-11" onClick={() => { onOpenChange(false); reset(); }}>
                Đóng
              </Button>
              {result.discrepancyCount > 0 && (
                <Button className="min-h-11" onClick={() => { onOpenChange(false); reset(); onReview(); }}>
                  Xử lý sai lệch
                </Button>
              )}
            </>
          ) : (
            <Button className="min-h-11" onClick={submit} disabled={!parsed || !!busy}>
              {busy === "upload" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {busy === "upload" ? "Đang đối soát..." : "Import và đối soát"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

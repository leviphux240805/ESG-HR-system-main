import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  reconcileAttendance,
  saveReconciliationResults,
} from "@/lib/attendanceReconciliation";

interface ParsedAttendance {
  employee_code: string;
  employee_name: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
}

interface AttendanceUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: number;
  selectedYear: number;
  onUploadComplete: () => void;
}

export function AttendanceUploadModal({
  open,
  onOpenChange,
  selectedMonth,
  selectedYear,
  onUploadComplete,
}: AttendanceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedAttendance[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);
      setParseError(null);
      setParsedData([]);
      setIsParsing(true);

      try {
        // Read and parse Excel file
        const data = await parseExcelFile(selectedFile);
        setParsedData(data);
        toast.success(`Đã đọc ${data.length} bản ghi chấm công`);
      } catch (err: any) {
        setParseError(err.message);
        toast.error("Lỗi đọc file: " + err.message);
      } finally {
        setIsParsing(false);
      }
    },
    [selectedMonth, selectedYear],
  );

  // Helper function to process file (used by both click and drag-drop)
  const processFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setParsedData([]);
    setIsParsing(true);

    try {
      const data = await parseExcelFile(selectedFile);
      setParsedData(data);
      toast.success(`Đã đọc ${data.length} bản ghi chấm công`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setParseError(errorMsg);
      toast.error("Lỗi đọc file: " + errorMsg);
    } finally {
      setIsParsing(false);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        // Check if file is Excel
        if (
          droppedFile.name.endsWith(".xlsx") ||
          droppedFile.name.endsWith(".xls")
        ) {
          processFile(droppedFile);
        } else {
          toast.error("Vui lòng chọn file Excel (.xlsx hoặc .xls)");
        }
      }
    },
    [processFile],
  );

  const parseExcelFile = async (file: File): Promise<ParsedAttendance[]> => {
    // Dynamic import xlsx library
    const XLSX = await import("xlsx");

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Get range
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
          const records: ParsedAttendance[] = [];

          // Debug: Look for the header row containing day numbers (1, 2, 3...)
          let headerRow = -1;
          for (let r = range.s.r; r <= 20; r++) {
            // Scan first 20 rows
            let matchCount = 0;
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
              if (
                cell &&
                typeof cell.v === "number" &&
                cell.v > 0 &&
                cell.v <= 31
              ) {
                matchCount++;
              }
            }
            if (matchCount > 10) {
              // Found a row with many day numbers
              headerRow = r;
              break;
            }
          }

          if (headerRow === -1) {
            // Fallback to row 3 (index) if detection fails
            headerRow = 3;
          }

          // Parse day headers
          const dayColumns: { [day: number]: number } = {};
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: headerRow, c })];
            if (cell && !isNaN(parseInt(cell.v))) {
              dayColumns[parseInt(cell.v)] = c;
            }
          }

          const dataStartRow = headerRow + 2;

          // Process employee rows
          for (let r = dataStartRow; r <= range.e.r; r++) {
            const codeCell = worksheet[XLSX.utils.encode_cell({ r, c: 2 })]; // Column C

            if (!codeCell || !codeCell.v) continue;

            const employeeCode = String(codeCell.v).trim();
            const nameCell = worksheet[XLSX.utils.encode_cell({ r, c: 3 })];
            const employeeName = nameCell
              ? String(nameCell.v).trim()
              : "Unknown";

            const checkOutRow = r + 1;

            for (const [day, col] of Object.entries(dayColumns)) {
              const dayNum = parseInt(day);
              // Construct Date using provided year/month
              // Use local time construction
              const workDate = new Date(selectedYear, selectedMonth, dayNum);

              // Skip if invalid date (e.g. Feb 30) or if month rolled over
              if (workDate.getMonth() !== selectedMonth) continue;

              // Format date as YYYY-MM-DD using local time
              const dateStr = `${workDate.getFullYear()}-${String(workDate.getMonth() + 1).padStart(2, "0")}-${String(workDate.getDate()).padStart(2, "0")}`;

              const checkInCell =
                worksheet[XLSX.utils.encode_cell({ r, c: col })];
              const checkOutCell =
                worksheet[XLSX.utils.encode_cell({ r: checkOutRow, c: col })];

              let checkIn: string | null = null;
              let checkOut: string | null = null;

              if (checkInCell && checkInCell.v !== "") {
                checkIn = formatTimeValue(checkInCell.v);
              }

              if (checkOutCell && checkOutCell.v !== "") {
                checkOut = formatTimeValue(checkOutCell.v);
              }

              // Handle merged "V" (Absent) case -> Converted to "K"
              // If CheckIn is "K" and CheckOut is empty/null, likely a merged cell.
              if (checkIn === "K" && !checkOut) {
                checkOut = "K";
              }

              if (checkIn || checkOut) {
                records.push({
                  employee_code: employeeCode,
                  employee_name: employeeName,
                  work_date: dateStr,
                  check_in: checkIn,
                  check_out: checkOut,
                });
              }
            }
          }

          resolve(records);
        } catch (err: any) {
          reject(
            new Error("Không thể đọc cấu trúc file Excel: " + err.message),
          );
        }
      };

      reader.onerror = () => reject(new Error("Lỗi đọc file"));
      reader.readAsBinaryString(file);
    });
  };

  const formatTimeValue = (value: any): string | null => {
    if (!value) return null;
    if (value === "V") return "K"; // Map "V" to "K"

    if (typeof value === "number") {
      // Excel time fraction: 0.5 = 12:00
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
    if (typeof value === "string") {
      // If it contains just time "HH:mm"
      if (value.includes(":") || !isNaN(parseInt(value))) return value;
      // If it's "V", handled above. Other text? return as is.
      return value;
    }
    return String(value);
  };

  const [employees, setEmployees] = useState<
    { id: string; employeeID: string; name?: string }[]
  >([]);
  const [newEmployeesAdded, setNewEmployeesAdded] = useState<string[]>([]);
  const [missingCheckOutCount, setMissingCheckOutCount] = useState(0);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, employeeID, name");
      if (data) {
        setEmployees(data);
      }
    };
    fetchEmployees();
  }, []);

  /**
   * Find or create employees based on parsed attendance data.
   * Returns updated employee list with all employees (existing + newly created).
   */
  const findOrCreateEmployees = async (
    parsedRecords: ParsedAttendance[],
  ): Promise<{ id: string; employeeID: string; name?: string }[]> => {
    // Extract unique employee codes and names from parsed data
    const uniqueEmployees = new Map<string, string>();
    for (const record of parsedRecords) {
      const code = record.employee_code?.trim();
      if (code && !uniqueEmployees.has(code.toLowerCase())) {
        uniqueEmployees.set(code.toLowerCase(), record.employee_name || code);
      }
    }

    // Find which employees are missing from DB
    const existingCodes = new Set(
      employees.map((e) => e.employeeID?.toLowerCase()),
    );
    const missingEmployees: { code: string; name: string }[] = [];

    for (const [code, name] of uniqueEmployees) {
      if (!existingCodes.has(code)) {
        missingEmployees.push({ code, name });
      }
    }

    // If no missing employees, return current list
    if (missingEmployees.length === 0) {
      return employees;
    }

    // Insert missing employees into DB (only required fields)
    const newEmployeeRecords = missingEmployees.map((emp) => ({
      employeeID: emp.code.toUpperCase(), // Standardize to uppercase
      name: emp.name,
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("employees")
      .insert(newEmployeeRecords)
      .select("id, employeeID, name");

    if (insertError) {
      console.error("Error inserting new employees:", insertError);
      throw new Error(`Không thể thêm nhân viên mới: ${insertError.message}`);
    }

    // Track newly added employees for notification
    const addedNames = insertedData?.map((e) => e.name || e.employeeID) || [];
    setNewEmployeesAdded(addedNames);

    // Merge and return updated list
    const updatedList = [...employees, ...(insertedData || [])];
    setEmployees(updatedList);

    return updatedList;
  };

  const handleUpload = async () => {
    if (!file || parsedData.length === 0) return;

    setIsUploading(true);
    setNewEmployeesAdded([]);
    setMissingCheckOutCount(0);

    try {
      // Step 1: Find or create employees first
      let currentEmployees = employees;
      if (employees.length === 0) {
        // Try fetching again if empty
        const { data } = await supabase
          .from("employees")
          .select("id, employeeID, name");
        if (data && data.length > 0) {
          setEmployees(data);
          currentEmployees = data;
        }
      }

      // Auto-add missing employees
      currentEmployees = await findOrCreateEmployees(parsedData);

      // Notify if new employees were added
      if (newEmployeesAdded.length > 0) {
        toast.info(
          `Đã tự động thêm ${newEmployeesAdded.length} nhân viên mới: ${newEmployeesAdded.slice(0, 3).join(", ")}${newEmployeesAdded.length > 3 ? "..." : ""}`,
          { duration: 8000 },
        );
      }

      // Step 2: Upload file to storage
      const fileName = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, "0")}_${Date.now()}.xlsx`;
      const { error: uploadError } = await supabase.storage
        .from("monthly_attendance")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Generate a batch ID for this upload
      const batchId = crypto.randomUUID();

      // Step 3: Prepare data with employee_id mapping and track missing check-outs
      let missingCheckOutRecords = 0;
      const recordsToInsert = parsedData.map((record) => {
        // Find employee by ID (case insensitive, trimmed)
        const employee = currentEmployees.find(
          (e) =>
            e.employeeID?.trim().toLowerCase() ===
            record.employee_code?.trim().toLowerCase(),
        );

        if (!employee) {
          // This should not happen after findOrCreateEmployees, but log just in case
          console.warn(
            `Could not find employee for code: ${record.employee_code}`,
          );
        }

        // Track records with check_in but no check_out
        if (
          record.check_in &&
          record.check_in !== "K" &&
          record.check_in !== "V" &&
          !record.check_out
        ) {
          missingCheckOutRecords++;
        }

        return {
          employee_id: employee?.id || null,
          employee_code: record.employee_code,
          work_date: record.work_date,
          check_in: record.check_in,
          check_out: record.check_out,
          import_batch_id: batchId,
        };
      });

      setMissingCheckOutCount(missingCheckOutRecords);

      // Show warning about missing check-outs
      if (missingCheckOutRecords > 0) {
        toast.warning(
          `⚠️ Phát hiện ${missingCheckOutRecords} bản ghi có giờ vào nhưng thiếu giờ về. Vui lòng kiểm tra!`,
          { duration: 10000 },
        );
      }

      // Step 4: Insert parsed data to attendance_raw_machine
      const { error: insertError } = await supabase
        .from("attendance_raw_machine")
        .upsert(recordsToInsert, { onConflict: "employee_code,work_date" });

      if (insertError) throw insertError;

      toast.success("Đã upload dữ liệu thô. Đang chạy đối soát...");

      // Run reconciliation and WAIT for it to complete
      const results = await reconcileAttendance(selectedYear, selectedMonth);

      // Count discrepancies
      const checkOutIssues = results.filter((r) =>
        r.discrepancy_reason?.includes("thiếu giờ về"),
      ).length;

      // Save reconciliation results to DB
      await saveReconciliationResults(results);

      // Show completion message
      let message = "Đối soát hoàn tất!";
      if (checkOutIssues > 0) {
        message += ` ⚠️ ${checkOutIssues} bản ghi thiếu giờ về cần xác nhận.`;
      }
      toast.success(message, { duration: 5000 });

      // NOW refetch to update UI with discrepancy data
      onUploadComplete();
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error("Lỗi upload: " + err.message);
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setParseError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetState();
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Upload dữ liệu máy chấm công
          </DialogTitle>
          <DialogDescription>
            Tháng {selectedMonth + 1}/{selectedYear} - File Excel từ máy chấm
            công
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Input */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/10"
                : file
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
            )}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
              disabled={isParsing || isUploading}
            />
            <label htmlFor="excel-upload" className="cursor-pointer">
              {isDragging ? (
                <div>
                  <Upload className="w-10 h-10 mx-auto text-primary mb-2" />
                  <p className="text-sm text-primary font-medium">
                    Thả file tại đây!
                  </p>
                </div>
              ) : file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Kéo thả hoặc click để chọn file Excel
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Parsing Status */}
          {isParsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang đọc file...
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="font-medium text-sm">
                  Đã đọc {parsedData.length} bản ghi
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>
                  • Số nhân viên:{" "}
                  {new Set(parsedData.map((r) => r.employee_code)).size}
                </p>
                <p>
                  • Từ ngày: {parsedData[0]?.work_date} đến{" "}
                  {parsedData[parsedData.length - 1]?.work_date}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Hủy
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || parsedData.length === 0 || isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload & Đối soát
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

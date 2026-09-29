import { useState, useEffect, useRef } from "react";
import { Eye, Upload, Download, Trash2, Plus, FileText, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Employee } from "@/types";
import { toast } from "sonner";
import { getSignedDocumentUrl } from "@/lib/fileUploader";

interface DocumentItem {
  id: string;
  filePath: string;
  fileName: string;
  note: string | null;
  createdAt: string;
  signedUrl?: string;
}

interface MultiDocumentUploadFieldProps {
  employee: Employee | null;
  docTypeCode: string;
  label: string;
  accept?: string;
  required?: boolean;
}

const sanitizeFileName = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .toLowerCase();
};

async function getDocumentTypeIdByCode(code: string) {
  const { data, error } = await supabase
    .from("document_types")
    .select("id")
    .eq("code", code)
    .single();

  if (error || !data) {
    console.error(`Error fetching document type ID for code ${code}:`, error);
    return null;
  }
  return data.id;
}

export function MultiDocumentUploadField({
  employee,
  docTypeCode,
  label,
  accept = ".pdf,image/*",
  required = false,
}: MultiDocumentUploadFieldProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (employee?.id) {
      loadDocuments();
    } else {
      setDocuments([]);
    }
  }, [employee?.id, docTypeCode]);

  const loadDocuments = async () => {
    if (!employee?.id) return;

    setLoading(true);
    try {
      const docTypeId = await getDocumentTypeIdByCode(docTypeCode);
      if (!docTypeId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("employee_documents")
        .select("id, file_paths, note, created_at")
        .eq("employee_id", employee.id)
        .eq("document_type_id", docTypeId);

      if (error) {
        console.error("Error loading documents:", error);
        setLoading(false);
        return;
      }

      // Flatten all file paths from all document records
      const docs: DocumentItem[] = [];
      for (const record of data || []) {
        const paths = record.file_paths || [];
        for (const path of paths) {
          const fileName = path.split("/").pop() || "document";
          const signedUrl = await getSignedDocumentUrl(path);
          docs.push({
            id: record.id,
            filePath: path,
            fileName,
            note: record.note,
            createdAt: record.created_at,
            signedUrl,
          });
        }
      }

      setDocuments(docs);
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!employee?.id) {
      toast.error("Vui lòng lưu thông tin nhân viên trước khi upload.");
      return;
    }

    setUploading(true);
    try {
      const docTypeId = await getDocumentTypeIdByCode(docTypeCode);
      if (!docTypeId) {
        toast.error("Loại tài liệu không hợp lệ.");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Process all selected files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          // Upload file to storage
          const cleanName = sanitizeFileName(file.name);
          const filePath = `${employee.id}/${docTypeCode}/${Date.now()}_${cleanName}`;

          const { error: uploadError } = await supabase.storage
            .from("employee_documents")
            .upload(filePath, file);

          if (uploadError) {
            console.error(`Error uploading ${file.name}:`, uploadError);
            errorCount++;
            continue;
          }

          // Insert new document record
          const { error: dbError } = await supabase
            .from("employee_documents")
            .insert({
              employee_id: employee.id,
              document_type_id: docTypeId,
              file_paths: [filePath],
              note: null,
            });

          if (dbError) {
            console.error(`Error saving metadata for ${file.name}:`, dbError);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
            console.error(`Error processing ${file.name}:`, err);
            errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Đã upload ${successCount} tập tin thành công!`);
        await loadDocuments();
      }
      
      if (errorCount > 0) {
        toast.error(`Có lỗi xảy ra với ${errorCount} tập tin.`);
      }

    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Có lỗi xảy ra khi upload file.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (!doc.signedUrl) return;

    try {
      const response = await fetch(doc.signedUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải xuống tệp");
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm("Bạn có chắc muốn xóa tài liệu này?")) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("employee_documents")
        .remove([doc.filePath]);

      if (storageError) {
        console.error("Error deleting from storage:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) {
        toast.error("Lỗi khi xóa tài liệu.");
        return;
      }

      toast.success("Đã xóa tài liệu.");
      setSelectedDoc(null);
      await loadDocuments();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Có lỗi xảy ra khi xóa tài liệu.");
    }
  };

  const handleSaveNote = async () => {
    if (!selectedDoc) return;

    setSavingNote(true);
    try {
      const { error } = await supabase
        .from("employee_documents")
        .update({ note: editingNote || null })
        .eq("id", selectedDoc.id);

      if (error) {
        toast.error("Lỗi khi lưu ghi chú.");
        return;
      }

      toast.success("Đã lưu ghi chú.");
      setSelectedDoc({ ...selectedDoc, note: editingNote || null });
      await loadDocuments();
    } catch (error) {
      console.error("Save note error:", error);
      toast.error("Có lỗi xảy ra.");
    } finally {
      setSavingNote(false);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
    if (documents.length > 0) {
      setSelectedDoc(documents[0]);
      setEditingNote(documents[0].note || "");
    }
  };

  const selectDocument = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setEditingNote(doc.note || "");
  };

  const fileCount = documents.length;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading || loading || !employee?.id}
      />

      <div
        className={cn(
          "relative flex items-center gap-2 px-3 py-2.5 border border-input rounded-md transition-colors text-sm group",
          !employee?.id
            ? "opacity-50 cursor-not-allowed bg-muted/50"
            : "cursor-pointer hover:bg-accent/50"
        )}
        onClick={() => {
          if (uploading || loading || !employee?.id) return;
          
          if (fileCount > 0) {
            openModal();
          } else {
            inputRef.current?.click();
          }
        }}
      >
        <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground truncate flex-1 flex items-center gap-2">
          {(uploading || loading) && <Loader2 className="h-3 w-3 animate-spin" />}
          {!employee?.id
            ? "Lưu nhân viên trước khi tải tài liệu"
            : loading
            ? "Đang tải..."
            : uploading
            ? "Đang upload..."
            : fileCount > 0
            ? `${fileCount} tài liệu (Nhấn để xem)`
            : "Nhấn để chọn tệp..."}
        </span>

        {/* Hover overlay - View details when has files */}
        {fileCount > 0 && !uploading && !loading && (
          <div
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/90 text-gray-800 rounded-md text-sm font-medium hover:bg-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                openModal();
              }}
            >
              <Eye className="h-4 w-4" />
              Xem chi tiết
            </button>
          </div>
        )}
      </div>

      {/* Modal for viewing documents */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left side - Document list */}
            <div className="w-1/2 flex flex-col border rounded-lg">
              <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                <span className="text-sm font-medium">
                  Danh sách tài liệu ({fileCount})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading || !employee?.id}
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  Thêm tệp
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {documents.map((doc, index) => (
                    <div
                      key={`${doc.id}-${index}`}
                      className={cn(
                        "p-2 rounded-md cursor-pointer transition-colors text-sm",
                        selectedDoc?.filePath === doc.filePath
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => selectDocument(doc)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{doc.fileName}</span>
                      </div>
                      {doc.note && (
                        <p className="text-xs text-muted-foreground mt-1 truncate pl-6">
                          {doc.note}
                        </p>
                      )}
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Chưa có tài liệu nào
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right side - Document details */}
            <div className="w-1/2 flex flex-col border rounded-lg">
              <div className="p-3 border-b bg-muted/30">
                <span className="text-sm font-medium">Chi tiết</span>
              </div>
              {selectedDoc ? (
                <div className="flex-1 p-4 flex flex-col">
                  <div className="space-y-4 flex-1">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Tên tệp
                      </Label>
                      <p className="text-sm font-medium mt-1 break-all">
                        {selectedDoc.fileName}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Ngày tải lên
                      </Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedDoc.createdAt).toLocaleDateString(
                          "vi-VN",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>

                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">
                        Ghi chú
                      </Label>
                      <Textarea
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        placeholder="Nhập ghi chú cho tài liệu..."
                        className="mt-1 resize-none h-24"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={handleSaveNote}
                        disabled={savingNote}
                      >
                        {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleDownload(selectedDoc)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Tải về
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(selectedDoc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Chọn một tài liệu để xem chi tiết
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

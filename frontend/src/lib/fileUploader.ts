import { supabase } from "@/lib/supabase";
import { Employee } from "@/types";

const sanitizeFileName = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_") // Space -> Underscore
    .replace(/[^a-zA-Z0-9_.-]/g, "") // Bỏ ký tự đặc biệt
    .toLowerCase();
};

async function getDocumentTypeIdByCode(code: string) {
  const { data, error } = await supabase
    .from("document_types")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (error || !data) {
    console.error(`Error fetching document type ID for code ${code}:`, error);
    return null;
  }
  return data.id;
}

export async function getCCCDDocumentPaths(employeeId: string) {
  try {
    const docTypeId = await getDocumentTypeIdByCode("CCCD");
    if (!docTypeId) return { success: false, paths: [] };

    const { data, error } = await supabase
      .from("employee_documents")
      .select("file_paths, id")
      .eq("employee_id", employeeId)
      .eq("document_type_id", docTypeId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, paths: [] };
    }

    return {
      success: true,
      paths: data.file_paths || [],
      documentId: data.id,
    };
  } catch (error) {
    console.error("Error fetching CCCD document paths:", error);
    return { success: false, paths: [] };
  }
}

/**
 * Fetch document paths by employee ID and document type code
 */
export async function getDocumentByTypeCode(
  employeeId: string,
  docTypeCode: string,
) {
  try {
    const docTypeId = await getDocumentTypeIdByCode(docTypeCode);
    if (!docTypeId) return { success: false, paths: [], documentId: null };

    const { data, error } = await supabase
      .from("employee_documents")
      .select("file_paths, id")
      .eq("employee_id", employeeId)
      .eq("document_type_id", docTypeId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, paths: [], documentId: null };
    }

    return {
      success: true,
      paths: data.file_paths || [],
      documentId: data.id,
    };
  } catch (error) {
    console.error(`Error fetching document paths for ${docTypeCode}:`, error);
    return { success: false, paths: [], documentId: null };
  }
}

/**
 * Get signed URL for a document path (expires in 24 hours)
 * @param filePath - Path to the file in storage
 * @param transform - Optional transform options for image optimization
 */
export async function getSignedDocumentUrl(
  filePath: string,
  transform?: { width?: number; height?: number; quality?: number },
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("employee_documents")
      .createSignedUrl(filePath, 120, {
        transform: transform
          ? {
              width: transform.width,
              height: transform.height,
              quality: transform.quality ?? 80,
            }
          : undefined,
      });

    if (error || !data?.signedUrl) {
      console.error("Error creating signed URL:", error);
      return "";
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error in getSignedDocumentUrl:", error);
    return "";
  }
}

async function uploadFileToStorage(
  file: File,
  employeeId: string,
  docTypeCode: string,
) {
  try {
    const cleanName = sanitizeFileName(file.name);
    const filePath = `${employeeId}/${docTypeCode}/${Date.now()}_${cleanName}`;

    const { error } = await supabase.storage
      .from("employee_documents")
      .upload(filePath, file);

    if (error) throw error;

    return { success: true, path: filePath, url: "" };
  } catch (error) {
    console.error(`Failed to upload file ${file.name}:`, error);
    return { success: false, path: null, url: null };
  }
}

/**
 * Delete files from storage
 * @param filePaths - Array of file paths to delete
 */

async function deleteFilesFromStorage(filePaths: string[]) {
  if (!filePaths || filePaths.length === 0) return { success: true };

  try {
    const { error } = await supabase.storage
      .from("employee_documents")
      .remove(filePaths);

    if (error) {
      console.error("Error deleting files from storage:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteFilesFromStorage:", error);
    return { success: false, error };
  }
}

export async function uploadSingleDocument(
  file: File,
  employee: Employee,
  docTypeCode: string,
) {
  try {
    if (!file) {
      return {
        success: false,
        message: "Vui lòng chọn file để upload.",
      };
    }

    const docTypeId = await getDocumentTypeIdByCode(docTypeCode);
    if (!docTypeId) {
      return {
        success: false,
        message: "Loại tài liệu không hợp lệ (Không tìm thấy ID).",
      };
    }

    // Get existing file paths to delete later
    const existingDoc = await getDocumentByTypeCode(employee.id, docTypeCode);
    const oldFilePaths = existingDoc.success ? existingDoc.paths : [];

    // Upload new file
    const uploadResult = await uploadFileToStorage(
      file,
      employee.id,
      docTypeCode,
    );

    if (!uploadResult.success || !uploadResult.path) {
      return { success: false, message: "Lỗi khi tải file lên Storage." };
    }

    const filePath = uploadResult.path;

    // Delete old files from storage (after successful upload)
    if (oldFilePaths.length > 0) {
      const deleteResult = await deleteFilesFromStorage(oldFilePaths);
      if (!deleteResult.success) {
        console.warn(
          "Failed to delete old files, but upload succeeded:",
          oldFilePaths,
        );
      }
    }

    const { data: existingDocDb, error: fetchError } = await supabase
      .from("employee_documents")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("document_type_id", docTypeId)
      .maybeSingle();

    let dbError;
    if (existingDocDb) {
      // Update existing document
      const { error } = await supabase
        .from("employee_documents")
        .update({
          file_paths: [filePath], // Single file path in array
        })
        .eq("id", existingDocDb.id);
      dbError = error;
    } else {
      // Insert new document
      const { error } = await supabase.from("employee_documents").insert([
        {
          employee_id: employee.id,
          document_type_id: docTypeId,
          file_paths: [filePath], // Single file path in array
        },
      ]);
      dbError = error;
    }

    if (dbError) {
      console.error("Error saving to database:", dbError);
      throw dbError;
    }

    return {
      success: true,
      message: "Upload thành công!",
      filePath,
    };
  } catch (error) {
    console.error("Process Error:", error);
    return { success: false, message: "Có lỗi xảy ra trong quá trình xử lý." };
  }
}

export async function uploadEmployeeCCCD(
  frontFile: File,
  backFile: File,
  employee: Employee,
  expiryDate: Date | null, // Có thể null nếu không nhập
) {
  if (!frontFile || !backFile) {
    return {
      success: false,
      message: "Vui lòng cung cấp đủ cả mặt trước và mặt sau.",
    };
  }

  try {
    const docTypeCode = "CCCD"; // Code cứng hoặc truyền vào

    const docTypeId = await getDocumentTypeIdByCode(docTypeCode);
    if (!docTypeId) {
      return {
        success: false,
        message: "Loại tài liệu không hợp lệ (Không tìm thấy ID).",
      };
    }

    // 3. Get existing file paths to delete later
    const existingPaths = await getCCCDDocumentPaths(employee.id);
    const oldFilePaths = existingPaths.success ? existingPaths.paths : [];

    // 4. Upload new files
    const uploadResults = await Promise.all([
      uploadFileToStorage(frontFile, employee.id, "CCCD_front"),
      uploadFileToStorage(backFile, employee.id, "CCCD_back"),
    ]);

    // Kiểm tra xem có file nào bị lỗi không
    const failedUpload = uploadResults.find((res) => !res.success);
    if (failedUpload) {
      return { success: false, message: "Lỗi khi tải file lên Storage." };
    }

    // Lấy ra 2 đường dẫn thành công
    const validPaths = uploadResults.map((res) => res.path as string);

    // 5. Delete old files from storage (after successful upload)
    if (oldFilePaths.length > 0) {
      const deleteResult = await deleteFilesFromStorage(oldFilePaths);
      if (!deleteResult.success) {
        console.warn(
          "Failed to delete old files, but upload succeeded:",
          oldFilePaths,
        );
        // Don't fail the entire operation, just log the warning
      }
    }

    // 4. Check if document already exists
    const { data: existingDoc, error: fetchError } = await supabase
      .from("employee_documents")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("document_type_id", docTypeId)
      .maybeSingle();

    let dbError;
    if (existingDoc) {
      // Update existing document
      const { error } = await supabase
        .from("employee_documents")
        .update({
          file_paths: validPaths,
          expiry_date: expiryDate,
        })
        .eq("id", existingDoc.id);
      dbError = error;
    } else {
      // Insert new document
      const { error } = await supabase.from("employee_documents").insert([
        {
          employee_id: employee.id,
          document_type_id: docTypeId,
          file_paths: validPaths, // JSONB Array: ["path_front", "path_back"]
          expiry_date: expiryDate,
        },
      ]);
      dbError = error;
    }

    if (dbError) {
      console.error("Error saving to database:", dbError);
      throw dbError;
    }

    return { success: true, message: "Upload thành công!" };
  } catch (error) {
    console.error("Process Error:", error);
    return { success: false, message: "Có lỗi xảy ra trong quá trình xử lý." };
  }
}

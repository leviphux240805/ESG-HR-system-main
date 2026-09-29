import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUploadField } from "../shared/FileUploadField";
import { Certificate, TrainingRecord, FileAttachment } from "@/types";
import { format } from "date-fns";

const EDUCATION_LEVELS = [
  "Tiến sĩ",
  "Thạc sĩ",
  "Đại học",
  "Cao đẳng",
  "Trung cấp",
  "THPT",
  "Khác",
];

// Mock data
const mockCertificates: Certificate[] = [
  { id: "1", name: "Chứng chỉ Tiếng Anh TOEIC 750", issuedBy: "ETS", issueDate: "2023-06-15" },
  { id: "2", name: "Chứng chỉ Kế toán trưởng", issuedBy: "Bộ Tài chính", issueDate: "2022-08-20", expiryDate: "2027-08-20" },
];

const mockTrainingRecords: TrainingRecord[] = [
  { id: "1", courseName: "Đào tạo nội bộ - Quy trình ISO", provider: "Công ty", startDate: "2024-03-01", endDate: "2024-03-05", result: "Đạt" },
  { id: "2", courseName: "Kỹ năng quản lý thời gian", provider: "Học viện Quản lý", startDate: "2024-06-10", endDate: "2024-06-12", result: "Xuất sắc" },
];

const mockEducationFiles: FileAttachment[] = [
  { id: "1", name: "BangDaiHoc_NguyenVanA.pdf", url: "#", uploadedAt: "2024-01-15", type: "pdf" },
];

export function SkillsDevelopmentTab() {
  const form = useFormContext();
  const [certificates] = useState<Certificate[]>(mockCertificates);
  const [trainingRecords] = useState<TrainingRecord[]>(mockTrainingRecords);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        V. Thông tin năng lực & Phát triển
      </h3>

      {/* TRÌNH ĐỘ HỌC VẤN */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Trình độ học vấn</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="skillsDevelopment.educationLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trình độ học vấn</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn trình độ" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EDUCATION_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FileUploadField
            label="Văn bằng, chứng chỉ học vấn"
            file={mockEducationFiles[0]}
            onFileChange={() => {}}
          />
        </div>
      </div>

      {/* BẰNG CẤP, CHỨNG CHỈ */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Bằng cấp, chứng chỉ</h4>
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </div>

        {certificates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên chứng chỉ</TableHead>
                <TableHead>Nơi cấp</TableHead>
                <TableHead>Ngày cấp</TableHead>
                <TableHead>Ngày hết hạn</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">{cert.name}</TableCell>
                  <TableCell>{cert.issuedBy}</TableCell>
                  <TableCell>{format(new Date(cert.issueDate), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {cert.expiryDate ? format(new Date(cert.expiryDate), "dd/MM/yyyy") : "Không thời hạn"}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có bằng cấp, chứng chỉ
          </p>
        )}
      </div>

      {/* KINH NGHIỆM LÀM VIỆC */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Kinh nghiệm làm việc</h4>
        <FormField
          control={form.control}
          name="skillsDevelopment.workExperience"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Mô tả kinh nghiệm làm việc trước đây..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* KẾT QUẢ ĐÁNH GIÁ KPI */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Kết quả đánh giá KPI</h4>
        <FormField
          control={form.control}
          name="skillsDevelopment.kpiResults"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Tổng hợp kết quả đánh giá KPI các kỳ..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* LỊCH SỬ ĐÀO TẠO */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Lịch sử đào tạo, bồi dưỡng</h4>
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </div>

        {trainingRecords.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên khóa đào tạo</TableHead>
                <TableHead>Đơn vị tổ chức</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainingRecords.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-medium">{rec.courseName}</TableCell>
                  <TableCell>{rec.provider}</TableCell>
                  <TableCell>
                    {format(new Date(rec.startDate), "dd/MM/yyyy")} - {format(new Date(rec.endDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{rec.result}</TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có lịch sử đào tạo
          </p>
        )}
      </div>

      {/* KẾ HOẠCH PHÁT TRIỂN CÁ NHÂN */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium mb-4">Kế hoạch phát triển cá nhân (IDP)</h4>
        <FormField
          control={form.control}
          name="skillsDevelopment.idpPlan"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Mô tả kế hoạch phát triển cá nhân, mục tiêu nghề nghiệp..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

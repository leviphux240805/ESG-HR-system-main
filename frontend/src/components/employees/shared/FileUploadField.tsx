import { Eye, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileAttachment } from "@/types";

interface FileUploadFieldProps {
  label: string;
  file?: FileAttachment | null;
  onFileChange?: (file: File | null) => void;
  onViewFile?: () => void;
  required?: boolean;
}

export function FileUploadField({
  label,
  file,
  onFileChange,
  onViewFile,
  required = false,
}: FileUploadFieldProps) {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && onFileChange) {
      onFileChange(selectedFile);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
        {file && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary hover:text-primary/80"
                  onClick={() => {
                    if (onViewFile) onViewFile();
                    else if (file.url) window.open(file.url, "_blank");
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Xem: {file.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="file"
            className="hidden"
            id={`file-${label}`}
            onChange={handleFileSelect}
          />
          <label
            htmlFor={`file-${label}`}
            className="flex items-center gap-2 px-3 py-2 border border-input rounded-md cursor-pointer hover:bg-accent/50 transition-colors text-sm"
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground truncate max-w-[200px]">
              {file ? file.name : "Chọn tệp..."}
            </span>
          </label>
        </div>
        {file && onFileChange && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive/80"
            onClick={() => onFileChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

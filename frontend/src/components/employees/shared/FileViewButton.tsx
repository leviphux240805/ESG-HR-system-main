import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileAttachment } from "@/types";

interface FileViewButtonProps {
  file?: FileAttachment | null;
  label?: string;
}

export function FileViewButton({ file, label = "Xem tài liệu" }: FileViewButtonProps) {
  if (!file) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:text-primary/80"
            onClick={() => window.open(file.url, "_blank")}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}: {file.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
